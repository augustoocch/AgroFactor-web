"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { TituloSeccion } from "@/components/EncabezadoPantalla";
import { Icono } from "@/components/Icono";
import { PronosticoDiaADia } from "@/components/PronosticoDiaADia";
import { Tooltip } from "@/components/Tooltip";
import { api, clasificarError } from "@/lib/api";
import { boton, enlace, tarjeta } from "@/lib/estilos";
import { explicarFactores, nivelRiesgo } from "@/lib/explicar-riesgo";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type { Alerta, EvaluacionRiesgo, Lote } from "@/lib/types";

const LECTURA_NIVEL: Record<"alto" | "medio" | "bajo", { titulo: string; texto: string; color: string }> = {
  alto: {
    titulo: "Riesgo alto",
    texto: "Es de los primeros lotes del campo en juntar agua. Conviene mirarlo antes que el resto.",
    color: "var(--color-risk-alto)",
  },
  medio: {
    titulo: "Riesgo medio",
    texto: "Se anega con lluvias importantes, no con cualquiera.",
    color: "var(--color-risk-medio)",
  },
  bajo: {
    titulo: "Riesgo bajo",
    texto: "Hace falta una lluvia excepcional para que junte agua.",
    color: "var(--color-risk-bajo)",
  },
};

/**
 * Pestaña de riesgo del lote: que tan propenso es a anegarse, por que, y donde se juntaria el
 * agua los proximos dias. Es lo que se consulta durante un evento, asi que va primero.
 */
export default function LoteRiesgoPage({ params }: PageProps<"/establecimientos/[id]/lotes/[loteId]">) {
  const { id, loteId } = use(params);
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: lote } = useQuery({
    queryKey: ["lote", loteId],
    queryFn: () => api.get<Lote>(`/lotes/${loteId}`),
  });
  const { data: evaluacion, isPending: cargandoEvaluacion } = useQuery({
    queryKey: ["evaluacion-riesgo", loteId, "ultima"],
    queryFn: () => api.get<EvaluacionRiesgo>(`/lotes/${loteId}/evaluaciones-riesgo/ultima`),
    retry: false,
  });
  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas", id],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${id}/alertas`),
  });
  const alerta = alertas.find((a) => a.loteId === loteId);

  const evaluar = useMutation({
    mutationFn: () => api.post<EvaluacionRiesgo>(`/lotes/${loteId}/evaluaciones-riesgo`),
    onSuccess: (data) => queryClient.setQueryData(["evaluacion-riesgo", loteId, "ultima"], data),
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => evaluar.mutate() : undefined);
    },
  });

  if (!lote) return <div className="h-64 animate-pulse rounded-xl bg-paper-200" />;

  const nivel = evaluacion ? LECTURA_NIVEL[nivelRiesgo(evaluacion.scoreSusceptibilidad)] : null;

  return (
    <div className="space-y-12">
      {alerta && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-paper-300 border-l-risk-alto bg-risk-alto-bg/50 px-5 py-4">
          <p className="text-sm text-ink-900">
            <strong className="font-medium">Alerta activa:</strong> hasta {(alerta.laminaMaximaEsperadaMm / 10).toFixed(0)} cm
            de agua sobre el {alerta.superficieAnegadaPct.toFixed(0)}% del lote en {alerta.horasHastaPico} horas.
          </p>
          <Link href={rutaDe(id, "plan-accion")} className={`${enlace} text-sm`}>
            Qué proteger primero
          </Link>
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {cargandoEvaluacion ? (
            <div className="h-40 animate-pulse rounded-xl bg-paper-200" />
          ) : nivel && evaluacion ? (
            <div className="border-l-4 pl-5" style={{ borderColor: nivel.color }}>
              <p className="font-display text-3xl font-medium text-ink-950">{nivel.titulo}</p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-700">{nivel.texto}</p>
              <p className="mt-4 text-sm text-ink-600">
                Calculado el {new Date(evaluacion.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
              </p>
              <button onClick={() => evaluar.mutate()} disabled={evaluar.isPending} className={`${boton.sutil} mt-3`}>
                {evaluar.isPending ? "Calculando..." : "Volver a calcular"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-paper-300 p-6">
              <p className="font-display text-lg text-ink-950">Riesgo sin calcular</p>
              <p className="mt-1 text-sm text-ink-600">
                Se calcula con el relieve del lote, su suelo, la lluvia reciente y la pronosticada. Tarda unos segundos.
              </p>
              <button onClick={() => evaluar.mutate()} disabled={evaluar.isPending} className={`${boton.primario} mt-4`}>
                {evaluar.isPending ? "Calculando..." : "Calcular el riesgo"}
              </button>
            </div>
          )}
        </div>

        {evaluacion && (
          <div className="lg:col-span-7">
            <h2 className="mb-3 text-sm font-medium text-ink-900">Por qué este nivel</h2>
            <dl className={`${tarjeta} divide-y divide-paper-200`}>
              {explicarFactores(evaluacion.factores, lote.antecedentesAnegamientoUltimos10Anios).map((f) => (
                <div key={f.etiqueta} className="grid gap-1 px-4 py-3 sm:grid-cols-5 sm:gap-4">
                  <dt className="text-sm text-ink-600 sm:col-span-2">
                    <Tooltip texto={f.ayuda}>{f.etiqueta}</Tooltip>
                  </dt>
                  <dd className="text-sm text-ink-900 sm:col-span-3">{f.lectura}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <section>
        <TituloSeccion
          titulo="Dónde se juntaría el agua, día por día"
          descripcion="Cada día se calcula sobre el suelo que dejan los anteriores: la misma lluvia no da lo mismo sobre un suelo seco que sobre uno cargado."
        />
        <PronosticoDiaADia loteId={loteId} lotes={[lote]} />
      </section>

      <Link
        href={`${rutaDe(id, "simulacion")}?lote=${loteId}`}
        className={`${tarjeta} group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:border-brand-500`}
      >
        <div>
          <p className="font-medium text-ink-950">Probar un escenario de lluvia sobre este lote</p>
          <p className="text-sm text-ink-600">
            Elegí cuánto llueve y mirá hora a hora dónde se junta el agua, incluyendo la que baja del terreno vecino.
          </p>
        </div>
        <Icono nombre="derecha" className="h-5 w-5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
      </Link>
    </div>
  );
}
