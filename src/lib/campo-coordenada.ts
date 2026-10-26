import { leerVertices } from "@/lib/coordenadas";
import type { Coordenada } from "@/lib/types";

/**
 * Campos de una coordenada en el alta de lote por vertices.
 *
 * La idea es que el error no se pueda escribir, en vez de explicarlo despues:
 * - el signo no se tipea: toda Argentina esta al sur y al oeste, asi que el campo muestra "S" y
 *   "O" fijos y descarta cualquier "-" que llegue pegado. Era el error mas comun del textarea.
 * - cada campo deja entrar solo lo que puede ir ahi (digitos y un separador decimal) y corta en
 *   la cantidad de digitos posible: una latitud argentina siempre tiene dos digitos enteros.
 * - el rango se valida por campo, con el rango del pais a la vista.
 *
 * Los dos formatos (decimal y grados-minutos-segundos) se mantienen sincronizados mientras se
 * escribe: cambiar de formato no pierde nada de lo cargado.
 */

export type Eje = "lat" | "lon";
export type Formato = "decimal" | "dms";

export const EJES: Record<Eje, { etiqueta: string; hemisferio: string; min: number; max: number }> = {
  lat: { etiqueta: "Latitud", hemisferio: "S", min: 21, max: 56 },
  lon: { etiqueta: "Longitud", hemisferio: "O", min: 53, max: 74 },
};

/** Lo que el usuario escribio en un eje, en los dos formatos. */
export interface CampoEje {
  dec: string;
  g: string;
  m: string;
  s: string;
}

export interface FilaVertice {
  id: number;
  lat: CampoEje;
  lon: CampoEje;
}

export const CAMPO_VACIO: CampoEje = { dec: "", g: "", m: "", s: "" };

const DECIMALES_MAXIMOS = 7;

/** Error que bloquea, o aviso que no. Ninguno de los dos si el campo esta vacio o a medio escribir. */
export interface EstadoCampo {
  valor: number | null;
  error?: string;
  aviso?: string;
}

/** Deja solo digitos y un separador decimal (coma o punto, que pasa a punto), y corta en el largo posible. */
export function limpiarDecimal(texto: string, digitosEnteros = 2, decimales = DECIMALES_MAXIMOS): string {
  const soloValidos = texto.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [entero = "", ...resto] = soloValidos.split(".");
  const tienePunto = soloValidos.includes(".");
  const parteDecimal = resto.join("").slice(0, decimales);
  return entero.slice(0, digitosEnteros) + (tienePunto && decimales > 0 ? "." + parteDecimal : "");
}

export function limpiarEntero(texto: string, digitos: number): string {
  return texto.replace(/\D/g, "").slice(0, digitos);
}

function fueraDeRango(eje: Eje): string {
  const { min, max, hemisferio } = EJES[eje];
  return `Entre ${min}° y ${max}° ${hemisferio}`;
}

/**
 * Cuanto se puede correr un vertice segun los decimales que tiene: medio digito del ultimo
 * decimal, a ~111 km por grado. Con menos de 4 el error ya se ve en el mapa, asi que se avisa.
 */
const ERROR_POR_DECIMALES = ["55 km", "5 km", "500 m", "50 m"];

export function estadoDecimal(eje: Eje, texto: string): EstadoCampo {
  if (!texto || texto === ".") return { valor: null };
  const valor = Number(texto);
  if (!Number.isFinite(valor)) return { valor: null, error: "No es un número" };
  const { min, max } = EJES[eje];
  if (valor < min || valor > max) return { valor: null, error: fueraDeRango(eje) };
  const decimales = texto.split(".")[1]?.length ?? 0;
  const aviso =
    decimales < 4 ? `Con ${decimales} decimal${decimales === 1 ? "" : "es"} el vértice se puede correr hasta ~${ERROR_POR_DECIMALES[decimales]}` : undefined;
  return { valor: -valor, aviso };
}

export function estadoDms(eje: Eje, g: string, m: string, s: string): EstadoCampo {
  if (!g && !m && !s) return { valor: null };
  const { min, max } = EJES[eje];
  const grados = Number(g);
  const minutos = m ? Number(m) : 0;
  const segundos = s && s !== "." ? Number(s) : 0;
  if (!g) return { valor: null, error: "Faltan los grados" };
  if (grados < min || grados > max) return { valor: null, error: fueraDeRango(eje) };
  if (minutos > 59) return { valor: null, error: "Los minutos van de 0 a 59" };
  if (segundos >= 60) return { valor: null, error: "Los segundos van de 0 a 59,99" };
  const valor = grados + minutos / 60 + segundos / 3600;
  if (valor > max) return { valor: null, error: fueraDeRango(eje) };
  const aviso = !m || !s ? "Sin minutos o segundos el vértice se puede correr hasta ~2 km" : undefined;
  return { valor: -valor, aviso };
}

