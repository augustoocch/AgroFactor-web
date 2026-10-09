import type { NombreIcono } from "@/components/Icono";

/**
 * Mapa de pantallas de un establecimiento. Una sola fuente para el menu lateral y para el
 * encabezado de cada pantalla, asi el grupo que dice el menu y el que dice la pagina no pueden
 * discrepar.
 *
 * Los grupos siguen el recorrido del usuario del story mapping (Monitorear → Anticipar →
 * Documentar), no la estructura del backend. Antes eran siete pestañas planas y "Reportes"
 * juntaba cinco cosas de tres momentos distintos: datos fiscales (configuracion), duracion del
 * agua (durante el evento), declaracion de daños, impacto economico e informes (despues).
 * "Mi campo" va al final porque se carga una vez y despues se visita poco; el Panorama guia la
 * carga inicial mientras falte algo.
 */
export interface Seccion {
  segmento: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Que resuelve la pantalla, en una linea. Se usa como tooltip del menu contraido. */
  proposito: string;
}

export interface GrupoNavegacion {
  titulo: string | null;
  secciones: Seccion[];
}

export const GRUPOS: GrupoNavegacion[] = [
  {
    titulo: null,
    secciones: [
      { segmento: "", etiqueta: "Panorama", icono: "panorama", proposito: "Cómo está el campo hoy" },
    ],
  },
  {
    titulo: "Seguimiento",
    secciones: [
      { segmento: "alertas", etiqueta: "Alertas", icono: "alerta", proposito: "Agua prevista en las próximas 48 horas" },
      { segmento: "pronostico", etiqueta: "Pronóstico", icono: "pronostico", proposito: "Lluvia de los próximos días y lo que ya cayó" },
    ],
  },
  {
    titulo: "Anticipar",
    secciones: [
      { segmento: "plan-accion", etiqueta: "Plan de acción", icono: "plan", proposito: "Qué proteger primero" },
      { segmento: "simulacion", etiqueta: "Simulador de lluvia", icono: "simulador", proposito: "Qué pasaría si llueve" },
    ],
  },
  {
    titulo: "Después del evento",
    secciones: [
      { segmento: "danos", etiqueta: "Declarar daños", icono: "danos", proposito: "Porcentaje de daño por cultivo y activo" },
      { segmento: "impacto", etiqueta: "Impacto económico", icono: "impacto", proposito: "Cuánto se perdió, a precio de mercado" },
      { segmento: "informes", etiqueta: "Informes", icono: "informe", proposito: "Informe de emergencia agropecuaria en PDF" },
    ],
  },
  {
    // Separado de "Despues del evento" a proposito: aquello es lo que el usuario declara sobre SU
    // evento; esto es lo que un satelite vio en 2025, sin que nadie cargue nada. Mezclarlos haria
    // pasar un dato observado por uno declarado, o al reves.
    titulo: "Lo que pasó",
    secciones: [
      { segmento: "evento-2025", etiqueta: "Inundación 2025", icono: "historico", proposito: "El anegamiento real de 2025, visto por satélite" },
    ],
  },
  {
    titulo: "Mi campo",
    secciones: [
      { segmento: "lotes", etiqueta: "Lotes", icono: "lotes", proposito: "Dibujar lotes y cargar lo que tienen" },
      { segmento: "activos", etiqueta: "Activos", icono: "activos", proposito: "Hacienda, maquinaria e instalaciones" },
      { segmento: "ajustes", etiqueta: "Datos y acceso", icono: "ajustes", proposito: "CUIT, RENSPA y acceso del asesor" },
    ],
  },
];

export function rutaDe(establecimientoId: string, segmento: string): string {
  return segmento ? `/establecimientos/${establecimientoId}/${segmento}` : `/establecimientos/${establecimientoId}`;
}

/** El grupo al que pertenece una seccion, para el antetitulo de cada pantalla. */
export function grupoDe(segmento: string): string | null {
  return GRUPOS.find((g) => g.secciones.some((s) => s.segmento === segmento))?.titulo ?? null;
}

/**
 * Seccion activa a partir de la URL. Todo lo que cuelga de /lotes/... (el detalle de un lote,
 * la carga de un cultivo) sigue marcando "Lotes": el usuario no salio de ahi.
 */
export function seccionActiva(pathname: string, establecimientoId: string): string {
  const base = `/establecimientos/${establecimientoId}`;
  const resto = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, "") : "";
  return resto.split("/")[0] ?? "";
}
