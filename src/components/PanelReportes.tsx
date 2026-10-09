"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api, clasificarError, descargarArchivo } from "@/lib/api";
import { boton } from "@/lib/estilos";
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
    <div className="space-y-10">
      <section className="grid gap-6 rounded-xl border border-paper-300 bg-paper-50 p-6 md:grid-cols-12">
        <div className="md:col-span-8">
          <h2 className="font-display text-lg font-medium text-ink-950">Informe de emergencia agropecuaria</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Documenta el daño declarado, su cálculo y el agua que registró el sistema, como evidencia para el trámite
            de la Ley 26.509. Necesita un plan de acción armado previamente.
          </p>
          {elegibilidad && (
            <p
              className={`mt-3 text-sm ${elegibilidad.puedeGenerar ? "text-risk-bajo-ink" : "rounded-lg bg-paper-200/70 px-3 py-2 text-ink-700"}`}
            >
              {elegibilidad.motivo}
            </p>
          )}
        </div>
        <div className="flex items-start md:col-span-4 md:justify-end">
          <button
            onClick={() => emergencia.mutate()}
            disabled={emergencia.isPending || elegibilidad?.puedeGenerar === false}
            className={boton.primario}
          >
            {emergencia.isPending ? "Generando..." : "Generar y descargar"}
          </button>
        </div>
      </section>

      <AnimatePresence>
        {ultimoReporte && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="rounded-lg bg-risk-bajo-bg px-4 py-2.5 text-sm text-risk-bajo-ink"
          >
            El PDF se descargó. Si el navegador lo bloqueó, está en la lista de abajo.
          </motion.p>
        )}
      </AnimatePresence>

      <section>
        <h2 className="font-display text-lg font-medium text-ink-950">Documentos emitidos</h2>
        {emitidos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">Todavía no se emitió ningún documento.</p>
        ) : (
          <ul className="mt-4 divide-y divide-paper-200 rounded-xl border border-paper-300 bg-paper-50">
            {emitidos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-ink-950">{ETIQUETA_TIPO[r.tipo] ?? r.tipo}</p>
                  <p className="text-sm text-ink-600">
                    {new Date(r.fechaGeneracion).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <button onClick={() => void descargar(r)} className={boton.sutil}>
                  Descargar PDF
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
