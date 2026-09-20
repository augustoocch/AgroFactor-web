import type { AntiguedadDato, ProcedenciaDato } from "@/lib/types";

const ETIQUETA_PROCEDENCIA: Record<ProcedenciaDato, string> = {
  LABORATORIO: "análisis de laboratorio",
  DECLARADA: "declarado",
  SOILGRIDS: "estimado por satélite",
  SUPUESTO_REGIONAL: "supuesto regional",
};

/**
 * Cuánto se apoya el número en una medición y cuánto en un supuesto. El supuesto regional se
 * marca distinto a propósito: es el único caso en el que el sistema no midió nada del lote.
 */
const CLASE_PROCEDENCIA: Record<ProcedenciaDato, string> = {
  LABORATORIO: "border-risk-bajo/40 bg-risk-bajo-bg text-risk-bajo",
  DECLARADA: "border-brand-500/40 bg-brand-100 text-brand-700",
  SOILGRIDS: "border-paper-300 bg-paper-200/60 text-ink-700",
  SUPUESTO_REGIONAL: "border-dashed border-ink-400/50 bg-transparent text-ink-600",
};

export function BadgeProcedencia({ procedencia }: { procedencia: ProcedenciaDato }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none ${CLASE_PROCEDENCIA[procedencia]}`}
      title={
        procedencia === "SUPUESTO_REGIONAL"
          ? "No se midió el suelo de este sector: se asume grupo hidrológico D, el de los suelos sódicos dominantes de la Pampa Deprimida."
          : `Origen del dato: ${ETIQUETA_PROCEDENCIA[procedencia]}`
      }
    >
      {ETIQUETA_PROCEDENCIA[procedencia]}
    </span>
  );
}

const ETIQUETA_ANTIGUEDAD: Record<AntiguedadDato, string> = {
  VIGENTE: "reciente",
  ANTIGUO: "conviene actualizarlo",
  MUY_ANTIGUO: "muy viejo",
};

const CLASE_ANTIGUEDAD: Record<AntiguedadDato, string> = {
  VIGENTE: "text-risk-bajo",
  ANTIGUO: "text-risk-medio",
  MUY_ANTIGUO: "text-risk-alto",
};

/**
 * La edad del dato. No lo invalida —el cálculo lo usa igual, porque descartarlo significaría
 * volver al supuesto regional, que es peor— pero el usuario tiene que verla para ponderarlo.
 */
export function BadgeAntiguedad({
  antiguedad,
  medidoEn,
}: {
  antiguedad: AntiguedadDato;
  medidoEn: string | null;
}) {
  const fecha = medidoEn ? new Date(medidoEn).toLocaleDateString("es-AR") : null;
  return (
    <span className={`text-[11px] ${CLASE_ANTIGUEDAD[antiguedad]}`}>
      {fecha ? `medido el ${fecha}` : "sin fecha"}
      {antiguedad !== "VIGENTE" && ` · ${ETIQUETA_ANTIGUEDAD[antiguedad]}`}
    </span>
  );
}
