"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { InfoAside } from "@/components/InfoAside";
import { api } from "@/lib/api";
import { boton, tarjeta } from "@/lib/estilos";
import { revealVariants } from "@/lib/motion";
import type { ParametrosSimulacion } from "@/components/SimulacionInundacion";
import type { Activo, Lote, SimulacionInundacion as Simulacion, ZonaSimulada } from "@/lib/types";

const SimulacionInundacion = dynamic(
  () => import("@/components/SimulacionInundacion").then((m) => m.SimulacionInundacion),
  { ssr: false },
);

const PARAMETROS_INICIALES: ParametrosSimulacion = {
  modo: "real",
  escenarioLluviaMm: 60,
  horas: 24,
  vientoKmh: 12,
  direccionVientoDeg: 180,
  lluvia5DiasMm: 20,
  humedadSueloM3m3: 0.3,
};

const TODO_EL_PREDIO = "__predio__";

/**
 * Simulador: "que pasaria si". Separado del pronostico porque es otra cosa: el pronostico es un
 * dato que el usuario no controla, esto es un escenario que arma el. Mezclados en una pantalla,
 * el resultado de una simulacion se leia como si fuera lo que va a pasar.
 *
 * `?lote=<id>` llega desde la pantalla de un lote y abre el simulador enfocado en ese lote.
 */
export default function SimulacionPage({ params }: PageProps<"/establecimientos/[id]/simulacion">) {
  const { id } = use(params);
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  return (
    <div>
      <EncabezadoPantalla
        segmento="simulacion"
        titulo="Simulador de lluvia"
        descripcion="Elegí cuánta lluvia y en cuántas horas, y mirá hora a hora dónde se juntaría el agua. Es un escenario que armás vos, no un pronóstico."
        ayuda={
          <InfoAside titulo="Qué calcula el simulador" etiqueta="Qué tiene en cuenta">
            <p>
              Un balance de agua hora a hora sobre la elevación real del terreno: cuánto llueve, cuánto infiltra según el
              suelo y su humedad previa, y hacia dónde escurre lo que sobra.
            </p>
            <p>
              Incluye el terreno de alrededor, porque el agua que anega un campo muchas veces no cayó sobre él: bajó de
              una loma vecina. El contorno punteado marca dónde termina tu campo.
            </p>
          </InfoAside>
        }
      />
      <SeccionSimulacion establecimientoId={id} lotes={lotes} />
    </div>
  );
}

