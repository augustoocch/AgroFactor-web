import area from "@turf/area";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { featureCollection, polygon as turfPolygon } from "@turf/helpers";
import intersect from "@turf/intersect";
import kinks from "@turf/kinks";
import type { Feature, Polygon as GeoPolygon } from "geojson";
import type { Coordenada } from "@/lib/types";

/**
 * Las reglas que un polígono dibujado sobre un lote tiene que cumplir, evaluadas **en el browser
 * mientras se dibuja**.
 *
 * Por qué acá y no solo en el backend: el backend ya las valida (ver `GeometriaDeLoteValidator`),
 * pero rechazar recién al guardar llega tarde. El usuario ya trazó todo el polígono, ya llenó el
 * formulario, y el error le pide rehacer el trabajo. Peor: mientras dibuja no hay ninguna señal
 * de que lo que está haciendo no se va a poder guardar. La validación del servidor queda como
 * defensa —un cliente puede saltearse esto—, no como la primera línea.
 *
 * Las tres reglas:
 *
 * 1. **Dentro del lote.** Lo que cae fuera del alambrado no participa de ningún cálculo: la
 *    simulación enmascara sus métricas al polígono del lote. Dibujar afuera es dibujar superficie
 *    que el sistema ignora en silencio.
 * 2. **Sin pisarse con otro del mismo tipo.** Un pedazo de campo tiene un solo cultivo implantado
 *    y un solo tipo de suelo. Dos zonas superpuestas cuentan dos veces la misma superficie al
 *    valuar la pérdida.
 * 3. **Sin cruzarse a sí mismo.** Un polígono con los lados cruzados no tiene un "adentro" bien
 *    definido, y PostGIS lo rechaza o le calcula un área que no es la que el usuario ve.
 *
 * Lo que sí se permite: que un sector de suelo se pise con una zona de cultivo. No son la misma
 * dimensión —el suelo es el sustrato, el cultivo es lo implantado arriba— y el cálculo de
 * afectación justamente los cruza.
 */

/** Leaflet trabaja en (lat, lon); GeoJSON en (lon, lat). Invertirlo mal es el bug clásico acá. */
function aGeoJson(anillo: Coordenada[]): Feature<GeoPolygon> | null {
  if (anillo.length < 3) return null;
  const puntos = anillo.map((c) => [c.lon, c.lat] as [number, number]);
  // GeoJSON exige el anillo cerrado: el primer punto repetido al final.
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
    puntos.push(primero);
  }
  try {
    return turfPolygon([puntos]);
  } catch {
    // Anillo degenerado (todos los puntos iguales, por ejemplo): no es un polígono válido.
    return null;
  }
}

export function puntoDentroDelLote(punto: Coordenada, lote: Coordenada[]): boolean {
  const poligonoLote = aGeoJson(lote);
  if (!poligonoLote) return true; // Sin lote válido no se puede exigir nada.
  return booleanPointInPolygon([punto.lon, punto.lat], poligonoLote);
}

/**
 * Cuánto se pueden pisar dos polígonos antes de considerarlo un solape real: el 1 % del área del
 * que se está dibujando.
 *
 * Es la misma tolerancia que aplica el backend (`GeometriaDeLoteValidator.FRACCION_TOLERADA`), y
 * tiene que serlo: si el frontend fuera más permisivo, el usuario dibujaría algo que después el
 * servidor le rechaza; si fuera más estricto, le bloquearía algo que el servidor acepta.
 */
export const FRACCION_SOLAPE_TOLERADA = 0.01;

/**
 * ¿Dos polígonos comparten superficie de verdad?
 *
 * Se mide el ÁREA de la intersección, no el simple hecho de que se toquen. La primera versión de
 * esto detectaba solape con `lineIntersect` —bordes que se cruzan— y marcaba como superpuestos a
 * dos lotes **pegados**, que es el caso normal: dos cultivos vecinos comparten el alambrado, y un
 * borde compartido tiene área cero pero sí produce intersección de líneas.
 *
 * La tolerancia del 1 % cubre además la astilla que queda al dibujar a pulso dos zonas pegadas:
 * nadie cierra un polígono exactamente sobre el trazo del vecino.
 */
export function seSuperponen(a: Coordenada[], b: Coordenada[]): boolean {
  const pa = aGeoJson(a);
  const pb = aGeoJson(b);
  if (!pa || !pb) return false;

  const comun = intersect(featureCollection([pa, pb]));
  if (!comun) return false;

  const areaNueva = area(pa);
  if (areaNueva <= 0) return false;

  return area(comun) > FRACCION_SOLAPE_TOLERADA * areaNueva;
}

/** Un polígono cuyos lados se cruzan entre sí no tiene un "adentro" bien definido. */
export function seCruzaASiMismo(anillo: Coordenada[]): boolean {
  const poligono = aGeoJson(anillo);
  if (!poligono) return false;
  return kinks(poligono).features.length > 0;
}

export interface ZonaExistente {
  id: string;
  nombre: string;
  anillo: Coordenada[];
}

/**
 * Valida el polígono terminado. Devuelve el motivo del rechazo, o `null` si está bien.
 *
 * El mensaje es el que ve el usuario: dice qué está mal y qué hacer, no un código de error.
 */
export function validarPoligonoDibujado(
  anillo: Coordenada[],
  lote: Coordenada[],
  existentes: ZonaExistente[],
  queEs: "cultivo" | "sector de suelo",
): string | null {
  if (anillo.length < 3) {
    return `Un ${queEs} necesita al menos 3 puntos.`;
  }

  if (seCruzaASiMismo(anillo)) {
    return "El dibujo se cruza a sí mismo. Rehacelo sin que los lados se corten entre ellos.";
  }

  const afuera = anillo.filter((p) => !puntoDentroDelLote(p, lote)).length;
  if (afuera > 0) {
    return afuera === anillo.length
      ? `El ${queEs} quedó entero fuera del lote. Tiene que estar dentro del alambrado.`
      : `${afuera} de los ${anillo.length} puntos quedaron fuera del lote. Lo que cae afuera del alambrado no entra en ningún cálculo.`;
  }

  const pisado = existentes.find((z) => seSuperponen(anillo, z.anillo));
  if (pisado) {
    return queEs === "cultivo"
      ? `Se superpone con "${pisado.nombre}". Un pedazo de campo tiene un solo cultivo implantado: dibujalo al lado, o editá el que ya está.`
      : `Se superpone con "${pisado.nombre}". Cada parte del lote tiene un solo tipo de suelo: dibujalo al lado, o editá el sector que ya está.`;
  }

  return null;
}
