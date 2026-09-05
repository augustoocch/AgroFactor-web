"use client";

import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import type { Lote, Reporte } from "@/lib/types";

/** Los dos reportes institucionales que reutilizan el motor de riesgo/priorizacion ya calculado (caso Aguirre y caso Ortiz). */
export function PanelReportes({ establecimientoId, lotes }: { establecimientoId: string; lotes: Lote[] }) {
  const { notificar } = useToast();
  const [loteIds, setLoteIds] = useState<string[]>([]);
  const [ultimoReporte, setUltimoReporte] = useState<Reporte | null>(null);

  const emergencia = useMutation({
    mutationFn: () => api.post<Reporte>(`/establecimientos/${establecimientoId}/reportes/emergencia-agropecuaria`),
    onSuccess: setUltimoReporte,
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => emergencia.mutate() : undefined);
    },
  });

  const arrendamiento = useMutation({
    mutationFn: () => api.post<Reporte>(`/establecimientos/${establecimientoId}/reportes/ficha-arrendamiento`, { loteIds }),
    onSuccess: setUltimoReporte,
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => arrendamiento.mutate() : undefined);
    },
  });

  const toggleLote = (id: string) => {
    setLoteIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  };

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <p className="text-sm uppercase tracking-wide text-brand-600">Salidas institucionales</p>
      <h2 className="font-display text-lg font-medium text-ink-950">Reportes</h2>
      <p className="mt-1 text-sm text-ink-600">
        Reutilizan la misma evaluacion de riesgo y plan de accion — cambia solo la capa de presentacion.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-2.5 rounded-xl border border-paper-300 bg-paper-100/50 p-4">
          <p className="text-sm font-medium text-ink-900">Emergencia agropecuaria</p>
          <p className="text-xs text-ink-600">
            Documenta la evaluacion como evidencia para el tramite de la Ley 26.509. Requiere un plan de accion
            generado previamente.
          </p>
          <button
            onClick={() => emergencia.mutate()}
            disabled={emergencia.isPending}
            className="rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
          >
            Generar informe
          </button>
        </div>

        <div className="space-y-2.5 rounded-xl border border-paper-300 bg-paper-100/50 p-4">
          <p className="text-sm font-medium text-ink-900">Ficha de arrendamiento</p>
          <p className="text-xs text-ink-600">Elegi 2 o mas lotes para comparar su anegabilidad antes de arrendar.</p>
          <div className="flex flex-wrap gap-1.5">
            {lotes.map((l) => {
              const activo = loteIds.includes(l.id);
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => toggleLote(l.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    activo ? "border-brand-500 bg-brand-100 text-brand-700" : "border-paper-300 text-ink-600"
                  }`}
                >
                  {l.nombre}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => arrendamiento.mutate()}
            disabled={arrendamiento.isPending || loteIds.length < 2}
            className="rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
          >
            Generar ficha
          </button>
        </div>
      </div>

      <AnimatePresence>
        {ultimoReporte && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="mt-4 rounded-lg bg-risk-bajo-bg px-3.5 py-2 text-sm text-risk-bajo"
          >
            Reporte generado: {ultimoReporte.tipo} ({new Date(ultimoReporte.fechaGeneracion).toLocaleString("es-AR")})
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
