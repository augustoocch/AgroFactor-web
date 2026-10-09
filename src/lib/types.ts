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

export type TipoReporte = "EMERGENCIA_AGROPECUARIA" | "IMPACTO_ECONOMICO";

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
    /** null si OpenTopoData no respondio: el factor topografico quedo fuera del score ponderado. */
    elevacionPercentil: number | null;
    antecedentesHistoricos: number;
    tipoSueloScore: number;
    precipitacionRecienteMm: number;
    precipitacionPronosticadaMm: number;
    // Pueden faltar si NOAA CPC (ENSO) o el ensemble de Open-Meteo no respondieron en el
    // momento de la evaluacion — ver TFI/analisis-brechas-tecnicas-risk-engine-oceano-biomasa.md.
    moduladorEnso: number | null;
    faseEnso: "EL_NINO" | "LA_NINA" | "NEUTRAL" | null;
    /** Proxy de saturacion regional (lluvia acumulada 12 meses). NO es napa freatica medida. */
    saturacionRegionalProxy: number | null;
    /** Informativo (ensemble de 30 corridas): no participa del score ponderado. */
    probabilidadEventoExtremoPct: number | null;
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

  // --- Suelo: de que esta hecho el lote y cuanto de eso se midio ---
  //
  // Todos opcionales a proposito: una respuesta guardada de antes del modulo de suelo no los
  // trae, y la pantalla no puede romperse por eso. El panel omite la seccion de suelo en vez de
  // tumbar la pagina entera.
  claseTexturalSuelo?: string | null;
  grupoHidrologico?: string;
  /** "C/D" cuando la napa somera lleva al lote a comportarse como grupo D pese a su textura. */
  grupoHidrologicoDual?: string | null;
  napaCm?: number | null;
  procedenciaSuelo?: ProcedenciaDato;
  porosidadSuelo?: number;
  /** Que fraccion del lote se apoya en dato cargado y cuanta en el supuesto regional. */
  coberturaSueloPct?: number;
  zonasSuelo?: ZonaSueloAplicada[];
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
  /**
   * Valor del activo por el riesgo de su lote. Es la cifra que el usuario realmente pidio: el
   * `scorePrioridad` solo sirve para ordenar y no significa nada en absoluto.
   * Null en planes generados antes de la migracion V22.
   */
  valorEnRiesgo: number | null;
  /** Riesgo del lote al generarse el plan. Null en planes anteriores a V22. */
  severidadEstimada: number | null;
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

// --- Impacto economico post-evento (DALA: dano / perdida / costo de recuperacion) ----------
// Distinto de PerdidaEstimada (esa es propension pre-evento para priorizar que salvar primero,
// no se edita nadie): este informe es interactivo, el sistema pre-genera un borrador y el
// productor o el asesor lo ajustan caso por caso.

export type CategoriaDala = "DANO" | "PERDIDA" | "COSTO_RECUPERACION";

export type OrigenItemImpacto = "ESTIMADO_SISTEMA" | "EDITADO_USUARIO" | "AGREGADO_MANUAL" | "SUGERIDO_LLM";

export type EstadoInformeImpacto = "BORRADOR" | "CONFIRMADO";

export interface ItemImpactoEconomico {
  id: string;
  categoriaDala: CategoriaDala;
  origen: OrigenItemImpacto;
  activoId: string | null;
  cultivoImplantadoId: string | null;
  descripcion: string;
  /** De donde sale la cantidad (formula citable, ej. INTA). El precio nunca tiene formula: lo carga el usuario. */
  formulaOrigen: string | null;
  cantidad: number | null;
  unidad: string | null;
  precioUnitario: number | null;
  moneda: "USD" | "ARS";
  montoOriginalArs: number | null;
  tipoCambioAplicado: number | null;
  /** Null mientras no se cargo un precio/monto: no se lo cuenta como cero en el total. */
  montoUsd: number | null;
  /**
   * Esta fila declara dano sobre un lote que no registro agua durante el evento. No invalida nada
   * -el % de afectacion es declaracion jurada del productor- pero conviene verlo antes de
   * presentar el informe, no despues.
   */
  loteSinRegistroDeAgua: boolean;
}

export interface InformeImpactoEconomico {
  id: string;
  establecimientoId: string;
  estado: EstadoInformeImpacto;
  fechaEventoDesde: string | null;
  fechaEventoHasta: string | null;
  tipoCambioBcraUsado: number | null;
  tipoCambioFecha: string | null;
  generadoEn: string;
  totalDanoUsd: number;
  totalPerdidaUsd: number;
  totalCostoRecuperacionUsd: number;
  totalGeneralUsd: number;
  /** Con que precio de mercado se armaron los montos. Null en informes anteriores a la V16. */
  fuentePreciosHacienda: string | null;
  fuentePreciosGranos: string | null;
  /** Alguno de los dos mercados no respondio y se uso la tabla de referencia de respaldo. */
  preciosSonReferencia: boolean;
  items: ItemImpactoEconomico[];
}

