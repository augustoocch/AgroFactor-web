import type { AccionRecomendada, Establecimiento, Justificacion } from "@/lib/types";

/**
 * Traduce los aportes del motor de priorización a algo que un productor o un asesor pueda leer.
 *
 * Por qué existe: la pantalla mostraba `Impacto 1.00 · Urgencia 0.57 · Recursos 0.50`. Esos
 * números son reales —salen de `risk-engine/app/priorizacion.py`— pero no significan nada para
 * quien los mira, y con dos decimales sugieren una medición donde en varios casos hay una
 * categoría: `Recursos` y `Reversibilidad` salen de tablas fijas por tipo de activo, no de algo
 * medido en ese campo.
 *
 * El criterio es el del TP: el sistema tiene que poder exhibir de qué datos salió cada cosa. Eso
 * se cumple mejor diciendo "es el activo más caro que tenés y está en un lote de riesgo medio"
 * que dibujando una barra al 100 %.
 */

/** Umbrales para pasar de un 0-1 a una palabra. Son cortes de presentación, no constantes físicas. */
const ALTO = 0.66;
const MEDIO = 0.33;

function nivel(valor: number): "alto" | "medio" | "bajo" {
  if (valor >= ALTO) return "alto";
  return valor >= MEDIO ? "medio" : "bajo";
}

/**
 * `aporteImpacto` es el valor del activo relativo al más caro del establecimiento, así que 1.00
 * significa exactamente "no tenés nada más caro que esto".
 */
function frasePorImpacto(valor: number): string {
  if (valor >= 0.99) return "es el activo más caro que tenés";
  if (valor >= ALTO) return "es de los más caros del campo";
  if (valor >= MEDIO) return "tiene un valor intermedio frente al resto";
  return "vale poco frente al resto de tus activos";
}

/** `aporteUrgencia` es el score de susceptibilidad del lote donde está el activo. */
function frasePorUrgencia(valor: number): string {
  const n = nivel(valor);
  if (n === "alto") return "está en un lote de riesgo alto";
  if (n === "medio") return "está en un lote de riesgo medio";
  return "está en un lote de riesgo bajo";
}

/**
 * `aporteRecursos` es facilidad de movilización: sale de una tabla por tipo de activo y se
 * penaliza a la mitad si el activo es fijo. Un galpón no se mueve, y eso lo dice la palabra
 * mejor que un 0.35.
 */
function frasePorRecursos(valor: number, movilidad: AccionRecomendada["movilidad"]): string {
  if (movilidad === "FIJO") return "no se puede mover: hay que protegerlo donde está";
  const n = nivel(valor);
  if (n === "alto") return "moverlo es relativamente fácil";
  if (n === "medio") return "moverlo lleva algo de trabajo";
  return "moverlo exige bastantes recursos";
}

/** `aporteReversibilidad` es cuán irrecuperable es la pérdida de ese tipo de activo. */
function frasePorReversibilidad(valor: number): string {
  const n = nivel(valor);
  if (n === "alto") return "si se pierde no se recupera";
  if (n === "medio") return "la pérdida es parcialmente recuperable";
  return "la pérdida se puede revertir";
}

/**
 * Una o dos oraciones que explican la posición del activo en el orden.
 *
 * Se arma con los dos criterios que más pesaron en ESE activo, no con los cuatro siempre: una
 * lista de cuatro cláusulas se vuelve ruido y deja de leerse. El desglose completo sigue
 * disponible en "ver cómo se calculó".
 */
export function explicarPosicion(item: AccionRecomendada, pesos: Establecimiento["pesosPrioridad"]): string {
  const contribuciones: { texto: string; peso: number }[] = [
    { texto: frasePorImpacto(item.justificacion.aporteImpacto), peso: pesos.impacto * item.justificacion.aporteImpacto },
    { texto: frasePorUrgencia(item.justificacion.aporteUrgencia), peso: pesos.urgencia * item.justificacion.aporteUrgencia },
    {
      texto: frasePorRecursos(item.justificacion.aporteRecursos, item.movilidad),
      peso: pesos.recursos * item.justificacion.aporteRecursos,
    },
    {
      texto: frasePorReversibilidad(item.justificacion.aporteReversibilidad),
      peso: pesos.reversibilidad * item.justificacion.aporteReversibilidad,
    },
  ];

  const [primero, segundo] = [...contribuciones].sort((a, b) => b.peso - a.peso);
  const frase = `${primero.texto.charAt(0).toUpperCase()}${primero.texto.slice(1)}, y ${segundo.texto}.`;
  return frase;
}

/**
 * El desglose completo, en palabras, para el detalle plegado.
 *
 * `ayuda` es la linea de hover. Ahi va, entre otras cosas, que dos de los cuatro criterios salen
 * del tipo de activo y no de este campo en particular: antes eso era un parrafo al pie del
 * desglose, y como aclaracion vale para el renglon al que corresponde, no para el bloque entero.
 */
export function desglosarCriterios(
  justificacion: Justificacion,
  movilidad: AccionRecomendada["movilidad"],
): { criterio: string; lectura: string; ayuda: string }[] {
  return [
    {
      criterio: "Cuánto vale",
      lectura: frasePorImpacto(justificacion.aporteImpacto),
      ayuda: "El valor que cargaste para este activo, comparado con el resto de los tuyos.",
    },
    {
      criterio: "Riesgo del lote",
      lectura: frasePorUrgencia(justificacion.aporteUrgencia),
      ayuda: "Qué tan expuesto al agua está el lote donde hoy se encuentra este activo.",
    },
    {
      criterio: "Facilidad de moverlo",
      lectura: frasePorRecursos(justificacion.aporteRecursos, movilidad),
      ayuda: "Cuánto trabajo cuesta sacarlo. Va por tipo de activo, no por tu campo en particular.",
    },
    {
      criterio: "Si se pierde",
      lectura: frasePorReversibilidad(justificacion.aporteReversibilidad),
      ayuda: "Cuánto se recupera si el agua lo alcanza. Va por tipo de activo, no por tu campo.",
    },
  ];
}
