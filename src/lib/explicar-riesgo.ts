import type { EvaluacionRiesgo } from "@/lib/types";

/**
 * Traduce el desglose de la evaluacion de riesgo a renglones que un productor o un asesor pueda
 * leer sin saber como esta armado el sistema.
 *
 * Por que existe: la pantalla listaba `Elevacion relativa: 0.72`, `Tipo de suelo: 0.84`. Son los
 * valores reales que usa el calculo, pero un 0-1 sin unidad no le dice nada a nadie, y en el caso
 * de la elevacion ademas enganiaba: el numero sube cuando el lote esta MAS BAJO que su entorno,
 * asi que "elevacion 0.72" se leia al reves de lo que significa.
 *
 * Cada renglon tiene una lectura en palabras y una linea de ayuda para el hover. Los mm y los
 * porcentajes de probabilidad se dejan como numero: ya vienen con unidad y significan algo.
 */

/** Cortes de presentacion para pasar de un 0-1 a una palabra. No son constantes del calculo. */
const ALTO = 0.66;
const MEDIO = 0.33;

/** La palabra que le corresponde al riesgo de un lote. Un solo lugar para que el chip, el mapa
    y el desglose nunca discrepen sobre el mismo lote. */
export function nivelRiesgo(score: number): "alto" | "medio" | "bajo" {
  if (score >= ALTO) return "alto";
  return score >= MEDIO ? "medio" : "bajo";
}

export interface FactorLegible {
  etiqueta: string;
  lectura: string;
  ayuda: string;
}

function posicionEnElTerreno(percentilBajo: number): string {
  if (percentilBajo >= ALTO) return "Es de lo más bajo del entorno";
  if (percentilBajo >= MEDIO) return "Está a media altura del entorno";
  return "Es de lo más alto del entorno";
}

/**
 * El valor sale de la Curva Numero del uso del lote, que en la region se mueve entre 0,79 (monte)
 * y 0,91 (agricultura). Por eso los cortes no son los mismos tercios que en el resto: con 0,66
 * todos los lotes caerian en la misma categoria y la distincion se perderia.
 */
function absorcionDelSuelo(valor: number): string {
  if (valor >= 0.9) return "Absorbe poco: el agua tiende a quedarse arriba";
  if (valor >= 0.85) return "Absorbe parte del agua, el resto escurre";
  return "Absorbe bien la lluvia";
}

function aguaAcumuladaEnLaZona(valor: number): string {
  if (valor >= ALTO) return "La zona viene muy cargada de agua";
  if (valor >= MEDIO) return "La zona viene con agua acumulada normal";
  return "La zona viene seca";
}

const CONTEXTO_ENSO: Record<"EL_NINO" | "LA_NINA" | "NEUTRAL", string> = {
  EL_NINO: "El Niño: años que en la región suelen venir más lluviosos",
  LA_NINA: "La Niña: años que en la región suelen venir más secos",
  NEUTRAL: "Sin El Niño ni La Niña: año sin sesgo marcado",
};

export function explicarFactores(
  factores: EvaluacionRiesgo["factores"],
  antecedentesUltimos10Anios: number | null,
): FactorLegible[] {
  const renglones: FactorLegible[] = [];

  renglones.push({
    etiqueta: "Posición en el terreno",
    lectura:
      factores.elevacionPercentil != null
        ? posicionEnElTerreno(factores.elevacionPercentil)
        : "No se pudo medir en este momento",
    ayuda:
      factores.elevacionPercentil != null
        ? "Qué tan hundido está el lote respecto del campo que lo rodea. El agua siempre va al punto más bajo."
        : "No se pudo consultar la altura del terreno. El riesgo se calculó con el resto de los datos.",
  });

  renglones.push({
    etiqueta: "Se anegó antes",
    lectura:
      antecedentesUltimos10Anios != null
        ? `${antecedentesUltimos10Anios} de los últimos 10 años`
        : "Sin antecedentes cargados",
    ayuda:
      antecedentesUltimos10Anios != null
        ? "Los años con anegamiento que cargaste para este lote. Cuantos más, más pesa en el riesgo."
        : "Si cargás en cuántos de los últimos 10 años se anegó, el riesgo se ajusta a la historia del lote.",
  });

  renglones.push({
    etiqueta: "Absorción del suelo",
    lectura: absorcionDelSuelo(factores.tipoSueloScore),
    ayuda: "Cuánta lluvia se infiltra y cuánta queda en superficie, según el uso que tiene el lote.",
  });

  renglones.push({
    etiqueta: "Lluvia de los últimos 90 días",
    lectura: `${factores.precipitacionRecienteMm.toFixed(0)} mm`,
    ayuda: "Lo que ya llovió sobre el lote. Sobre un suelo cargado, la misma lluvia rinde más agua en superficie.",
  });

  renglones.push({
    etiqueta: "Lluvia esperada en los próximos días",
    lectura: `${factores.precipitacionPronosticadaMm.toFixed(0)} mm`,
    ayuda: "Lo que se espera que llueva sobre el lote según el pronóstico.",
  });

  if (factores.saturacionRegionalProxy != null) {
    renglones.push({
      etiqueta: "Agua acumulada en la zona",
      lectura: aguaAcumuladaEnLaZona(factores.saturacionRegionalProxy),
      ayuda: "Cuánto llovió en la región durante el último año. Si viene cargada, el agua tarda más en irse.",
    });
  }

  if (factores.faseEnso) {
    renglones.push({
      etiqueta: "Contexto del año",
      lectura: CONTEXTO_ENSO[factores.faseEnso],
      ayuda: "La fase del océano Pacífico que marca la tendencia de lluvias de la temporada, no la de esta semana.",
    });
  }

  if (factores.probabilidadEventoExtremoPct != null) {
    renglones.push({
      etiqueta: "Chance de una lluvia fuera de lo común",
      lectura: `${factores.probabilidadEventoExtremoPct.toFixed(0)}%`,
      ayuda: "Probabilidad de que en los próximos días caiga una lluvia mucho mayor a la pronosticada.",
    });
  }

  return renglones;
}
