/**
 * Partidos citados en la propia documentacion del TFI (TP Final, Entregable 2, Encuesta B), no
 * una lista exhaustiva inventada. Se evaluo usar la API de PlacesLayer para esto y se descarto:
 * no tiene registro de "25 de Mayo" (uno de los 6 partidos mas afectados por la inundacion 2025
 * segun el propio TP Final) y resuelve nombres ambiguos al partido equivocado sin contexto de
 * provincia ("9 de Julio" -> Corrientes, "Castelli" -> Chaco, "San Pedro" -> Santiago del Estero,
 * en vez de Buenos Aires). Para una lista acotada y conocida como los partidos de la Cuenca del
 * Salado, una lista estatica es mas confiable que una API de terceros pensada para "insights de
 * ciudades para mudanza/turismo", no para nomenclatura administrativa Argentina.
 *
 * El campo Partido del formulario sigue siendo texto libre (ver NuevoEstablecimientoPage): esta
 * lista solo alimenta el autocompletado, porque el propio relevamiento incluyo un establecimiento
 * en Entre Rios (Encuesta A, respondente 2) fuera de esta lista.
 */
export interface PartidoSugerido {
  partido: string;
  provincia: string;
}

export const PARTIDOS_SUGERIDOS: PartidoSugerido[] = [
  // Los 6 partidos mas afectados por la inundacion 2025 (TP Final)
  { partido: "Bolívar", provincia: "Buenos Aires" },
  { partido: "9 de Julio", provincia: "Buenos Aires" },
  { partido: "Pehuajó", provincia: "Buenos Aires" },
  { partido: "25 de Mayo", provincia: "Buenos Aires" },
  { partido: "Lincoln", provincia: "Buenos Aires" },
  { partido: "Carlos Casares", provincia: "Buenos Aires" },

  // Zonas de trabajo citadas por los asesores de la Encuesta B
  { partido: "Castelli", provincia: "Buenos Aires" },
  { partido: "Pila", provincia: "Buenos Aires" },
  { partido: "General Belgrano", provincia: "Buenos Aires" },
  { partido: "Dolores", provincia: "Buenos Aires" },
  { partido: "Chascomús", provincia: "Buenos Aires" },
  { partido: "Alberti", provincia: "Buenos Aires" },
  { partido: "Junín", provincia: "Buenos Aires" },
  { partido: "Bragado", provincia: "Buenos Aires" },
  { partido: "Saladillo", provincia: "Buenos Aires" },
  { partido: "Roque Pérez", provincia: "Buenos Aires" },
  { partido: "Lobos", provincia: "Buenos Aires" },
  { partido: "General Villegas", provincia: "Buenos Aires" },
  { partido: "Rojas", provincia: "Buenos Aires" },
  { partido: "San Andrés de Giles", provincia: "Buenos Aires" },
  { partido: "Exaltación de la Cruz", provincia: "Buenos Aires" },
  { partido: "General Alvear", provincia: "Buenos Aires" },
  { partido: "San Pedro", provincia: "Buenos Aires" },

  // Otras provincias que aparecieron en el relevamiento real
  { partido: "Federación", provincia: "Entre Ríos" },
  { partido: "Gualeguay", provincia: "Entre Ríos" },
  { partido: "San Justo", provincia: "Córdoba" },
];
