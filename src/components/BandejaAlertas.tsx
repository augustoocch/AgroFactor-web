"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { revealVariants } from "@/lib/motion";
import { InfoModal } from "@/components/InfoModal";
import type { Alerta, NivelAlerta } from "@/lib/types";

const ESTILO_NIVEL: Record<NivelAlerta, { borde: string; texto: string; etiqueta: string }> = {
  CRITICA: { borde: "border-risk-alto", texto: "text-risk-alto", etiqueta: "Critica" },
  ATENCION: { borde: "border-risk-medio", texto: "text-risk-medio", etiqueta: "Atencion" },
  INFORMATIVA: { borde: "border-paper-300", texto: "text-ink-600", etiqueta: "Informativa" },
};

/**
 * Alertas anticipadas del establecimiento. Se generan solas todas las madrugadas corriendo la
 * simulacion sobre el pronostico real; el boton solo adelanta esa corrida.
 */
export function BandejaAlertas({ establecimientoId }: { establecimientoId: string }) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas", establecimientoId],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${establecimientoId}/alertas`),
  });

  const revisar = useMutation({
    mutationFn: () => api.post<Alerta[]>(`/establecimientos/${establecimientoId}/alertas/revisar`),
    onSuccess: (nuevas) => {
      queryClient.setQueryData(["alertas", establecimientoId], nuevas);
      notificar("exito", nuevas.length > 0 ? `${nuevas.length} alerta(s) al dia` : "Sin anegamiento previsto");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-lg font-medium text-ink-950">Alertas de anegamiento</h2>
          <InfoModal titulo="De donde salen estas alertas">
            <p>
              Todas las madrugadas se corre la simulacion hidrologica de cada lote sobre el pronostico real de las
              proximas 48 horas. Si el resultado cruza los umbrales, se emite una alerta.
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li><strong>Critica</strong>: mas del 40% del lote anegado, o mas de 20 cm de lamina.</li>
              <li><strong>Atencion</strong>: mas del 15% del lote anegado.</li>
              <li><strong>Informativa</strong>: hay anegamiento previsto, por debajo de esos valores.</li>
            </ul>
            <p className="text-xs text-ink-600">
              El horizonte es corto a proposito: los pronosticos a mas largo plazo no son confiables, asi que no se
              alerta sobre ellos.
            </p>
          </InfoModal>
        </div>
        <button
          onClick={() => revisar.mutate()}
          disabled={revisar.isPending}
          className="rounded-full border border-brand-500 px-3.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
        >
          {revisar.isPending ? "Revisando..." : "Revisar ahora"}
        </button>
      </div>

      {isLoading && <p className="text-sm text-ink-600">Cargando alertas...</p>}

      {!isLoading && alertas.length === 0 && (
        <p className="rounded-xl border border-dashed border-paper-300 p-5 text-center text-sm text-ink-600">
          Sin alertas. No hay anegamiento previsto para las proximas 48 horas.
        </p>
      )}

      <ul className="space-y-2">
        {alertas.map((alerta, i) => {
          const estilo = ESTILO_NIVEL[alerta.nivel];
          return (
            <motion.li
              key={alerta.id}
              initial="hidden"
              animate="visible"
              custom={i}
              variants={revealVariants}
              className={`rounded-xl border-l-4 ${estilo.borde} border-y border-r border-paper-300 bg-paper-50 p-4`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink-950">{alerta.loteNombre}</p>
                <span className={`text-xs font-medium uppercase tracking-wide ${estilo.texto}`}>{estilo.etiqueta}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-700">
                <span>{(alerta.laminaMaximaEsperadaMm / 10).toFixed(1)} cm de lamina</span>
                <span>{alerta.superficieAnegadaPct.toFixed(0)}% del lote</span>
                <span>pico en {alerta.horasHastaPico} h</span>
                <span>{alerta.lluviaPronosticadaMm.toFixed(0)} mm previstos</span>
              </div>

              <p className="mt-2 text-sm leading-snug text-ink-700">{alerta.mensaje}</p>

              <Link
                href={`/establecimientos/${establecimientoId}/lotes/${alerta.loteId}`}
                className="mt-2 inline-block text-xs font-medium text-brand-700 underline underline-offset-2"
              >
                Ver el lote →
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
