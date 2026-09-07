"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api, clasificarError } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import { InfoModal } from "@/components/InfoModal";
import type { PlanAccion } from "@/lib/types";

const CRITERIOS: { key: "aporteImpacto" | "aporteUrgencia" | "aporteRecursos" | "aporteReversibilidad"; label: string; color: string }[] = [
  { key: "aporteImpacto", label: "Impacto", color: "var(--color-brand-600)" },
  { key: "aporteUrgencia", label: "Urgencia", color: "var(--color-risk-alto)" },
  { key: "aporteRecursos", label: "Recursos", color: "var(--color-clay-500)" },
  { key: "aporteReversibilidad", label: "Reversibilidad", color: "var(--color-risk-medio)" },
];

function BarraCriterio({ label, valor, color, delay }: { label: string; valor: number; color: string; delay: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-ink-600">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-200">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(valor, 1) * 100}%` }}
          transition={{ duration: 0.7, delay, ease: easeOutExpo }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs text-ink-600">{valor.toFixed(2)}</span>
    </div>
  );
}

/** Siempre muestra la justificacion por criterio junto al orden: el sistema es informacion y escenarios auditables, no una prescripcion cerrada. */
export function PanelPlanAccion({ establecimientoId }: { establecimientoId: string }) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: plan } = useQuery({
    queryKey: ["plan-accion", establecimientoId],
    queryFn: () => api.get<PlanAccion>(`/establecimientos/${establecimientoId}/planes-accion/ultimo`),
    retry: false,
  });

  const generar = useMutation({
    mutationFn: () => api.post<PlanAccion>(`/establecimientos/${establecimientoId}/planes-accion`),
    onSuccess: (nuevoPlan) => {
      queryClient.setQueryData(["plan-accion", establecimientoId], nuevoPlan);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => generar.mutate() : undefined);
    },
  });

  return (
    <div className="space-y-5 rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm uppercase tracking-wide text-brand-600">Qué atender primero</p>
            <InfoModal titulo="Por qué este plan no es una prescripción">
              <p>
                El sistema no dice &ldquo;haga esto&rdquo;: ordena los activos por un puntaje calculado con reglas visibles
                (impacto económico, urgencia por riesgo del lote, recursos necesarios para movilizarlo y
                reversibilidad del daño) y muestra el aporte de cada criterio para cada activo.
              </p>
              <p>
                Es una decisión deliberada: un sistema que prescribe acciones de manejo agropecuario puede quedar
                encuadrado como asesoramiento profesional matriculado, y la decisión final —con el contexto local
                que el sistema no ve— siempre queda en el productor o el asesor.
              </p>
            </InfoModal>
          </div>
          <h2 className="font-display text-lg font-medium text-ink-950">Plan de acción priorizado</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-600">
            Si hay que sacar cosas del campo antes de una inundación, no se puede con todo a la vez. Esta lista
            ordena tus activos por cuánto conviene atender cada uno primero, y muestra de dónde sale ese orden.
          </p>
        </div>
        <button
          onClick={() => generar.mutate()}
          disabled={generar.isPending}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {generar.isPending ? "Calculando..." : "Generar / recalcular"}
        </button>
      </div>

      {!plan && (
        <div className="rounded-xl border border-dashed border-paper-300 p-6 text-center">
          <p className="text-sm text-ink-700">Todavía no calculaste el orden de prioridad.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-600">
            Se calcula con los activos que tengas cargados y el riesgo de cada lote. Si todavía no cargaste activos,
            hacelo desde la pantalla de cada lote.
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {plan && (
          <motion.ol
            key={plan.id}
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            {plan.items.map((item) => {
              const esPrincipal = item.orden === 1;
              return (
                <motion.li
                  key={item.activoId}
                  variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOutExpo } } }}
                  className={
                    esPrincipal
                      ? "rounded-xl border border-clay-500 bg-clay-100/60 p-4"
                      : "rounded-xl border border-paper-300 bg-paper-100/60 p-3.5"
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          esPrincipal
                            ? "flex h-8 w-8 items-center justify-center rounded-full bg-clay-500 font-mono text-sm font-medium text-paper-50"
                            : "flex h-7 w-7 items-center justify-center rounded-full bg-paper-200 font-mono text-xs text-ink-700"
                        }
                      >
                        {item.orden}
                      </span>
                      <span className={esPrincipal ? "font-display text-base font-medium text-ink-950" : "text-sm font-medium text-ink-900"}>
                        {item.activoNombre}
                      </span>
                    </div>
                    <span className="font-mono text-sm text-ink-600">{item.scorePrioridad.toFixed(2)}</span>
                  </div>
                  <p className="mt-2.5 text-sm text-ink-800">{item.recomendacion}</p>
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {CRITERIOS.map((c, i) => (
                      <BarraCriterio
                        key={c.key}
                        label={c.label}
                        valor={item.justificacion[c.key]}
                        color={c.color}
                        delay={0.15 + i * 0.05}
                      />
                    ))}
                  </div>
                </motion.li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
