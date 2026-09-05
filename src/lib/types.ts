/** Tipos espejo de los DTOs de api-core (com.uade.elagua.dto.*). */

export type Rol = "PRODUCTOR" | "ASESOR" | "ADMINISTRADOR";

export type PerfilProductivo = "AGRICOLA" | "GANADERO" | "TAMBO" | "MIXTO";

export type TipoTenencia = "PROPIO" | "ARRENDADO" | "MIXTO";

export type TipoUso = "AGRICULTURA" | "PASTURA" | "POTRERO" | "MONTE" | "OTRO";

export type TipoActivo =
  | "HACIENDA"
  | "MAQUINARIA"
  | "INSTALACION"
  | "RESERVA_FORRAJERA"
  | "CAMINO_ACCESO";

export type Movilidad = "MOVIBLE" | "FIJO";

export type MargenAccion = "NINGUNO" | "COSECHA_ANTICIPADA" | "RESIEMBRA";

export type TipoReporte = "EMERGENCIA_AGROPECUARIA" | "FICHA_ARRENDAMIENTO";

export interface AuthResponse {
  token: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface PesosPrioridad {
  impacto: number;
  urgencia: number;
  recursos: number;
  reversibilidad: number;
}

export interface Establecimiento {
  id: string;
  nombre: string;
  partido: string;
  provincia: string;
  tipoTenencia: TipoTenencia;
  perfilProductivo: PerfilProductivo;
  pesosPrioridad: PesosPrioridad;
}

export interface Coordenada {
  lat: number;
  lon: number;
}

export interface Lote {
  id: string;
  establecimientoId: string;
  nombre: string;
  tipoUso: TipoUso;
  anillo: Coordenada[];
  antecedentesAnegamientoUltimos10Anios: number | null;
}

export interface Activo {
  id: string;
  establecimientoId: string;
  loteAsociadoId: string | null;
  ubicacion: Coordenada | null;
  nombre: string;
  tipo: TipoActivo;
  movilidad: Movilidad;
  valorEstimado: number;
}

export interface EstadoFenologicoCatalogo {
  codigo: string;
  nombre: string;
  orden: number;
  criticoAnegamiento: boolean;
  madurezFisiologica: boolean;
}

export interface CultivoCatalogo {
  codigo: string;
  nombre: string;
  tipo: "GRUESA" | "FINA" | "VERDEO" | "PASTURA";
  toleranciaAnegamiento: "BAJA" | "MEDIA" | "ALTA";
  diasToleranciaAnegamiento: number;
  cicloDias: number | null;
  kcMedio: number;
  admiteCosechaAnticipada: boolean;
  admiteResiembra: boolean;
  perenne: boolean;
  estados: EstadoFenologicoCatalogo[];
}

export interface CultivoImplantado {
  id: string;
  loteId: string;
  anillo: Coordenada[];
  cultivoCodigo: string | null;
  estadoFenologicoCodigo: string | null;
  tipoCultivo: string;
  estadoFenologico: string;
  fechaSiembra: string;
  margenAccion: MargenAccion;
}

export interface EvaluacionRiesgo {
  id: string;
  loteId: string;
  fecha: string;
  scoreSusceptibilidad: number;
  factores: {
    elevacionPercentil: number;
    antecedentesHistoricos: number;
    tipoSueloScore: number;
    precipitacionRecienteMm: number;
    precipitacionPronosticadaMm: number;
  };
  fuenteDatos: string;
}

export type CondicionClimatica = "SOL" | "NUBLADO" | "LLUVIA" | "TORMENTA" | "NIEVE";

export interface PronosticoDiario {
  fecha: string;
  precipitacionMm: number;
  probabilidadLluviaPct: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  humedadMediaPct: number | null;
  vientoMaxKmh: number | null;
  vientoRafagaKmh: number | null;
  radiacionSolarMj: number | null;
  horasSol: number | null;
  condicion: CondicionClimatica;
  impactos: string[];
}

export interface ClimaActual {
  temperaturaC: number | null;
  humedadPct: number | null;
  vientoKmh: number | null;
  nubosidadPct: number | null;
  precipitacionMm: number | null;
  condicion: CondicionClimatica;
}

export interface Pronostico {
  dias: PronosticoDiario[];
  precipitacionUltimos90DiasMm: number;
  actual: ClimaActual | null;
}

export interface TerrenoBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export interface Terreno {
  disponible: boolean;
  grid: number[][];
  filas: number;
  columnas: number;
  elevacionMinM: number;
  elevacionMaxM: number;
  bounds: TerrenoBounds | null;
}

export interface PasoSimulacion {
  hora: number;
  lluviaMmH: number;
  laminaGrid: number[][];
  /** Vector de escurrimiento por celda: [componente columnas (E-O), componente filas (N-S)]. */
  flujoGrid: number[][][];
  laminaMaximaMm: number;
  superficieAnegadaPct: number;
}

export interface ParametrosHidrologicos {
  celdaM: number;
  pendienteMediaPct: number;
  curvaNumeroBase: number;
  curvaNumeroAjustada: number;
  condicionHumedadAntecedente: string;
  retencionPotencialMm: number;
  abstraccionInicialMm: number;
  saturacionInicialPct: number;
  rugosidadManning: number;
  et0MmDia: number;
  lluviaTotalMm: number;
  lluvia5DiasMm: number;
  humedadSueloM3m3: number | null;
  vientoKmh: number;
  direccionVientoDeg: number;
  infiltracionMediaMm: number;
  escurrimientoFueraDelLoteMm: number;
  escorrentiaScsMm: number;
  laminaMaximaMm: number;
  superficieAnegadaPct: number;
  horaPicoAnegamiento: number;
  desnivelM: number;
  advertencia: string | null;
}

export interface SimulacionInundacion {
  disponible: boolean;
  terreno: Terreno | null;
  parametros: ParametrosHidrologicos | null;
  pasos: PasoSimulacion[];
}

export type NivelAlerta = "INFORMATIVA" | "ATENCION" | "CRITICA";

export interface Alerta {
  id: string;
  loteId: string;
  loteNombre: string;
  fecha: string;
  nivel: NivelAlerta;
  laminaMaximaEsperadaMm: number;
  superficieAnegadaPct: number;
  horasHastaPico: number;
  lluviaPronosticadaMm: number;
  mensaje: string;
}

export interface Justificacion {
  aporteImpacto: number;
  aporteUrgencia: number;
  aporteRecursos: number;
  aporteReversibilidad: number;
}

export interface AccionRecomendada {
  activoId: string;
  activoNombre: string;
  orden: number;
  scorePrioridad: number;
  justificacion: Justificacion;
}

export interface PlanAccion {
  id: string;
  establecimientoId: string;
  fecha: string;
  items: AccionRecomendada[];
}

export interface Reporte {
  id: string;
  tipo: TipoReporte;
  establecimientoId: string;
  urlPdf: string;
  fechaGeneracion: string;
}

// --- Meteorologia distribuida dentro del predio ---------------------------------------------

/**
 * OBSERVACION: lo que ya cayo, medido por satelite. PRONOSTICO: lo que se espera, segun modelo.
 * MODELO_TERRENO: donde se junta el agua, segun la topografia. No son intercambiables y la UI
 * tiene que decir cual es cual.
 */
export type HorizonteCapa = "OBSERVACION" | "PRONOSTICO" | "MODELO_TERRENO";

/** Cuantas celdas de la fuente entran en el predio: define que se puede mostrar y que no. */
export type RegimenResolucion = "SUB_CELDA" | "MARGINAL" | "RESUELTO";

export interface BandaMeteorologica {
  desde: number;
  hasta: number;
  /** Poligono GeoJSON ya suavizado por el risk-engine. La grilla de calculo nunca llega aca. */
  geometria: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface CapaMeteorologica {
  disponible: boolean;
  titulo: string;
  horizonte: HorizonteCapa;
  fuente: string | null;
  unidad: string | null;
  resolucionKm: number | null;
  razonResolucion: number | null;
  regimen: RegimenResolucion | null;
  celdasEstimadas: number | null;
  mensaje: string | null;
  motivoNoDisponible: string | null;
  bandas: BandaMeteorologica[];
  puntosMuestreados: number | null;
}

export interface ZonaAfectada {
  loteId: string;
  nombre: string;
  laminaMaximaMm: number;
  superficieAnegadaPct: number;
  horaPico: number;
}

export interface MeteorologiaDistribuida {
  disponible: boolean;
  predio: {
    superficieHa: number;
    dimensionCaracteristicaKm: number;
    bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  } | null;
  capas: CapaMeteorologica[];
  ranking: ZonaAfectada[];
  motivoNoDisponible: string | null;
}