// --- Duracion estimada del anegamiento ------------------------------------------------------
//
// Se pide aparte del informe y no dentro de el: la plata en riesgo queda congelada al momento en
// que se genero el informe (es un documento), mientras que la duracion depende de la lluvia de
// los ultimos 30 dias y de la pronosticada, y se responde fresca en cada consulta.

/** LOCAL: evento de este campo. TRANSICION: la region ya esta cargada. FREATICO_REGIONAL: la
 * cuenca paso el umbral y la napa esta en superficie. SIN_DRENAJE: el agua no baja y la cuenca no
 * lo explica. */
export type RegimenAnegamiento = "LOCAL" | "TRANSICION" | "FREATICO_REGIONAL" | "SIN_DRENAJE" | "SIN_ANEGAMIENTO";

export interface SenalDuracion {
  nombre: string;
  detalle: string;
  /** Cuantos dias aporta esta senal. Null cuando la senal se declaro no concluyente. */
  aporteDias: number | null;
  fuente: string;
}

export interface DuracionAnegamiento {
  hayAnegamiento: boolean;
  diasMin: number;
  diasMax: number;
  regimen: RegimenAnegamiento;
  resumen: string;
  senales: SenalDuracion[];
  lluvia30DiasMm: number | null;
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


// --- Afectacion sugerida por cultivo --------------------------------------------------------
//
// El % de afectacion sigue siendo declaracion jurada del productor (Ley 26.509). Esto es una
// sugerencia calculada sobre lo que la simulacion ya midio, para que la declaracion no arranque
// en un campo vacio. Ver risk-engine/app/afectacion_cultivo.py para el modelo y sus limites.

export interface AfectacionSugerida {
  cultivoId: string;
  haySugerencia: boolean;
  /** Por que no hay sugerencia. Presente solo cuando `haySugerencia` es false. */
  motivo: string | null;
  /** Merma de rendimiento: superficie anegada x perdida de rendimiento por dias y estado. */
  perdidaProduccionPct: number | null;
  /** Costo de implantacion que se tira, solo donde el agua paso los dias de tolerancia. */
  danoPct: number | null;
  superficieAnegadaPct: number | null;
  perdidaRendimientoPct: number | null;
  diasAnegado: number | null;
  formulaPerdida: string | null;
  formulaDano: string | null;
  advertencia: string | null;
}

// --- Suelo ---------------------------------------------------------------------------------

/**
 * De donde salio un dato de suelo, de mas a menos confiable. Se muestra junto al valor: el
 * diferencial declarado en el TP es que el usuario pueda discutir el resultado, y un numero sin
 * procedencia no se discute.
 */
export type ProcedenciaDato = "LABORATORIO" | "DECLARADA" | "SOILGRIDS" | "SUPUESTO_REGIONAL";

/**
 * Cuan viejo es el dato. NO lo invalida: el sistema nunca descarta un dato por viejo, porque la
 * alternativa es volver al supuesto regional, que es peor. Solo informa para que el usuario
 * pondere cuanto creerle.
 */
export type AntiguedadDato = "VIGENTE" | "ANTIGUO" | "MUY_ANTIGUO";

export type TipoMedicionCampo = "NAPA" | "TEXTURA" | "BIOMASA";

export interface ZonaSuelo {
  id: string;
  loteId: string;
  nombre: string;
  geometria: Coordenada[];
  superficieHectareas: number;
  fraccionDelLote: number | null;

  arenaPct: number | null;
  limoPct: number | null;
  arcillaPct: number | null;
  procedenciaTextura: ProcedenciaDato | null;
  texturaMedidaEn: string | null;
  antiguedadTextura: AntiguedadDato | null;

  /** Profundidad de la freatica en cm. Bajo 60 cm el lote escurre como grupo hidrologico D. */
  napaCm: number | null;
  procedenciaNapa: ProcedenciaDato | null;
  napaMedidaEn: string | null;
  antiguedadNapa: AntiguedadDato | null;