function SeccionSimulacion({ establecimientoId, lotes }: { establecimientoId: string; lotes: Lote[] }) {
  const loteInicial = useSearchParams().get("lote");
  const router = useRouter();
  const [activa, setActiva] = useState(false);
  const [alcance, setAlcanceLocal] = useState<string>(loteInicial ?? TODO_EL_PREDIO);
  // El alcance queda en la URL: se puede volver atras, recargar o compartir el mismo escenario.
  const setAlcance = (nuevo: string) => {
    setAlcanceLocal(nuevo);
    router.replace(nuevo === TODO_EL_PREDIO ? "?" : `?lote=${nuevo}`, { scroll: false });
  };
  const [parametros, setParametros] = useState<ParametrosSimulacion>(PARAMETROS_INICIALES);
  const [parametrosAplicados, setParametrosAplicados] = useState(PARAMETROS_INICIALES);

  const { data: activos = [] } = useQuery({
    queryKey: ["activos", establecimientoId],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${establecimientoId}/activos`),
    enabled: activa,
  });
  const activosDelAlcance =
    alcance === TODO_EL_PREDIO ? activos : activos.filter((a) => a.loteAsociadoId === alcance);

  useEffect(() => {
    const t = setTimeout(() => setParametrosAplicados(parametros), 350);
    return () => clearTimeout(t);
  }, [parametros]);

  const { data: simulacion, isFetching } = useQuery({
    queryKey: ["simulacion-predio", establecimientoId, alcance, parametrosAplicados],
    queryFn: () => {
      const q = new URLSearchParams({
        modo: parametrosAplicados.modo,
        horas: String(parametrosAplicados.horas),
        escenarioLluviaMm: String(parametrosAplicados.escenarioLluviaMm),
        vientoKmh: String(parametrosAplicados.vientoKmh),
        direccionVientoDeg: String(parametrosAplicados.direccionVientoDeg),
        lluvia5DiasMm: String(parametrosAplicados.lluvia5DiasMm),
        humedadSueloM3m3: String(parametrosAplicados.humedadSueloM3m3),
      });
      if (alcance !== TODO_EL_PREDIO) q.set("loteId", alcance);
      return api.get<Simulacion>(`/establecimientos/${establecimientoId}/simulacion?${q}`);
    },
    // Explicita, no automatica: la primera corrida consulta elevacion y puede tardar hasta un minuto.
    enabled: activa,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-ink-600">Simular sobre</span>
        {[{ id: TODO_EL_PREDIO, nombre: "Todo el predio" }, ...lotes].map((opcion) => (
          <button
            key={opcion.id}
            onClick={() => setAlcance(opcion.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              alcance === opcion.id
                ? "border-clay-500 bg-clay-100 text-clay-600"
                : "border-paper-300 text-ink-600 hover:border-clay-500 hover:text-clay-600"
            }`}
          >
            {opcion.nombre}
          </button>
        ))}
      </div>

      {!activa && (
        <div className="rounded-xl border border-dashed border-paper-300 px-6 py-10 text-center">
          <button onClick={() => setActiva(true)} className={boton.primario}>
            Correr simulación
          </button>
          <p className="mx-auto mt-2 max-w-md text-xs text-ink-600">
            La primera corrida de cada alcance consulta la elevación del terreno y puede tardar hasta un minuto. Las
            siguientes son inmediatas: el relieve no cambia y queda cacheado.
          </p>
        </div>
      )}

      {activa && !simulacion && isFetching && (
        <div className={`${tarjeta} p-6 text-center`}>
          <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-paper-300 border-t-clay-500" />
          <p className="mt-2 text-sm text-ink-700">Consultando la elevación del terreno y resolviendo el balance...</p>
          <p className="text-xs text-ink-600">Puede tardar hasta un minuto la primera vez.</p>
        </div>
      )}

      {activa && simulacion && (
        <>
          <SimulacionInundacion
            simulacion={simulacion}
            // "Todo el predio": todos los lotes, clickeables para enfocar uno. Enfocado en uno: solo ese.
            lotes={alcance === TODO_EL_PREDIO ? lotes : lotes.filter((l) => l.id === alcance)}
            loteSeleccionadoId={alcance === TODO_EL_PREDIO ? null : alcance}
            onSeleccionarLote={(id) => setAlcance(id ?? TODO_EL_PREDIO)}
            activos={activosDelAlcance}
            parametros={parametros}
            recalculando={isFetching}
            onCambiar={setParametros}
            onRestablecer={() => setParametros(PARAMETROS_INICIALES)}
          />
          {alcance === TODO_EL_PREDIO && simulacion.ranking.length > 0 && (
            <RankingZonas
              ranking={simulacion.ranking}
              lotes={lotes}
              lluviaMm={parametrosAplicados.escenarioLluviaMm}
            />
          )}
        </>
      )}
    </div>
  );
}

function RankingZonas({
  ranking,
  lotes,
  lluviaMm,
}: {
  ranking: ZonaSimulada[];
  lotes: Lote[];
  lluviaMm: number;
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-lg font-medium text-ink-950">Lotes más expuestos</h2>
      <p className="text-xs text-ink-600">
        Con los {lluviaMm} mm simulados: cuánta agua se acumula, sobre cuánta superficie, y en qué momento.
      </p>
      <ul className="space-y-2">
        {ranking.map((zona, i) => (
          <motion.li
            key={zona.indice}
            initial="hidden"
            animate="visible"
            custom={i}
            variants={revealVariants}
            className={`${tarjeta} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
          >
            <div>
              <p className="text-sm font-medium text-ink-900">{lotes[zona.indice]?.nombre ?? "Lote"}</p>
              <p className="text-xs text-ink-600">
                {zona.superficieAnegadaPct}% de la superficie con agua · pico a las {zona.horaPico} h
              </p>
            </div>
            <span className="font-mono text-sm text-ink-800">{zona.laminaMaximaMm} mm</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
