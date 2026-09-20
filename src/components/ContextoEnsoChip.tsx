import { Tooltip } from "@/components/Tooltip";

const FASE_ENSO_CORTA: Record<"EL_NINO" | "LA_NINA" | "NEUTRAL", string> = {
  EL_NINO: "El Niño",
  LA_NINA: "La Niña",
  NEUTRAL: "Año neutral",
};

const AYUDA_ENSO: Record<"EL_NINO" | "LA_NINA" | "NEUTRAL", string> = {
  EL_NINO: "Temporada que en la región suele venir más lluviosa que lo normal.",
  LA_NINA: "Temporada que en la región suele venir más seca que lo normal.",
  NEUTRAL: "Temporada sin sesgo marcado hacia más lluvia ni hacia más seca.",
};

/**
 * El contexto de la temporada, siempre visible junto al chip de riesgo y no escondido detras de
 * un boton: cambia como se lee todo lo demas, y un asesor lo tiene que ver de un vistazo.
 */
export function ContextoEnsoChip({ fase }: { fase: "EL_NINO" | "LA_NINA" | "NEUTRAL" }) {
  return (
    <Tooltip texto={AYUDA_ENSO[fase]} subrayado={false}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "var(--color-clay-100)", color: "var(--color-clay-600)" }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-clay-500)" }} />
        {FASE_ENSO_CORTA[fase]}
      </span>
    </Tooltip>
  );
}
