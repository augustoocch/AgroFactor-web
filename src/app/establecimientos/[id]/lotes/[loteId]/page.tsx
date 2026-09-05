"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ActivoForm } from "@/components/ActivoForm";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { CultivoForm } from "@/components/CultivoForm";
import { ListaCultivos } from "@/components/ListaCultivos";
import { PanelClima } from "@/components/PanelClima";
import { RiesgoChip } from "@/components/RiesgoChip";
import { InfoModal } from "@/components/InfoModal";
import { api, clasificarError } from "@/lib/api";
import { useReubicarActivo } from "@/lib/hooks";
import { useToast } from "@/lib/toast-context";
import { revealVariants } from "@/lib/motion";
import type { ParametrosSimulacion } from "@/components/SimulacionInundacion";
import type {
  Activo,
  Coordenada,
  CultivoImplantado,
  EvaluacionRiesgo,
  Lote,
  SimulacionInundacion as Simulacion,
} from "@/lib/types";

const MapaLote = dynamic(() => import("@/components/MapaLote").then((m) => m.MapaLote), { ssr: false });
const SimulacionInundacion = dynamic(
  () => import("@/components/SimulacionInundacion").then((m) => m.SimulacionInundacion),
  { ssr: false },
);

/** Valores de arranque: la lluvia es un evento fuerte pero plausible en la region; el resto se
 * pisa con el dato real medido apenas responde el backend (ver `onRestablecer`). */
const PARAMETROS_INICIALES: ParametrosSimulacion = {
  modo: "real",
  escenarioLluviaMm: 100,
  horas: 24,
  vientoKmh: 15,
  direccionVientoDeg: 180,
  lluvia5DiasMm: 30,
  humedadSueloM3m3: 0.3,
};

