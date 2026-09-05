"use client";

export default function ErrorEstablecimiento({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-risk-alto bg-risk-alto-bg p-6 text-center">
      <p className="font-display text-lg font-medium text-risk-alto">No se pudo cargar esta seccion</p>
      <p className="mt-1 text-sm text-ink-700">{error.message || "Ocurrio un error inesperado."}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-full bg-risk-alto px-4 py-2 text-sm font-medium text-paper-50"
      >
        Reintentar
      </button>
    </div>
  );
}
