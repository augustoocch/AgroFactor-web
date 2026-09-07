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
  CapaMeteorologica,
  Lote,
  MeteorologiaDistribuida,
  SimulacionInundacion as Simulacion,
  ZonaSimulada,
} from "@/lib/types";

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
  const { data: distribuida } = useQuery({
    queryKey: ["meteorologia-distribuida", id],
    queryFn: () => api.get<MeteorologiaDistribuida>(`/establecimientos/${id}/meteorologia/distribuida`),
    staleTime: 10 * 60 * 1000,
  });

  const observacion = distribuida?.capas?.find((c) => c.horizonte === "OBSERVACION") ?? null;

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------------------------
          1. EL PRONOSTICO. Dia por dia, con el detalle tecnico de cada uno y donde se juntaria
          el agua ese dia. Antes habia tres botones ("lo que cayo", "lo que se espera", "donde se
          acumula") que agregaban toda la semana en un solo numero: no se podia saber que dia era
          el problema, que es justo la decision que hay que tomar.
          --------------------------------------------------------------------------------- */}
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
        {observacion && <ResumenObservacion capa={observacion} />}
      </section>

      {/* ---------------------------------------------------------------------------------
          2. LA HIPOTESIS. Todo lo que responde "que pasaria si", separado del dato por una
          linea y con sus propias perillas. Antes esto estaba mezclado con lo de arriba y el
          control de lluvia no afectaba a dos de las tres capas: parecia roto.
          --------------------------------------------------------------------------------- */}
      <section className="space-y-4 border-t border-paper-300 pt-7">
        <SeccionSimulacion establecimientoId={id} lotes={lotes} />
      </section>
    </div>
  );
}

/**
 * Lo que el satelite midio sobre el predio en las ultimas horas. Es observacion, no pronostico,
 * y se muestra como cifra y no como mapa: sobre un predio de pocos kilometros GOES resuelve un
 * punado de pixeles, asi que dibujar isobandas con eso seria pintar una forma que el dato no
 * tiene. La resolucion medida viaja al lado del numero.
 */
function ResumenObservacion({ capa }: { capa: CapaMeteorologica }) {
  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ink-950">Lluvia observada por satélite</h3>
        {capa.resolucionKm != null && (
          <span className="font-mono text-[11px] text-ink-600">
            {capa.fuente} · pixel de {capa.resolucionKm} km
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-700">{capa.disponible ? capa.mensaje : capa.motivoNoDisponible}</p>
    </div>
  );
}

function SeccionSimulacion({ establecimientoId, lotes }: { establecimientoId: string; lotes: Lote[] }) {
  const [activa, setActiva] = useState(false);
  const [alcance, setAlcance] = useState<string>(TODO_EL_PREDIO);
  const [parametros, setParametros] = useState<ParametrosSimulacion>(PARAMETROS_INICIALES);
  const [parametrosAplicados, setParametrosAplicados] = useState(PARAMETROS_INICIALES);

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
    // Explicita, no automatica: la primera corrida de cada alcance consulta cientos de puntos de
    // elevacion a un servicio gratuito cuya latencia es muy variable. Dispararla sola al entrar
    // a la pestania hacia esperar un minuto a quien solo queria ver el pronostico.
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
            // El contorno sale del poligono real de cada lote simulado, no de la mascara de
            // calculo: la mascara tiene la resolucion de la grilla y deforma la figura.
            contornos={(alcance === TODO_EL_PREDIO ? lotes : lotes.filter((l) => l.id === alcance)).map(
              (l) => l.anillo,
            )}
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
      {/* Magnitud, extension y momento: lo que los asesores pidieron en vez de un semaforo.
          Describe el escenario que se esta viendo arriba, no el pronostico: dos cifras distintas
          en la misma pantalla se contradicen y no hay forma de saber cual mira uno. */}
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
