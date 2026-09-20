"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { use, useEffect, useState } from "react";
import { PanelClima } from "@/components/PanelClima";
import { PronosticoDiaADia } from "@/components/PronosticoDiaADia";
import { api } from "@/lib/api";
import { revealVariants } from "@/lib/motion";
import type { ParametrosSimulacion } from "@/components/SimulacionInundacion";
import type {
  Activo,
  CapaMeteorologica,
  Lote,
  MeteorologiaDistribuida,
  SimulacionInundacion as Simulacion,
  ZonaSimulada,
} from "@/lib/types";

const MapaIsobandas = dynamic(
  () => import("@/components/MapaIsobandas").then((m) => m.MapaIsobandas),
  { ssr: false },
);

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

export default function MeteorologiaPage({ params }: PageProps<"/establecimientos/[id]/meteorologia">) {
  const { id } = use(params);
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  // Solo se usa para el bloque de observacion satelital: el pronostico ya lo trae dia a dia.
  const { data: distribuida, isLoading: cargandoObservacion } = useQuery({
    queryKey: ["meteorologia-distribuida", id],
    queryFn: () => api.get<MeteorologiaDistribuida>(`/establecimientos/${id}/meteorologia/distribuida`),
    staleTime: 10 * 60 * 1000,
  });

  const observacion = distribuida?.capas?.find((c) => c.horizonte === "OBSERVACION") ?? null;

  return (
    <div className="space-y-8">
      {/* Pronostico, dia por dia (no agregado en un solo numero de semana). */}
      <section className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-brand-600">Pronóstico</p>
          <h2 className="font-display text-lg font-medium text-ink-950">Los próximos días, uno por uno</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            Cada día con su lluvia, su probabilidad, el estado de suelo con el que llega y dónde se acumularía el agua
            sobre el predio. El detalle por lote está en la pantalla de cada lote.
          </p>
        </div>

        <PronosticoDiaADia establecimientoId={id} lotes={lotes} />
      </section>

      {/* Estado actual medido: es observacion, no pronostico, y por eso va aparte. */}
      <section className="space-y-3 border-t border-paper-300 pt-7">
        <div>
          <p className="text-sm uppercase tracking-wide text-brand-600">Condiciones y observación</p>
          <h2 className="font-display text-lg font-medium text-ink-950">Qué está pasando ahora</h2>
        </div>
        <PanelClima loteReferenciaId={lotes[0]?.id ?? ""} />
        {/* El bloque se reserva ANTES de tener el dato. La consulta baja 12 barridos de GOES y
            tarda ~20 s en frio: sin esto la seccion aparecia de la nada a los veinte segundos y,
            mientras tanto, no habia forma de saber que algo estaba por llegar ahi. */}
        {cargandoObservacion && <ObservacionCargando />}
        {!cargandoObservacion && observacion && <ResumenObservacion capa={observacion} lotes={lotes} />}
      </section>

      {/* La hipotesis: "que pasaria si", separado del dato medido. */}
      <section className="space-y-4 border-t border-paper-300 pt-7">
        <SeccionSimulacion establecimientoId={id} lotes={lotes} />
      </section>
    </div>
  );
}

/** Hueco del bloque de observacion mientras baja el dato, con el mismo alto para que no salte. */
function ObservacionCargando() {
  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper-300 border-t-brand-600"
        />
        <p className="text-sm text-ink-700">Buscando la lluvia que ya cayó sobre el campo…</p>
      </div>
      <p className="mt-1 text-xs text-ink-600">
        Se bajan las últimas 2 horas de imágenes del satélite. Puede tardar unos segundos.
      </p>
      <div className="mt-3 h-8 w-32 animate-pulse rounded-lg bg-paper-200" />
    </div>
  );
}

/**
 * Lluvia observada por satelite (GOES).
 *
 * Cuando se dibuja mapa y cuando no: lo decide el REGIMEN que ya calcula el motor comparando el
 * tamano del campo contra el pixel del satelite (~2.5 km).
 *
 *  - `SUB_CELDA`: el campo entra en un pixel. Un mapa dibujaria bordes de color que salen del
 *    suavizado, no de algo medido. Va solo la cifra.
 *  - `MARGINAL` / `RESUELTO`: el satelite ve varias celdas sobre el campo, asi que las
 *    diferencias entre sectores son reales y hay que mostrarlas.
 *
 * Esto estaba mal: la pantalla mostraba SIEMPRE la cifra y descartaba las isobandas, que el
 * motor ya venia calculando. La justificacion escrita ("seria dibujar diferencias que el satelite
 * no vio") valia para un campo chico y se habia generalizado a todos.
 *
 * El titulo y el mensaje salen del motor y no se reescriben aca: el titulo trae la ventana
 * temporal ("Lluvia observada (ultimos 120 min)") y el mensaje explica el caso de cero lluvia.
 * Escribir un titulo fijo en la UI borraba las dos cosas, y "0 mm" sin la ventana al lado se lee
 * como "no llovio" cuando en realidad dice "no llovio en las ultimas dos horas".
 */
