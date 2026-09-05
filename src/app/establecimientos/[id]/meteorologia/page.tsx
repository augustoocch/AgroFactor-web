"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { use, useState } from "react";
import { LeyendaCapa } from "@/components/LeyendaCapa";
import { api } from "@/lib/api";
import { revealVariants } from "@/lib/motion";
import type { CapaMeteorologica, Lote, MeteorologiaDistribuida } from "@/lib/types";

const MapaMeteorologia = dynamic(
  () => import("@/components/MapaMeteorologia").then((m) => m.MapaMeteorologia),
  { ssr: false },
);

/** Tormentas de referencia para la Cuenca del Salado, ademas del pronostico real. */
const ESCENARIOS: { label: string; mm: number | null }[] = [
  { label: "Pronostico real", mm: null },
  { label: "30 mm", mm: 30 },
  { label: "60 mm", mm: 60 },
  { label: "100 mm", mm: 100 },
];

const ETIQUETA_HORIZONTE: Record<CapaMeteorologica["horizonte"], string> = {
  OBSERVACION: "Ya cayo",
  PRONOSTICO: "Se espera",
  MODELO_TERRENO: "Donde se junta",
};

export default function MeteorologiaPage({ params }: PageProps<"/establecimientos/[id]/meteorologia">) {
  const { id } = use(params);
  const [capaActiva, setCapaActiva] = useState(0);
  // null = el pronostico real. Los demas valores responden "y si cayera esta tormenta?", que es
  // la pregunta util un dia seco: sin lluvia no hay acumulacion y la capa de terreno queda vacia.
  const [escenarioMm, setEscenarioMm] = useState<number | null>(null);

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["meteorologia-distribuida", id, escenarioMm],
    queryFn: () =>
      api.get<MeteorologiaDistribuida>(
        `/establecimientos/${id}/meteorologia/distribuida` +
          (escenarioMm === null ? "" : `?escenarioLluviaMm=${escenarioMm}`),
      ),
    // El calculo cruza satelite, pronostico y una corrida hidrologica: no se rehace al volver
    // a la pestania. Las cachés del risk-engine tienen su propio TTL por fuente.
    staleTime: 10 * 60 * 1000,
  });

  const capas = data?.capas ?? [];
  const capa = capas[capaActiva] ?? null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm uppercase tracking-wide text-brand-600">Meteorologia del predio</p>
        <h2 className="font-display text-lg font-medium text-ink-950">Lluvia y acumulacion por sector</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Que parte del campo recibe la lluvia y que zonas van a sufrir mas. Cada capa dice de donde sale su dato y con
          cuanto detalle puede verlo.
        </p>
      </div>

      {isPending && (
        <div className="space-y-3">
          <div className="h-9 w-full max-w-md animate-pulse rounded-xl bg-paper-200" />
          <div className="h-[52vh] w-full animate-pulse rounded-2xl bg-paper-200" />
        </div>
      )}

      {isError && (
        <p className="rounded-2xl border border-risk-alto bg-risk-alto-bg p-6 text-center text-sm text-ink-700">
          No se pudo calcular la meteorologia del predio.
        </p>
      )}

      {data && !data.disponible && (
        <p className="rounded-2xl border border-dashed border-paper-300 p-8 text-center text-sm text-ink-600">
          {data.motivoNoDisponible ?? "Todavia no hay datos para este establecimiento."}
        </p>
      )}

      {data?.disponible && data.predio && (
        <motion.div initial="hidden" animate="visible" variants={revealVariants} className="space-y-4">
          <p className="text-xs text-ink-600">
            {data.predio.superficieHa.toLocaleString("es-AR")} ha ·{" "}
            <span title="Lado del cuadrado de igual superficie: es la medida con la que se compara la resolucion de cada fuente.">
              {data.predio.dimensionCaracteristicaKm} km de lado equivalente
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-ink-600">Escenario de lluvia:</span>
            {ESCENARIOS.map((e) => (
              <button
                key={e.label}
                onClick={() => setEscenarioMm(e.mm)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  escenarioMm === e.mm
                    ? "border-clay-500 bg-clay-100 text-clay-600"
                    : "border-paper-300 text-ink-600 hover:border-clay-500 hover:text-clay-600"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {capas.map((c, i) => (
              <button
                key={c.titulo}
                onClick={() => setCapaActiva(i)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === capaActiva
                    ? "border-brand-500 bg-brand-100 text-brand-700"
                    : "border-paper-300 text-ink-600 hover:border-brand-500 hover:text-brand-700"
                } ${c.disponible ? "" : "opacity-55"}`}
              >
                {ETIQUETA_HORIZONTE[c.horizonte]}
                {!c.disponible && " · sin dato"}
              </button>
            ))}
          </div>

          <MapaMeteorologia lotes={lotes} capa={capa} />

          {capa && <LeyendaCapa capa={capa} />}

          {data.ranking.length > 0 && <RankingZonas ranking={data.ranking} />}
        </motion.div>
      )}
    </div>
  );
}

function RankingZonas({ ranking }: { ranking: MeteorologiaDistribuida["ranking"] }) {
  return (
    <div className="space-y-2">
      <h3 className="font-display text-base font-medium text-ink-950">Lotes mas afectados</h3>
      {/* Magnitud, extension y momento: lo que los asesores pidieron en vez de un semaforo. */}
      <p className="text-xs text-ink-600">Cuanta agua se acumula, sobre cuanta superficie, y en que momento.</p>
      <ul className="space-y-2">
        {ranking.map((zona, i) => (
          <motion.li
            key={zona.loteId}
            initial="hidden"
            animate="visible"
            custom={i}
            variants={revealVariants}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-300 bg-paper-50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink-900">{zona.nombre}</p>
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
