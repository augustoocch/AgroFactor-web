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
  /** Sin esto el informe de emergencia agropecuaria no identifica al productor ante SENASA. */
  cuit: string | null;
  renspa: string | null;
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

  // --- Ficha para peritaje. Todos opcionales: se completan con el tiempo. ---
  /** Patente, RENSPA o numero de serie: individualiza el bien ante la aseguradora. */
  identificacion: string | null;
  marcaModelo: string | null;
  anio: number | null;
  estadoConservacion: string | null;
  aseguradora: string | null;
  polizaNumero: string | null;
  polizaVence: string | null;
  valorReposicionArs: number | null;
  /** Permite responder si una lamina dada efectivamente alcanza al activo. */
  alturaSobreSueloCm: number | null;
  cantidad: number | null;
  unidadCantidad: string | null;
  /** Categoria animal, tipo de reserva o tipo de construccion, segun el tipo. */
  categoria: string | null;
  /** Material constructivo (INSTALACION) o tipo de superficie (CAMINO_ACCESO). */
  material: string | null;
  /** Construccion/corral donde esta guardado, o null si no esta contenido en otro activo. */
  contenedorId: string | null;
  observaciones: string | null;

  // --- Declaracion de dano: se carga despues de un evento, no es parte de la ficha de arriba. ---
  porcentajeDanoDeclarado: number | null;
  danoDeclaradoEn: string | null;
}

export interface ActivoFoto {
  id: string;
  contentType: string;
  tamanoBytes: number;
  nombreOriginal: string | null;
  subidaEn: string;
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

export interface ProvinciaCatalogo {
  codigo: string;
  nombre: string;
}

export interface PartidoCatalogo {
  id: number;
  nombre: string;
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

  // --- Ficha para peritaje. Todos opcionales: se completan a lo largo de la campana. ---
  variedad: string | null;
  densidadSiembra: number | null;
  unidadDensidad: string | null;
  /** Eje del calculo pericial: ubica el evento dentro del ciclo del cultivo. */
  fechaEsperadaCosecha: string | null;
  rendimientoEsperadoQqHa: number | null;
  rendimientoHistoricoQqHa: number | null;
  condicionSanitaria: string | null;
  alturaCultivoCm: number | null;
  costoImplantacionArs: number | null;
  observaciones: string | null;
  /** Derivado en el backend: null si todavia no se cargo la fecha esperada. */
  diasHastaCosecha: number | null;

  // --- Declaracion de dano: se carga despues de un evento, no es parte de la ficha de arriba. ---
  porcentajeDanoDeclarado: number | null;
  danoDeclaradoEn: string | null;
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
  /** Agua que entro al lote desde los alrededores simulados. Cero si el entorno es una planicie. */
  aporteExternoMm: number;
  celdasLote: number;
  celdasDominio: number;
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
  /** Que celdas del dominio simulado son el campo. El resto son alrededores de contexto. */
  mascaraLote: boolean[][] | null;
  /** Como le fue a cada lote EN ESTE escenario. `indice` es su posicion en el alcance enviado. */
  ranking: ZonaSimulada[];
}

export interface ZonaSimulada {
  indice: number;
  laminaMaximaMm: number;
  superficieAnegadaPct: number;
  horaPico: number;
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
  activoTipo: TipoActivo;
  movilidad: Movilidad;
  orden: number;
  scorePrioridad: number;
  justificacion: Justificacion;
  /** Que hacer con este activo. No es "mover primero" para todos: un activo fijo no se traslada. */
  recomendacion: string;
}

export interface PlanAccion {
  id: string;
  establecimientoId: string;
  fecha: string;
  items: AccionRecomendada[];
}

/** Si corresponde generar el informe de emergencia agropecuaria, y por que (o por que no). */
export interface InformeElegibilidad {
  puedeGenerar: boolean;
  motivo: string;
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

// --- Pronostico dia a dia con isobandas de acumulacion ---------------------------------------

/**
 * Un dia de pronostico con su meteorologia Y el estado del suelo con el que se lo simulo.
 * Las dos mitades van juntas a proposito: 30 mm sobre perfil seco y 30 mm sobre perfil cargado
 * dan campos distintos, y sin la humedad antecedente al lado el numero de lluvia no explica nada.
 */
export interface DiaAnalizado {
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

  lluviaPrevia5DiasMm: number;
  condicionHumedadAntecedente: string;
  curvaNumeroAjustada: number;

  laminaMaximaMm: number;
  superficieAnegadaPct: number;
  horaPico: number;
  aporteExternoMm: number;
  infiltracionMediaMm: number;
  escurrimientoFueraDelLoteMm: number;

  bandas: BandaMeteorologica[];
}

export interface PronosticoDiaADia {
  disponible: boolean;
  bounds: TerrenoBounds | null;
  celdaM: number | null;
  dias: DiaAnalizado[];
  motivoNoDisponible: string | null;
}
