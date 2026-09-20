"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api, clasificarError } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import { InfoModal } from "@/components/InfoModal";
import { Tooltip } from "@/components/Tooltip";
import { desglosarCriterios, explicarPosicion } from "@/lib/explicar-prioridad";
import type { AccionRecomendada, Establecimiento, PlanAccion } from "@/lib/types";

/**
 * El desglose criterio por criterio, plegado.
 *
 * El titulo dice lo que el usuario se pregunta al ver la lista ("por que este activo esta aca")
 * y no como esta hecho el calculo por dentro. Cada criterio lleva su aclaracion en el hover, asi
 * que el bloque no necesita ningun parrafo al pie.
 */
function ComoSeCalculo({ item }: { item: AccionRecomendada }) {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer list-none text-xs text-brand-700 underline underline-offset-2">
        Por qué está en este lugar
      </summary>
      <dl className="mt-2 space-y-1 border-l-2 border-paper-300 pl-3">
        {desglosarCriterios(item.justificacion, item.movilidad).map((d) => (
          <div key={d.criterio} className="flex flex-wrap gap-x-2 text-xs">
            <dt className="text-ink-600">
              <Tooltip texto={d.ayuda}>{d.criterio}</Tooltip>
            </dt>
            <dd className="text-ink-800">{d.lectura}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Siempre muestra la justificacion por criterio junto al orden: el sistema es informacion y escenarios auditables, no una prescripcion cerrada. */
export function PanelPlanAccion({ establecimientoId }: { establecimientoId: string }) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  // Los pesos deciden que criterio se nombra primero en la explicacion de cada activo.
  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", establecimientoId],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${establecimientoId}`),
  });

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
            <InfoModal titulo="Cómo leer esta lista">
              <p>
                La lista es una sugerencia de por dónde empezar, no una indicación de qué hacer. Ordena tus activos
                mirando cuánto valen, qué tan expuesto está el lote de cada uno, cuánto cuesta moverlos y cuánto se
                recupera si el agua los alcanza.
              </p>
              <p>La decisión es tuya: vos conocés el campo y el momento, el sistema no.</p>
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
              const explicacion = establecimiento
                ? explicarPosicion(item, establecimiento.pesosPrioridad)
                : null;
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
                    {/* La plata en riesgo reemplaza al score 0-1, que solo servia para ordenar y
                        no significa nada en terminos absolutos. */}
                    {item.valorEnRiesgo != null && (
                      <span className={esPrincipal ? "text-sm font-medium text-clay-600" : "text-sm text-ink-700"}>
                        USD {Math.round(item.valorEnRiesgo).toLocaleString("es-AR")} en riesgo
                      </span>
                    )}
                  </div>
                  {explicacion && <p className="mt-2 text-sm text-ink-700">{explicacion}</p>}
                  <p className="mt-2.5 text-sm font-medium text-ink-900">{item.recomendacion}</p>
                  <ComoSeCalculo item={item} />
                </motion.li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
