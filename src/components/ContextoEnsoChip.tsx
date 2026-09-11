const FASE_ENSO_CORTA: Record<"EL_NINO" | "LA_NINA" | "NEUTRAL", string> = {
  EL_NINO: "El Niño",
  LA_NINA: "La Niña",
  NEUTRAL: "ENSO neutral",
};

/**
 * Fase ENSO siempre visible junto al chip de riesgo (no escondida detras del boton "i"):
 * es un dato de contexto estacional, no un detalle tecnico secundario, y un asesor lo tiene
 * que ver de un vistazo. El desglose numerico (ONI, modulador) sigue en el InfoModal.
 */
export function ContextoEnsoChip({ fase }: { fase: "EL_NINO" | "LA_NINA" | "NEUTRAL" }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium"
      style={{ backgroundColor: "var(--color-clay-100)", color: "var(--color-clay-600)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-clay-500)" }} />
      {FASE_ENSO_CORTA[fase]}
    </span>
  );
}