export function estadoEje(eje: Eje, campo: CampoEje, formato: Formato): EstadoCampo {
  return formato === "decimal" ? estadoDecimal(eje, campo.dec) : estadoDms(eje, campo.g, campo.m, campo.s);
}

/** Grados (positivos) a grados, minutos y segundos con dos decimales, sin "60 segundos" por redondeo. */
export function aDms(gradosAbs: number): { g: string; m: string; s: string } {
  const centesimas = Math.round(gradosAbs * 3600 * 100);
  const g = Math.floor(centesimas / 360000);
  const m = Math.floor((centesimas % 360000) / 6000);
  const s = (centesimas % 6000) / 100;
  return { g: String(g), m: String(m), s: s.toFixed(2).replace(/\.?0+$/, "") || "0" };
}

export function aDecimal(gradosAbs: number): string {
  return gradosAbs.toFixed(DECIMALES_MAXIMOS).replace(/0+$/, "").replace(/\.$/, "");
}

/** El campo completo a partir de un valor (negativo, como lo guarda el sistema). */
export function campoDesdeValor(valor: number): CampoEje {
  const abs = Math.abs(valor);
  return { dec: aDecimal(abs), ...aDms(abs) };
}

/**
 * Aplica lo que se escribio en un formato y recalcula el otro. Si lo escrito todavia no es un
 * valor valido, el otro formato queda vacio en vez de con un numero viejo.
 */
export function editarCampo(eje: Eje, campo: CampoEje, cambio: Partial<CampoEje>, formato: Formato): CampoEje {
  const nuevo = { ...campo, ...cambio };
  const { valor } = estadoEje(eje, nuevo, formato);
  if (formato === "decimal") {
    const dms = valor === null ? { g: "", m: "", s: "" } : aDms(Math.abs(valor));
    return { ...nuevo, ...dms };
  }
  return { ...nuevo, dec: valor === null ? "" : aDecimal(Math.abs(valor)) };
}

export function filaVacia(fila: FilaVertice): boolean {
  const vacio = (c: CampoEje) => !c.dec && !c.g && !c.m && !c.s;
  return vacio(fila.lat) && vacio(fila.lon);
}

/** El vertice de la fila, o null si falta algo o hay un error. */
export function verticeDeFila(fila: FilaVertice, formato: Formato): Coordenada | null {
  const lat = estadoEje("lat", fila.lat, formato).valor;
  const lon = estadoEje("lon", fila.lon, formato).valor;
  return lat !== null && lon !== null ? { lat, lon } : null;
}

/**
 * El anillo que forman las filas, o el motivo por el que todavia no se puede armar. Las filas
 * totalmente vacias no cuentan: son las que el usuario agrego de mas.
 */
export function anilloDeFilas(filas: FilaVertice[], formato: Formato): { anillo: Coordenada[] } | { pendiente: string } {
  const anillo: Coordenada[] = [];
  for (const [i, fila] of filas.entries()) {
    if (filaVacia(fila)) continue;
    const vertice = verticeDeFila(fila, formato);
    if (!vertice) return { pendiente: `Completá o corregí el vértice ${i + 1}.` };
    anillo.push(vertice);
  }
  const faltan = 3 - anillo.length;
  if (faltan > 0) return { pendiente: `${faltan === 1 ? "Falta 1 vértice" : `Faltan ${faltan} vértices`}: un lote necesita al menos tres.` };
  return { anillo };
}

const enRango = (eje: Eje, v: number) => v >= EJES[eje].min && v <= EJES[eje].max;

/**
 * Vertices de un texto pegado en el formulario (uno o varios pares, o un GeoJSON). Acepta los
 * valores con o sin signo y en cualquier orden lat/lon: en Argentina no hay ambiguedad, porque
 * los rangos de latitud y longitud no se pisan. Null si algun vertice no es una coordenada del
 * pais: asi un numero suelto con coma decimal ("35,4412") no se confunde con un par.
 */
export function verticesDePegado(texto: string): Coordenada[] | null {
  const leidos = leerVertices(texto);
  if (!leidos.ok || leidos.vertices.length === 0) return null;
  const vertices: Coordenada[] = [];
  for (const { lat, lon } of leidos.vertices) {
    let [a, b] = [Math.abs(lat), Math.abs(lon)];
    if (!enRango("lat", a) && enRango("lon", a) && enRango("lat", b)) [a, b] = [b, a];
    if (!enRango("lat", a) || !enRango("lon", b)) return null;
    vertices.push({ lat: -a, lon: -b });
  }
  return vertices;
}

export function filaDesdeVertice(id: number, vertice: Coordenada): FilaVertice {
  return { id, lat: campoDesdeValor(vertice.lat), lon: campoDesdeValor(vertice.lon) };
}
