import type { Coordenada } from "@/lib/types";

/**
 * Alta de un lote por coordenadas: el productor o el agrimensor muchas veces ya tiene los vértices
 * (plano de mensura, GPS, Google Earth) y dibujarlos a mano en el mapa es impreciso.
 *
 * Acepta, un vértice por línea:
 * - decimal: `-35.4412, -60.8812` · `-35,4412; -60,8812` · `-35.4412 -60.8812`
 * - grados, minutos y segundos: `35°26'28"S 60°52'52"O` (también W/E/N)
 * - o un GeoJSON pegado entero (Polygon, Feature o FeatureCollection: toma el primer polígono).
 *
 * El orden lat/lon se detecta solo dentro de Argentina (si el primer número cae en el rango de
 * longitudes y el segundo en el de latitudes, se dan vuelta): es el error más común al copiar de un
 * SIG, que trabaja en lon/lat.
 */

export type ResultadoCoordenadas = { ok: true; anillo: Coordenada[]; hectareas: number } | { ok: false; error: string };

// Argentina continental con margen: fuera de esto casi seguro hay un error de tipeo o de orden.
const LAT_MIN = -56;
const LAT_MAX = -21;
const LON_MIN = -74;
const LON_MAX = -53;

const enArgentina = (c: Coordenada) => c.lat >= LAT_MIN && c.lat <= LAT_MAX && c.lon >= LON_MIN && c.lon <= LON_MAX;
const pareceLatitud = (v: number) => v >= LAT_MIN && v <= LAT_MAX;
const pareceLongitud = (v: number) => v >= LON_MIN && v <= LON_MAX;

