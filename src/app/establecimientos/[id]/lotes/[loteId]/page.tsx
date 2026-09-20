"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { ContextoEnsoChip } from "@/components/ContextoEnsoChip";
import { ListaActivos } from "@/components/ListaActivos";
import { ListaCultivos } from "@/components/ListaCultivos";
import { PanelZonasSuelo } from "@/components/PanelZonasSuelo";
import { PronosticoDiaADia } from "@/components/PronosticoDiaADia";
import { RiesgoChip } from "@/components/RiesgoChip";
import { Tooltip } from "@/components/Tooltip";
import { InfoAside } from "@/components/InfoAside";
import { api, clasificarError } from "@/lib/api";
import { guardarGeometriaPendiente } from "@/lib/geometria-pendiente";
import { explicarFactores } from "@/lib/explicar-riesgo";
import { useReubicarActivo } from "@/lib/hooks";
import { useToast } from "@/lib/toast-context";
import { revealVariants } from "@/lib/motion";
import type {
  Activo,
  Coordenada,
  CultivoImplantado,
  EvaluacionRiesgo,
  Lote,
  ZonaSuelo,
} from "@/lib/types";

const MapaLote = dynamic(() => import("@/components/MapaLote").then((m) => m.MapaLote), { ssr: false });

export default function LoteDetallePage({ params }: PageProps<"/establecimientos/[id]/lotes/[loteId]">) {
  const { id, loteId } = use(params);
  const autoDibujar = useSearchParams().get("dibujar") === "cultivo";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  // El sector de suelo se dibuja en el mapa y se completa en el panel de abajo, sin cambiar de
  // pantalla: a diferencia de un cultivo o un activo, el dato que sigue son cuatro numeros y
  // mandar al usuario a otra ruta por eso le costaria el contexto del mapa.
  const [anilloSueloPendiente, setAnilloSueloPendiente] = useState<Coordenada[] | null>(null);
  const [dibujandoSuelo, setDibujandoSuelo] = useState(false);

  const { data: lote } = useQuery({
    queryKey: ["lote", loteId],
    queryFn: () => api.get<Lote>(`/lotes/${loteId}`),
  });

  const { data: cultivos = [] } = useQuery({
    queryKey: ["cultivos", loteId],
    queryFn: () => api.get<CultivoImplantado[]>(`/lotes/${loteId}/cultivos`),
  });

  const { data: activos = [] } = useQuery({
    queryKey: ["activos", "lote", loteId],
    queryFn: () => api.get<Activo[]>(`/lotes/${loteId}/activos`),
  });

  // Para dibujarlos sobre el mapa. El panel de abajo los pide por su cuenta con la misma clave,
  // asi que react-query sirve una sola consulta para los dos.
  const { data: zonasSuelo = [] } = useQuery({
    queryKey: ["zonas-suelo", loteId],
    queryFn: () => api.get<ZonaSuelo[]>(`/lotes/${loteId}/zonas-suelo`),
  });

  // Solo para poder mover un activo movible a otro lote desde la edicion.

  const { data: evaluacion } = useQuery({
    queryKey: ["evaluacion-riesgo", loteId, "ultima"],
    queryFn: () => api.get<EvaluacionRiesgo>(`/lotes/${loteId}/evaluaciones-riesgo/ultima`),
    retry: false,
  });

  const borrarLote = useMutation({
    mutationFn: () => api.delete(`/lotes/${loteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes", id] });
      notificar("exito", "Lote eliminado");
      router.push(`/establecimientos/${id}/lotes`);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const reubicarActivo = useReubicarActivo(id);

  const evaluar = useMutation({
    mutationFn: () => api.post<EvaluacionRiesgo>(`/lotes/${loteId}/evaluaciones-riesgo`),
    onSuccess: (data) => queryClient.setQueryData(["evaluacion-riesgo", loteId, "ultima"], data),
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => evaluar.mutate() : undefined);
    },
  });

  if (!lote) return <p className="text-sm text-ink-600">Cargando...</p>;

  return (
    <motion.div initial="hidden" animate="visible" variants={revealVariants} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/establecimientos/${id}/lotes`} className="text-xs text-brand-600 underline underline-offset-2">
            ← Volver a los lotes
          </Link>
          <h1 className="font-display text-2xl font-medium text-ink-950">{lote.nombre}</h1>
          <p className="text-sm text-ink-600">
            {lote.tipoUso.toLowerCase()} · se anegó {lote.antecedentesAnegamientoUltimos10Anios ?? 0} de los últimos 10 años
          </p>
        </div>
        <div className="flex items-center gap-2">
          {evaluacion ? (
            <>
              <RiesgoChip score={evaluacion.scoreSusceptibilidad} />
              {evaluacion.factores.faseEnso && <ContextoEnsoChip fase={evaluacion.factores.faseEnso} />}
              <InfoAside titulo="Por qué este lote tiene este riesgo" etiqueta="Ver por qué">
                <dl className="space-y-3.5">
                  {explicarFactores(evaluacion.factores, lote.antecedentesAnegamientoUltimos10Anios).map((f) => (
                    <div key={f.etiqueta}>
                      <dt className="text-xs uppercase tracking-wide text-ink-600">
                        <Tooltip texto={f.ayuda}>{f.etiqueta}</Tooltip>
                      </dt>
                      <dd className="mt-0.5 text-sm text-ink-900">{f.lectura}</dd>
                    </div>
                  ))}
                </dl>
              </InfoAside>
            </>
          ) : (
            <button
              onClick={() => evaluar.mutate()}
              disabled={evaluar.isPending}
              className="rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              {evaluar.isPending ? "Evaluando..." : "Evaluar riesgo"}
            </button>
          )}
          <button
            onClick={() => setConfirmandoBorrado(true)}
            className="rounded-full border border-paper-300 px-3.5 py-1.5 text-sm text-ink-600 hover:border-risk-alto hover:text-risk-alto"
          >
            Borrar lote
          </button>
        </div>
      </div>

      <MapaLote
        lote={lote}
        cultivos={cultivos}
        activos={activos}
        onZonaDibujada={(anillo) => {
          // La geometria viaja por sessionStorage y no por la URL: un anillo de veinte vertices
          // deja una direccion ilegible y se rompe al recargar.
          guardarGeometriaPendiente({ anillo });
          router.push(`/establecimientos/${id}/lotes/${loteId}/cultivos/nuevo`);
        }}
        onActivoUbicado={(punto) => {
          guardarGeometriaPendiente({ punto });
          router.push(`/establecimientos/${id}/lotes/${loteId}/activos/nuevo`);
        }}
        onEditarCultivo={(cultivo) => router.push(`/establecimientos/${id}/lotes/${loteId}/cultivos/${cultivo.id}`)}
        onEditarActivo={(activo) => router.push(`/establecimientos/${id}/lotes/${loteId}/activos/${activo.id}`)}
        onActivoMovido={(activo, coordenada) => reubicarActivo.mutate({ activo, coordenada })}
        autoDibujar={autoDibujar}
        zonasSuelo={zonasSuelo}
        autoDibujarSuelo={dibujandoSuelo}
        onZonaSueloDibujada={(anillo) => {
          setDibujandoSuelo(false);
          setAnilloSueloPendiente(anillo);
        }}
        // El dibujo queda en pantalla y editable: el usuario corrige los vertices que se pasaron
        // en vez de volver a trazar todo desde cero.
        onRechazo={(motivo) => notificar("error-validacion", motivo)}
      />

      <PanelZonasSuelo
        loteId={loteId}
        anilloPendiente={anilloSueloPendiente}
        onAnilloConsumido={() => setAnilloSueloPendiente(null)}
        onPedirDibujo={() => setDibujandoSuelo(true)}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink-950">Zonas de cultivo</h2>
          <ListaCultivos loteId={loteId} cultivos={cultivos} onEditar={(cultivo) => router.push(`/establecimientos/${id}/lotes/${loteId}/cultivos/${cultivo.id}`)} />
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink-950">Activos en este lote</h2>
          <ListaActivos
            loteId={loteId}
            activos={activos}
            onEditar={(activo) => router.push(`/establecimientos/${id}/lotes/${loteId}/activos/${activo.id}`)}
          />
        </div>
      </div>

      {/* Lo que el lote necesita del pronostico no es el pronostico -que es igual en todo el
          predio, porque entra en una sola celda del modelo global- sino DONDE se junta el agua
          cada dia. El desglose meteorologico del predio vive en la pestania Meteorologia. */}
      <div className="min-w-0 space-y-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink-950">Acumulacion esperada, dia por dia</h2>
          <p className="max-w-2xl text-xs text-ink-600">
            Para cada dia del pronostico, donde se juntaria el agua en este lote. Cada dia se corre sobre el estado de
            suelo que dejan los anteriores: la misma lluvia no da lo mismo sobre un perfil seco que sobre uno cargado.
          </p>
        </div>
        {lote && <PronosticoDiaADia loteId={loteId} lotes={[lote]} />}
      </div>

      {/* La simulacion se unifico en la pestania Meteorologia: es una sola cosa y vive en un
          solo lugar, y ademas corre incluyendo el terreno de alrededor, que desde el lote suelto
          no se podia. Desde aca se entra con este lote ya seleccionado. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paper-300 bg-paper-50 p-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink-950">Simulacion hidrologica de anegamiento</h2>
          <p className="mt-1 max-w-xl text-xs text-ink-600">
            Balance de agua hora a hora sobre la elevacion real, incluyendo el terreno vecino que drena hacia el
            lote. Se corre desde Meteorologia, donde tambien podes compararlo con el resto del predio.
          </p>
        </div>
        <Link
          href={`/establecimientos/${id}/meteorologia`}
          className="shrink-0 rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          Simular este lote →
        </Link>
      </div>

      <ConfirmarBorrado
        abierto={confirmandoBorrado}
        titulo={`Borrar "${lote.nombre}"`}
        queSeBorra={`Se borran tambien ${cultivos.length} zona(s) de cultivo, ${activos.length} activo(s) y las evaluaciones de riesgo del lote.`}
        borrando={borrarLote.isPending}
        onConfirmar={() => borrarLote.mutate()}
        onCerrar={() => setConfirmandoBorrado(false)}
      />

    </motion.div>
  );
}
