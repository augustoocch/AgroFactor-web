"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { use, useState } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { InfoAside } from "@/components/InfoAside";
import { Tooltip } from "@/components/Tooltip";
import { api, clasificarError } from "@/lib/api";
import { boton, enlace, tarjeta } from "@/lib/estilos";
import { desglosarCriterios, explicarPosicion } from "@/lib/explicar-prioridad";
import { easeOutExpo } from "@/lib/motion";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type { AccionRecomendada, Establecimiento, PesosPrioridad, PlanAccion } from "@/lib/types";

/**
 * Plan de accion priorizado (user flow 2, cierre). Muestra el orden, la plata en juego y POR QUE
 * cada activo esta donde esta: el sistema es informacion auditable, no una prescripcion cerrada.
 *
 * El ajuste de pesos existia en el backend (`PUT /pesos-prioridad`) y el story mapping lo pide
 * ("que el plan refleje mi criterio y no uno generico"), pero no tenia pantalla. Vive en un panel
 * lateral para no competir con la lista: se usa de vez en cuando, la lista todo el tiempo.
 */
export default function PlanAccionPage({ params }: PageProps<"/establecimientos/[id]/plan-accion">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });

  const { data: plan, isPending } = useQuery({
    queryKey: ["plan-accion", id],
    queryFn: () => api.get<PlanAccion>(`/establecimientos/${id}/planes-accion/ultimo`),
    retry: false,
  });

  const generar = useMutation({
    mutationFn: () => api.post<PlanAccion>(`/establecimientos/${id}/planes-accion`),
    onSuccess: (nuevoPlan) => queryClient.setQueryData(["plan-accion", id], nuevoPlan),
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => generar.mutate() : undefined);
    },
  });

  const total = plan?.items.reduce((acc, i) => acc + (i.valorEnRiesgo ?? 0), 0) ?? 0;

  return (
    <div>
      <EncabezadoPantalla
        segmento="plan-accion"
        titulo="Plan de acción"
        descripcion="Si hay que proteger cosas antes de que llegue el agua, no se puede con todo a la vez. Esta lista ordena tus activos por cuánto conviene atender cada uno primero."
        ayuda={
          <InfoAside titulo="Cómo leer esta lista" etiqueta="Cómo se arma el orden">
            <p>
              El orden combina cuatro criterios: cuánto vale el activo, qué tan expuesto está su lote, cuánto cuesta
              moverlo y cuánto se recupera si el agua lo alcanza.
            </p>
            <p>
              Es una sugerencia de por dónde empezar, no una indicación de qué hacer. Vos conocés el campo y el momento;
              el sistema no. Si tu criterio es otro, cambiá cuánto pesa cada cosa con “Ajustar prioridades”.
            </p>
          </InfoAside>
        }
        acciones={
          <>
            {establecimiento && (
              <AjustarPrioridades
                establecimientoId={id}
                pesos={establecimiento.pesosPrioridad}
                onGuardado={() => plan && generar.mutate()}
              />
            )}
            <button onClick={() => generar.mutate()} disabled={generar.isPending} className={boton.primario}>
              {generar.isPending ? "Calculando..." : plan ? "Recalcular" : "Armar el plan"}
            </button>
          </>
        }
      />

      {!isPending && !plan && (
        <div className="rounded-xl border border-dashed border-paper-300 px-6 py-10 text-center">
          <p className="font-display text-lg text-ink-950">Todavía no hay un plan</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            Se arma con los activos cargados y el riesgo de cada lote. Si todavía no cargaste activos, hacelo desde{" "}
            <Link href={rutaDe(id, "lotes")} className={enlace}>
              el mapa de cada lote
            </Link>
            .
          </p>
        </div>
      )}

      {plan && (
        <>
          <div className="mb-8 flex flex-wrap items-end gap-x-12 gap-y-4">
            {total > 0 && (
              <div className="border-l-2 border-clay-500 pl-4">
                <p className="font-display text-3xl font-medium tabular-nums text-ink-950">
                  USD {Math.round(total).toLocaleString("es-AR")}
                </p>
                <p className="text-sm text-ink-600">en riesgo, sumando todos los activos</p>
              </div>
            )}
            <p className="text-sm text-ink-600">
              {plan.items.length} activos · calculado el {new Date(plan.fecha).toLocaleDateString("es-AR")}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.ol
              key={plan.id}
              className="space-y-3"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {plan.items.map((item) => (
                <ItemPlan
                  key={item.activoId}
                  item={item}
                  explicacion={establecimiento ? explicarPosicion(item, establecimiento.pesosPrioridad) : null}
                />
              ))}
            </motion.ol>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function ItemPlan({ item, explicacion }: { item: AccionRecomendada; explicacion: string | null }) {
  const esPrincipal = item.orden === 1;
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOutExpo } },
      }}
      className={`${esPrincipal ? "rounded-xl border border-clay-400 bg-clay-100/50" : tarjeta} p-5`}
    >
      <div className="flex gap-4">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full font-mono ${
            esPrincipal ? "h-9 w-9 bg-clay-500 text-sm text-paper-50" : "h-8 w-8 bg-paper-200 text-xs text-ink-700"
          }`}
        >
          {item.orden}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className={esPrincipal ? "font-display text-lg font-medium text-ink-950" : "font-medium text-ink-950"}>
              {item.activoNombre}
            </p>
            {/* La plata en riesgo reemplaza al score 0-1, que solo sirve para ordenar. */}
            {item.valorEnRiesgo != null && (
              <span className={`font-mono text-sm tabular-nums ${esPrincipal ? "font-medium text-clay-600" : "text-ink-700"}`}>
                USD {Math.round(item.valorEnRiesgo).toLocaleString("es-AR")} en riesgo
              </span>
            )}
          </div>
          <p className="mt-1.5 font-medium text-ink-900">{item.recomendacion}</p>
          {explicacion && <p className="mt-1 text-sm leading-relaxed text-ink-600">{explicacion}</p>}

          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-sm text-brand-700 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Por qué está en este lugar</span>
              <span className="hidden group-open:inline">Ocultar el detalle</span>
            </summary>
            <dl className="mt-2 grid gap-x-6 gap-y-2 border-l-2 border-paper-300 pl-4 sm:grid-cols-2">
              {desglosarCriterios(item.justificacion, item.movilidad).map((d) => (
                <div key={d.criterio} className="text-sm">
                  <dt className="text-xs text-ink-600">
                    <Tooltip texto={d.ayuda}>{d.criterio}</Tooltip>
                  </dt>
                  <dd className="text-ink-800">{d.lectura}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </div>
    </motion.li>
  );
}

const CRITERIOS: { clave: keyof PesosPrioridad; nombre: string; ayuda: string }[] = [
  { clave: "impacto", nombre: "Cuánto vale", ayuda: "Los activos más caros suben en la lista." },
  { clave: "urgencia", nombre: "Riesgo del lote", ayuda: "Lo que está en los lotes más expuestos sube." },
  { clave: "recursos", nombre: "Facilidad de moverlo", ayuda: "Lo que se saca rápido y barato sube." },
  { clave: "reversibilidad", nombre: "Si se pierde", ayuda: "Lo que no se recupera si el agua lo alcanza sube." },
];

const PALABRA_PESO = (v: number) => (v >= 0.75 ? "pesa mucho" : v >= 0.4 ? "pesa algo" : v > 0 ? "pesa poco" : "no cuenta");

/** Los cuatro pesos del orden, con el efecto de cada uno dicho en palabras. */
function AjustarPrioridades({
  establecimientoId,
  pesos,
  onGuardado,
}: {
  establecimientoId: string;
  pesos: PesosPrioridad;
  onGuardado: () => void;
}) {
  return (
    <InfoAside titulo="Ajustar prioridades" etiqueta="Ajustar prioridades" antetitulo="Tu criterio">
      {(cerrar) => (
        <FormularioPesos
          key={JSON.stringify(pesos)}
          establecimientoId={establecimientoId}
          pesos={pesos}
          onGuardado={() => {
            onGuardado();
            cerrar();
          }}
        />
      )}
    </InfoAside>
  );
}

function FormularioPesos({
  establecimientoId,
  pesos,
  onGuardado,
}: {
  establecimientoId: string;
  pesos: PesosPrioridad;
  onGuardado: () => void;
}) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [valores, setValores] = useState<PesosPrioridad>(pesos);
  const cambio = CRITERIOS.some((c) => valores[c.clave] !== pesos[c.clave]);

  const guardar = useMutation({
    mutationFn: () => api.put<Establecimiento>(`/establecimientos/${establecimientoId}/pesos-prioridad`, valores),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(["establecimiento", establecimientoId], actualizado);
      notificar("exito", "Prioridades guardadas, recalculando el plan");
      onGuardado();
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <div className="space-y-6">
      <p>
        Cuánto pesa cada criterio al ordenar la lista. Al guardar, el plan se vuelve a calcular con tu criterio.
      </p>
      {CRITERIOS.map((c) => (
        <div key={c.clave}>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`peso-${c.clave}`} className="font-medium text-ink-950">
              {c.nombre}
            </label>
            <span className="text-xs text-ink-600">{PALABRA_PESO(valores[c.clave])}</span>
          </div>
          <p className="text-xs text-ink-600">{c.ayuda}</p>
          <input
            id={`peso-${c.clave}`}
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={valores[c.clave]}
            onChange={(e) => setValores((v) => ({ ...v, [c.clave]: Number(e.target.value) }))}
            className="mt-2 w-full accent-[var(--color-brand-700)]"
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-2 border-t border-paper-200 pt-4">
        <button onClick={() => guardar.mutate()} disabled={!cambio || guardar.isPending} className={boton.primario}>
          {guardar.isPending ? "Guardando..." : "Guardar y recalcular"}
        </button>
        <button onClick={() => setValores(pesos)} disabled={!cambio} className={boton.sutil}>
          Deshacer cambios
        </button>
      </div>
    </div>
  );
}