const DMS = /(\d{1,3})\s*[°º˚d]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['’′m]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″]|''|s)\s*)?([NSEOW])/gi;

function numero(texto: string): number {
  return Number(texto.replace(",", "."));
}

function dmsADecimal(grados: string, minutos: string | undefined, segundos: string | undefined, hemisferio: string): number {
  const valor = numero(grados) + (minutos ? numero(minutos) / 60 : 0) + (segundos ? numero(segundos) / 3600 : 0);
  return /[SOW]/i.test(hemisferio) ? -valor : valor;
}

function parLinea(linea: string): [number, number] | null {
  const dms = [...linea.matchAll(DMS)];
  if (dms.length === 2) {
    const valores = dms.map((m) => ({ v: dmsADecimal(m[1], m[2], m[3], m[4]), esLat: /[NS]/i.test(m[4]) }));
    const lat = valores.find((x) => x.esLat);
    const lon = valores.find((x) => !x.esLat);
    return lat && lon ? [lat.v, lon.v] : null;
  }
  // Separador explícito (";" o tabulación): las comas que queden son decimales.
  let partes = linea.split(/[;\t]/).map((p) => p.trim()).filter(Boolean);
  if (partes.length !== 2) {
    const porComa = linea.split(",").map((p) => p.trim()).filter(Boolean);
    if (porComa.length === 2) partes = porComa;
    else if (porComa.length === 4) partes = [`${porComa[0]}.${porComa[1]}`, `${porComa[2]}.${porComa[3]}`];
    else partes = linea.trim().split(/\s+/);
  }
  if (partes.length !== 2) return null;
  const [a, b] = partes.map(numero);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

function desdeGeoJson(texto: string): [number, number][] | null {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return null;
  }
  const geometria = (g: unknown): unknown => {
    const o = g as { type?: string; geometry?: unknown; features?: unknown[] };
    if (o?.type === "FeatureCollection") return geometria(o.features?.[0]);
    if (o?.type === "Feature") return geometria(o.geometry);
    return o;
  };
  const g = geometria(datos) as { type?: string; coordinates?: unknown };
  if (g?.type === "Polygon") return (g.coordinates as number[][][])[0].map(([lon, lat]) => [lat, lon]);
  if (g?.type === "MultiPolygon") return (g.coordinates as number[][][][])[0][0].map(([lon, lat]) => [lat, lon]);
  return null;
}

function cruza(p1: Coordenada, p2: Coordenada, p3: Coordenada, p4: Coordenada): boolean {
  const o = (a: Coordenada, b: Coordenada, c: Coordenada) => Math.sign((b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon));
  return o(p1, p2, p3) !== o(p1, p2, p4) && o(p3, p4, p1) !== o(p3, p4, p2) && o(p1, p2, p3) !== 0 && o(p3, p4, p1) !== 0;
}

function seCruzaASiMismo(anillo: Coordenada[]): boolean {
  const n = anillo.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue; // lados contiguos
      if (cruza(anillo[i], anillo[(i + 1) % n], anillo[j], anillo[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Superficie aproximada (ha) de un anillo lat/lon chico, proyectando a metros en su latitud. */
export function hectareas(anillo: Coordenada[]): number {
  const lat0 = (anillo.reduce((s, c) => s + c.lat, 0) / anillo.length) * (Math.PI / 180);
  const m = 111_320;
  let doble = 0;
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i];
    const b = anillo[(i + 1) % anillo.length];
    doble += a.lon * m * Math.cos(lat0) * (b.lat * m) - b.lon * m * Math.cos(lat0) * (a.lat * m);
  }
  return Math.abs(doble) / 2 / 10_000;
}

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type ResultadoVertices = { ok: true; vertices: Coordenada[] } | { ok: false; error: string };

/**
 * Lee vertices de un texto pegado (lista o GeoJSON) sin juzgar todavia si forman un lote: sirve
 * tanto para el pegado completo como para pegar uno o dos vertices en un campo del formulario.
 */
export function leerVertices(texto: string): ResultadoVertices {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, error: "No hay coordenadas para leer." };

  let pares = limpio.startsWith("{") ? desdeGeoJson(limpio) : null;
  if (limpio.startsWith("{") && !pares) return { ok: false, error: "El GeoJSON no tiene un polígono que se pueda leer." };
  if (!pares) {
    pares = [];
    const lineas = limpio.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const [i, linea] of lineas.entries()) {
      const par = parLinea(linea);
      if (!par) return { ok: false, error: `No se entiende la línea ${i + 1}: "${linea}". Usá "latitud, longitud".` };
      pares.push(par);
    }
  }

  let vertices = pares.map(([a, b]) => (pareceLongitud(a) && pareceLatitud(b) && !pareceLatitud(a) ? { lat: b, lon: a } : { lat: a, lon: b }));
  // El último vértice igual al primero (anillo cerrado) no es un vértice más.
  if (vertices.length > 1) {
    const [p, u] = [vertices[0], vertices[vertices.length - 1]];
    if (p.lat === u.lat && p.lon === u.lon) vertices = vertices.slice(0, -1);
  }
  return { ok: true, vertices };
}

/** Un lado mas largo que esto casi seguro es un digito mal tipeado, no un lote. */
const LADO_MAXIMO_KM = 25;
/** Por encima de esto se avisa: existe, pero es raro y suele ser un error de decimales. */
const HECTAREAS_ADVERTENCIA = 5_000;
/** A mas de esto del centro del partido declarado, el lote probablemente esta en otro lado. */
const DISTANCIA_PARTIDO_ADVERTENCIA_KM = 60;

export interface ValidacionAnillo {
  /** Lo que impide usar el anillo. Null si se puede usar. */
  error: string | null;
  /** Cosas raras que no bloquean, pero que conviene mirar antes de guardar. */
  advertencias: string[];
  hectareas: number;
  perimetroKm: number;
}

/** Valida que los vertices formen un lote posible. `centro` es el centroide del partido declarado. */
export function validarAnillo(anillo: Coordenada[], centro?: Coordenada | null): ValidacionAnillo {
  const resultado = (error: string | null, advertencias: string[] = [], ha = 0, perimetro = 0): ValidacionAnillo => ({
    error,
    advertencias,
    hectareas: Math.round(ha * 10) / 10,
    perimetroKm: Math.round(perimetro * 100) / 100,
  });

  if (anillo.length < 3) return resultado("Un lote necesita al menos tres vértices.");
  const fuera = anillo.findIndex((c) => !enArgentina(c));
  if (fuera >= 0) {
    const c = anillo[fuera];
    return resultado(`El vértice ${fuera + 1} (${c.lat}, ${c.lon}) cae fuera de Argentina: revisá el signo o el orden latitud/longitud.`);
  }
  for (let i = 0; i < anillo.length; i++) {
    for (let j = i + 1; j < anillo.length; j++) {
      if (distanciaKm(anillo[i], anillo[j]) < 0.001) return resultado(`Los vértices ${i + 1} y ${j + 1} son el mismo punto.`);
    }
  }
  let perimetro = 0;
  for (let i = 0; i < anillo.length; i++) {
    const siguiente = (i + 1) % anillo.length;
    const lado = distanciaKm(anillo[i], anillo[siguiente]);
    if (lado > LADO_MAXIMO_KM) {
      return resultado(
        `El lado entre el vértice ${i + 1} y el ${siguiente + 1} mide ${Math.round(lado)} km: revisá los números de alguno de los dos.`,
      );
    }
    perimetro += lado;
  }
  if (seCruzaASiMismo(anillo)) return resultado("Los lados se cruzan: revisá el orden de los vértices (tienen que seguir el contorno).");
  const ha = hectareas(anillo);
  if (ha < 0.1) return resultado("El polígono tiene menos de 0,1 ha: revisá los decimales.");

  const advertencias: string[] = [];
  if (ha > HECTAREAS_ADVERTENCIA) {
    advertencias.push(`${Math.round(ha).toLocaleString("es-AR")} ha es un lote muy grande: confirmá que los decimales estén bien.`);
  }
  if (centro) {
    const centroide = { lat: anillo.reduce((s, c) => s + c.lat, 0) / anillo.length, lon: anillo.reduce((s, c) => s + c.lon, 0) / anillo.length };
    const km = distanciaKm(centroide, centro);
    if (km > DISTANCIA_PARTIDO_ADVERTENCIA_KM) {
      advertencias.push(`El lote queda a ${Math.round(km)} km del partido declarado del establecimiento.`);
    }
  }
  return resultado(null, advertencias, ha, perimetro);
}

export function parsearCoordenadas(texto: string): ResultadoCoordenadas {
  if (!texto.trim()) return { ok: false, error: "Pegá al menos tres vértices, uno por línea." };
  const leidos = leerVertices(texto);
  if (!leidos.ok) return leidos;
  const validacion = validarAnillo(leidos.vertices);
  if (validacion.error) return { ok: false, error: validacion.error };
  return { ok: true, anillo: leidos.vertices, hectareas: validacion.hectareas };
}