function ResumenObservacion({ capa, lotes }: { capa: CapaMeteorologica; lotes: Lote[] }) {
  const valores = capa.bandas.flatMap((b) => [b.desde, b.hasta]);
  const minimo = valores.length > 0 ? Math.min(...valores) : null;
  const maximo = valores.length > 0 ? Math.max(...valores) : null;
  const resuelveSectores = capa.regimen === "RESUELTO" || capa.regimen === "MARGINAL";

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ink-950">{capa.titulo}</h3>
        {capa.fuente && <span className="font-mono text-[11px] text-ink-600">{capa.fuente}</span>}
      </div>

      {!capa.disponible && <p className="mt-1 text-sm text-ink-700">{capa.motivoNoDisponible}</p>}

      {capa.disponible && (
        <>
          {minimo != null && maximo != null && (
            <p className="mt-2 font-display text-2xl text-ink-950">
              {minimo === maximo
                ? `${maximo.toFixed(1)} mm`
                : `${minimo.toFixed(1)} a ${maximo.toFixed(1)} mm`}
            </p>
          )}

          {/* El mensaje del motor: dice si no llovio, y en que ventana. */}
          {capa.mensaje && <p className="mt-1 text-xs leading-snug text-ink-600">{capa.mensaje}</p>}

          {resuelveSectores && capa.bandas.length > 0 && (
            <div className="mt-3">
              <MapaIsobandas
                lotes={lotes}
                bandas={capa.bandas}
                unidad={capa.unidad ?? "mm"}
                alto="h-[40vh]"
              />
            </div>
          )}

          {/* Sin bandas no hay nada que pintar, y eso pasa cuando no llovio: el mapa vacio se
              leeria como una pantalla rota, asi que directamente no se monta. */}
          {resuelveSectores && capa.bandas.length === 0 && (
            <p className="mt-1 text-xs text-ink-600">
              Sin lluvia registrada sobre el campo en esta ventana, no hay sectores que dibujar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SeccionSimulacion({ establecimientoId, lotes }: { establecimientoId: string; lotes: Lote[] }) {
  const [activa, setActiva] = useState(false);
  const [alcance, setAlcance] = useState<string>(TODO_EL_PREDIO);
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

  const nombreAlcance =
    alcance === TODO_EL_PREDIO ? "todo el predio" : (lotes.find((l) => l.id === alcance)?.nombre ?? "el lote");

  return (
    <>
      <div>
        <p className="text-sm uppercase tracking-wide text-clay-600">Simulación</p>
        <h2 className="font-display text-lg font-medium text-ink-950">Qué pasaría si llueve sobre {nombreAlcance}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Esto ya no es pronóstico: es un escenario que armás vos. Incluye el terreno de alrededor, porque el agua que
          anega un campo muchas veces no cayó sobre él, bajó de una loma vecina. El contorno punteado marca dónde
          termina tu campo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-ink-600">Alcance:</span>
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
        <div className="rounded-2xl border border-dashed border-paper-300 p-6 text-center">
          <button
            onClick={() => setActiva(true)}
            className="rounded-full bg-clay-500 px-4 py-2 text-sm font-medium text-paper-50 transition-colors hover:bg-clay-600"
          >
            Correr simulación
          </button>
          <p className="mx-auto mt-2 max-w-md text-xs text-ink-600">
            La primera corrida de cada alcance consulta la elevación del terreno y puede tardar hasta un minuto. Las
            siguientes son inmediatas: el relieve no cambia y queda cacheado.
          </p>
        </div>
      )}

      {activa && !simulacion && isFetching && (
        <div className="rounded-2xl border border-paper-300 bg-paper-50 p-6 text-center">
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
    </>
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
      <h3 className="font-display text-base font-medium text-ink-950">Lotes más expuestos</h3>
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
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-300 bg-paper-50 px-4 py-3"
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
