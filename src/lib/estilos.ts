/**
 * Jerarquia de botones. Una pantalla tiene como mucho UN primario: la accion que responde a la
 * pregunta de esa pantalla (generar el plan, descargar el informe). Lo demas es secundario o sutil.
 */
export const boton = {
  primario:
    "inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50",
  secundario:
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-500 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50",
  sutil:
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-paper-300 px-3.5 py-1.5 text-sm text-ink-700 transition-colors hover:border-brand-500 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50",
  peligro:
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-paper-300 px-3.5 py-1.5 text-sm text-ink-600 transition-colors hover:border-risk-alto hover:text-risk-alto-ink disabled:cursor-not-allowed disabled:opacity-50",
} as const;

/** Enlace de texto dentro de un parrafo o al pie de un bloque. */
export const enlace = "font-medium text-brand-700 underline decoration-brand-200 underline-offset-[3px] transition-colors hover:decoration-brand-600";

/** Superficie de contenido. Sin sombra: la jerarquia la da el borde y el fondo, no la elevacion. */
export const tarjeta = "rounded-xl border border-paper-300 bg-paper-50";
