"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api, clasificarError, descargarArchivo } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import type { InformeElegibilidad, Reporte } from "@/lib/types";

/** Los reportes institucionales que reutilizan el motor de riesgo/priorizacion ya calculado (caso Aguirre). */
const ETIQUETA_TIPO: Record<string, string> = {
  EMERGENCIA_AGROPECUARIA: "Emergencia agropecuaria",
  IMPACTO_ECONOMICO: "Impacto económico",
};

export function PanelReportes({ establecimientoId }: { establecimientoId: string }) {
  const { notificar } = useToast();
  const queryClient = useQueryClient();

  const { data: emitidos = [] } = useQuery({
    queryKey: ["reportes", establecimientoId],
    queryFn: () => api.get<Reporte[]>(`/establecimientos/${establecimientoId}/reportes`),
  });
  const { data: elegibilidad } = useQuery({
    queryKey: ["reportes", establecimientoId, "elegibilidad"],
    queryFn: () => api.get<InformeElegibilidad>(`/establecimientos/${establecimientoId}/reportes/emergencia-agropecuaria/elegibilidad`),
  });
  const [ultimoReporte, setUltimoReporte] = useState<Reporte | null>(null);

  const descargar = async (reporte: Reporte) => {
    try {
      await descargarArchivo(
        `/establecimientos/${establecimientoId}/reportes/${reporte.id}/archivo`,
        "reporte.pdf",
      );
    } catch (e) {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    }
  };

  const emergencia = useMutation({
    mutationFn: () => api.post<Reporte>(`/establecimientos/${establecimientoId}/reportes/emergencia-agropecuaria`),
    onSuccess: (reporte) => {
      setUltimoReporte(reporte);
      queryClient.invalidateQueries({ queryKey: ["reportes", establecimientoId] });
      // Se baja solo: generar y descargar son un unico gesto para el usuario.
      void descargar(reporte);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => emergencia.mutate() : undefined);
    },
  });

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <p className="text-sm uppercase tracking-wide text-brand-600">Documentos</p>
      <h2 className="font-display text-lg font-medium text-ink-950">Reportes</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">
        Documentos en PDF armados con el analisis que el sistema ya tiene de tu campo, para presentar ante un
        tercero: un organismo o una aseguradora.
      </p>

      <div className="mt-5 grid gap-4">
        <div className="space-y-2.5 rounded-xl border border-paper-300 bg-paper-100/50 p-4">
          <p className="text-sm font-medium text-ink-900">Emergencia agropecuaria</p>
          <p className="text-xs text-ink-600">
            Documenta la evaluación como evidencia para el trámite de la Ley 26.509. Requiere un plan de acción
            generado previamente.
          </p>
          {elegibilidad && !elegibilidad.puedeGenerar && (
            <p className="rounded-lg bg-paper-200/60 px-2.5 py-1.5 text-xs text-ink-600">{elegibilidad.motivo}</p>
          )}
          {elegibilidad?.puedeGenerar && (
            <p className="text-xs text-risk-bajo">{elegibilidad.motivo}</p>
          )}
          <button
            onClick={() => emergencia.mutate()}
            disabled={emergencia.isPending || elegibilidad?.puedeGenerar === false}
            className="rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
          >
            Generar informe
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
            El PDF se descargo. Si tu navegador lo bloqueo, esta en la lista de abajo.
          </motion.p>
        )}
      </AnimatePresence>

      {emitidos.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-paper-300 pt-4">
          <p className="text-xs font-medium text-ink-800">Documentos emitidos</p>
          <ul className="space-y-1.5">
            {emitidos.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper-300 bg-paper-100/60 px-3 py-2"
              >
                <span className="text-xs text-ink-800">
                  {ETIQUETA_TIPO[r.tipo] ?? r.tipo}
                  <span className="text-ink-600">
                    {" "}
                    · {new Date(r.fechaGeneracion).toLocaleDateString("es-AR")}
                  </span>
                </span>
                <button
                  onClick={() => void descargar(r)}
                  className="rounded-full border border-brand-500 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  Descargar PDF
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