  cantidadMediciones: number;
}

export interface MedicionCampo {
  id: string;
  zonaSueloId: string;
  tipo: TipoMedicionCampo;
  ubicacion: Coordenada;
  medidaEn: string;
  antiguedad: AntiguedadDato;
  procedencia: ProcedenciaDato;
  napaCm: number | null;
  arenaPct: number | null;
  limoPct: number | null;
  arcillaPct: number | null;
  biomasaKgMsHa: number | null;
  observaciones: string | null;
}

/** Que suelo termino usando cada zona en una corrida, tal como lo devuelve el motor. */
export interface ZonaSueloAplicada {
  claseTextural: string | null;
  grupoHidrologico: string;
  grupoHidrologicoDual: string | null;
  curvaNumeroII: number;
  napaCm: number | null;
  procedencia: ProcedenciaDato;
  fuente: string;
}

// --- Reproduccion del anegamiento 2025 (imagenes Sentinel-2 reales) -----------------------------

export interface LimitesGeograficos {
  oeste: number;
  sur: number;
  este: number;
  norte: number;
}

/** Una pasada de Sentinel-2 con el campo despejado, y el agua que se vio ese dia. */
export interface EscenaReproduccion {
  fecha: string;
  semanaDesde: string;
  semanaHasta: string;
  satelite: string;
  despejadoPct: number;
  /** % de la superficie de los lotes con agua, descontada la que ya estaba antes del evento. */
  anegadoPct: number;
  anegadoHa: number;
  aguaFueraDeLotesHa: number;
  lluvia30DiasPreviosMm: number | null;
  porLote: { loteId: string; anegadoPct: number | null }[];
  /** GeoJSON (lon/lat) de las manchas de agua; null si no se vio agua. */
  agua: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

export interface LoteReproduccion {
  loteId: string;
  nombre: string | null;
  superficieHa: number;
  huboAnegamiento: boolean;
  maxPct: number | null;
  maxHa: number | null;
  fechaMax: string | null;
  primeraFechaConAgua: string | null;
  ultimaFechaConAgua: string | null;
  diasConAgua: number;
  escenasConAgua: number;
  escenasObservadas: number;
}

export interface Reproduccion2025 {
  disponible: boolean;
  motivoNoDisponible?: string;
  anio: number;
  bounds: LimitesGeograficos;
  resumen: {
    huboAnegamiento: boolean;
    maxPct: number;
    maxHa: number;
    fechaMax: string;
    semanaCriticaDesde: string;
    semanaCriticaHasta: string;
    primeraFechaConAgua: string | null;
    ultimaFechaConAgua: string | null;
    diasConAgua: number;
    superficieHa: number;
    escenasDespejadas: number;
    pasadasTotales: number;
  };
  serie: EscenaReproduccion[];
  lotes: LoteReproduccion[];
  aguaPrevia: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  lluvia: {
    semanal: { desde: string; hasta: string; mm: number }[];
    mensual: { mes: number; mm: number; normalMm: number | null }[];
    totalMm: number | null;
    normalAnualMm: number | null;
    fuente: string;
  };
  metodo: {
    indice: string;
    resolucionM: number;
    despejadoMinimoPct: number;
    umbralAnegadoPct: number;
    lineaDeBase: string;
    fuente: string;
  };
}

export interface ImagenReproduccion {
  disponible: boolean;
  motivoNoDisponible?: string;
  fecha: string;
  bounds: LimitesGeograficos;
  dataUrl: string;
  fuente: string;
}

/** Acuerdo celda por celda entre el agua observada y la simulada (ver backtesting_2025.comparar_celdas). */
export interface ComparacionCeldas {
  observadoPct: number | null;
  simuladoPct: number | null;
  /** De lo que el satelite vio con agua, que parte marco el modelo. */
  deteccionPct: number | null;
  /** De lo que el modelo marco con agua, que parte estaba seca. */
  falsaAlarmaPct: number | null;
  /** Aciertos / (aciertos + omisiones + falsas alarmas), de 0 a 1. */
  csi: number | null;
  celdas: number;
}

/** El modelo diario del sistema corrido sobre los 7 dias previos a una imagen, con el clima real de 2025. */
export interface SimulacionReproduccion {
  disponible: boolean;
  motivoNoDisponible?: string;
  fecha: string;
  desde: string;
  hasta: string;
  /** IMAGEN_ANTERIOR: arranca con el agua de la foto despejada anterior. SECO: sin foto cercana. */
  inicio: "IMAGEN_ANTERIOR" | "SECO";
  fechaAnterior: string | null;
  /** % de los lotes con agua al arrancar (en celdas del modelo). 0 si arranca seco. */
  inicialPct: number;
  celdaM: number;
  umbralLaminaMm: number;
  dias: {
    fecha: string;
    lluviaMm: number;
    simuladoPct: number;
    laminaMaximaMm: number;
    condicionHumedad: string;
    /** Saturacion del suelo medida (ERA5), en %; null si se dedujo de la lluvia. */
    saturacionSueloPct: number | null;
  }[];
  diaPicoSimulado: string | null;
  total: ComparacionCeldas;
  /** Control: suponer que el agua quedo igual que en la foto anterior. Null si arranco seco. */
  persistencia: ComparacionCeldas | null;
  porLote: ({ loteId: string; nombre: string | null } & ComparacionCeldas)[];
  /** Isobandas de lamina simulada (mm), desde el umbral de anegamiento. */
  bandasSimuladas: BandaMeteorologica[];
  /** true si se corrio con otra lluvia total (escenario) en vez de la registrada. */
  escenario: boolean;
  lluviaRealMm: number;
  diasConLluvia: string[];
  lluviaSemanaMm: number;
  lluvia30DiasMm: number;
  diagnostico: string;
  fuente: string;
}
