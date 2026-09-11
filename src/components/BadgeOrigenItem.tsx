import type { OrigenItemImpacto } from "@/lib/types";

const ETIQUETA: Record<OrigenItemImpacto, string> = {
  ESTIMADO_SISTEMA: "estimado por el sistema",
  EDITADO_USUARIO: "editado",
  AGREGADO_MANUAL: "agregado a mano",
  SUGERIDO_LLM: "sugerido por asistente",
};

/** Mismo patron visual que RiesgoChip: reusa los tokens de brand/risk-bajo ya existentes, no agrega colores nuevos. */
export function BadgeOrigenItem({ origen }: { origen: OrigenItemImpacto }) {
  const { bg, fg } =
    origen === "ESTIMADO_SISTEMA"
      ? { bg: "var(--color-brand-100)", fg: "var(--color-brand-700)" }
      : { bg: "var(--color-risk-bajo-bg)", fg: "var(--color-risk-bajo)" };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fg }} />
      {ETIQUETA[origen]}
    </span>
  );
}