export default function LoteDetallePage({ params }: PageProps<"/establecimientos/[id]/lotes/[loteId]">) {
  const { id, loteId } = use(params);
  const autoDibujar = useSearchParams().get("dibujar") === "cultivo";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [anilloNuevaZona, setAnilloNuevaZona] = useState<Coordenada[] | null>(null);
  const [cultivoAEditar, setCultivoAEditar] = useState<CultivoImplantado | null>(null);
  const [ubicacionNuevoActivo, setUbicacionNuevoActivo] = useState<Coordenada | null>(null);
  const [activoAEditar, setActivoAEditar] = useState<Activo | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [parametrosSim, setParametrosSim] = useState<ParametrosSimulacion>(PARAMETROS_INICIALES);
  const [parametrosAplicados, setParametrosAplicados] = useState<ParametrosSimulacion>(PARAMETROS_INICIALES);
  const [simulacionActiva, setSimulacionActiva] = useState(false);

  // La simulacion se recalcula sola al soltar un slider (el backend cachea la elevacion y el
  // clima, asi que recalcular son milisegundos). El retardo evita disparar una corrida por cada
  // pixel que se arrastra.
  useEffect(() => {
    const temporizador = setTimeout(() => setParametrosAplicados(parametrosSim), 350);
    return () => clearTimeout(temporizador);
  }, [parametrosSim]);

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

  // Solo para poder mover un activo movible a otro lote desde la edicion.
  const { data: lotesDelEstablecimiento = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data: evaluacion } = useQuery({
    queryKey: ["evaluacion-riesgo", loteId, "ultima"],
    queryFn: () => api.get<EvaluacionRiesgo>(`/lotes/${loteId}/evaluaciones-riesgo/ultima`),
    retry: false,
  });

  const { data: simulacion, isFetching: simulando } = useQuery({
    queryKey: ["simulacion", loteId, parametrosAplicados],
    queryFn: () => {
      const p = parametrosAplicados;
      const query = new URLSearchParams({
        modo: p.modo,
        escenarioLluviaMm: String(p.escenarioLluviaMm),
        horas: String(p.horas),
        vientoKmh: String(p.vientoKmh),
        direccionVientoDeg: String(p.direccionVientoDeg),
        lluvia5DiasMm: String(p.lluvia5DiasMm),
        humedadSueloM3m3: String(p.humedadSueloM3m3),
      });
      return api.get<Simulacion>(`/lotes/${loteId}/topografia/simulacion?${query}`);
    },
    enabled: simulacionActiva,
    staleTime: Infinity,
    // Mantiene en pantalla la corrida anterior mientras llega la nueva: el terreno no se
    // desmonta y la pagina no salta.
    placeholderData: keepPreviousData,
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
            {lote.tipoUso.toLowerCase()} · antecedentes: {lote.antecedentesAnegamientoUltimos10Anios ?? 0}/10 anios
          </p>
        </div>
        <div className="flex items-center gap-2">
          {evaluacion ? (
            <>
              <RiesgoChip score={evaluacion.scoreSusceptibilidad} />
              <InfoModal titulo="Como se calcula este score">
                <ul className="list-disc space-y-1 pl-4">
                  <li>Elevacion relativa: {evaluacion.factores.elevacionPercentil.toFixed(2)}</li>
                  <li>Antecedentes historicos: {evaluacion.factores.antecedentesHistoricos.toFixed(2)}</li>
                  <li>Tipo de suelo: {evaluacion.factores.tipoSueloScore.toFixed(2)}</li>
                  <li>Precipitacion reciente real (NASA POWER): {evaluacion.factores.precipitacionRecienteMm.toFixed(0)} mm</li>
                  <li>Precipitacion pronosticada real (Open-Meteo): {evaluacion.factores.precipitacionPronosticadaMm.toFixed(0)} mm</li>
                </ul>
                <p className="text-xs text-ink-600">Fuente: {evaluacion.fuenteDatos}.</p>
              </InfoModal>
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
        onZonaDibujada={setAnilloNuevaZona}
        onActivoUbicado={setUbicacionNuevoActivo}
        onEditarCultivo={setCultivoAEditar}
        onEditarActivo={setActivoAEditar}
        onActivoMovido={(activo, coordenada) => reubicarActivo.mutate({ activo, coordenada })}
        autoDibujar={autoDibujar}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink-950">Zonas de cultivo</h2>
          <ListaCultivos loteId={loteId} cultivos={cultivos} onEditar={setCultivoAEditar} />
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-lg font-medium text-ink-950">Activos en este lote</h2>
          {activos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-paper-300 p-4 text-center text-sm text-ink-600">
              Todavia no hay activos. Usa &quot;+ Activo&quot; sobre el mapa.
            </p>
          ) : (
            <ul className="space-y-2">
              {activos.map((activo) => (
                <li key={activo.id} className="flex items-center justify-between gap-3 rounded-xl border border-paper-300 bg-paper-50 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{activo.nombre}</p>
                    <p className="text-xs text-ink-600">
                      {activo.movilidad === "MOVIBLE" ? "movible" : "fijo"} · USD {activo.valorEstimado.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <button
                    onClick={() => setActivoAEditar(activo)}
                    className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:border-brand-500 hover:text-brand-700"
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* min-w-0: sin esto la fila scrolleable de 14 dias estira el grid en vez de scrollear. */}
      <div className="min-w-0">
        <PanelClima loteReferenciaId={loteId} />
      </div>

      <div className="space-y-3 rounded-2xl border border-paper-300 bg-paper-50 p-5">
        <div>
          <h2 className="font-display text-lg font-medium text-ink-950">Simulacion hidrologica de anegamiento</h2>
          <p className="text-xs text-ink-600">
            Balance de agua hora a hora sobre la elevacion real del lote: lluvia, infiltracion, evapotranspiracion y
            escurrimiento. Arrastra para rotar el bloque de terreno, scroll para zoom.
          </p>
        </div>

        {!simulacionActiva && (
          <button
            onClick={() => setSimulacionActiva(true)}
            className="rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Correr simulacion
          </button>
        )}
        {simulacionActiva && !simulacion && simulando && (
          <p className="text-sm text-ink-600">Consultando elevacion y clima real, resolviendo el balance...</p>
        )}
        {simulacionActiva && simulacion && (
          <SimulacionInundacion
            simulacion={simulacion}
            parametros={parametrosSim}
            recalculando={simulando}
            onCambiar={setParametrosSim}
            onRestablecer={() => {
              const reales: ParametrosSimulacion = {
                ...parametrosSim,
                vientoKmh: Math.round(simulacion.parametros?.vientoKmh ?? parametrosSim.vientoKmh),
                direccionVientoDeg: Math.round(simulacion.parametros?.direccionVientoDeg ?? parametrosSim.direccionVientoDeg),
                lluvia5DiasMm: Math.round(simulacion.parametros?.lluvia5DiasMm ?? parametrosSim.lluvia5DiasMm),
                humedadSueloM3m3: simulacion.parametros?.humedadSueloM3m3 ?? parametrosSim.humedadSueloM3m3,
              };
              setParametrosSim(reales);
              setParametrosAplicados(reales);
            }}
          />
        )}
      </div>

      <ConfirmarBorrado
        abierto={confirmandoBorrado}
        titulo={`Borrar "${lote.nombre}"`}
        queSeBorra={`Se borran tambien ${cultivos.length} zona(s) de cultivo, ${activos.length} activo(s) y las evaluaciones de riesgo del lote.`}
        borrando={borrarLote.isPending}
        onConfirmar={() => borrarLote.mutate()}
        onCerrar={() => setConfirmandoBorrado(false)}
      />

      <ActivoForm
        key={activoAEditar?.id ?? (ubicacionNuevoActivo ? "activo-nuevo" : "activo-cerrado")}
        loteId={loteId}
        lotes={lotesDelEstablecimiento}
        ubicacionNueva={ubicacionNuevoActivo}
        activoAEditar={activoAEditar}
        onCerrar={() => {
          setUbicacionNuevoActivo(null);
          setActivoAEditar(null);
        }}
      />

      <CultivoForm
        key={cultivoAEditar?.id ?? (anilloNuevaZona ? "nuevo" : "cerrado")}
        loteId={loteId}
        anilloNuevo={anilloNuevaZona}
        cultivoAEditar={cultivoAEditar}
        onCerrar={() => {
          setAnilloNuevaZona(null);
          setCultivoAEditar(null);
        }}
      />
    </motion.div>
  );
}
