"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { use } from "react";
import { EncabezadoPantalla, TituloSeccion } from "@/components/EncabezadoPantalla";
import { PanelClima } from "@/components/PanelClima";
import { PronosticoDiaADia } from "@/components/PronosticoDiaADia";
import { api } from "@/lib/api";
import { enlace } from "@/lib/estilos";
import { rutaDe } from "@/lib/navegacion";
import Link from "next/link";
import type { CapaMeteorologica, Lote, MeteorologiaDistribuida } from "@/lib/types";

const MapaIsobandas = dynamic(
  () => import("@/components/MapaIsobandas").then((m) => m.MapaIsobandas),
  { ssr: false },
);

/**
 * Pronostico: solo DATO (lo que se espera y lo que ya cayo). La simulacion de escenarios, que es
 * una HIPOTESIS armada por el usuario, vivia al pie de esta misma pantalla y se leia como parte
 * del pronostico; ahora tiene su pantalla propia en "Anticipar".
 *
 * Orden: primero los proximos dias (lo que se usa para decidir), despues el estado actual y lo
 * acumulado (el contexto), y al final lo observado por satelite, que tarda en llegar.
 */
export default function PronosticoPage({ params }: PageProps<"/establecimientos/[id]/pronostico">) {
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
    <div>
      <EncabezadoPantalla
        segmento="pronostico"
        titulo="Pronóstico"
        descripcion="La lluvia de los próximos días sobre tu campo, con qué humedad la recibe el suelo y dónde se juntaría el agua."
        acciones={
          <Link href={rutaDe(id, "simulacion")} className={enlace}>
            Probar otro escenario de lluvia
          </Link>
        }
      />

      <section>
        <TituloSeccion
          titulo="Los próximos días"
          descripcion="Elegí un día para ver dónde quedaría agua. El detalle por lote está en la pantalla de cada lote."
        />
        <PronosticoDiaADia establecimientoId={id} lotes={lotes} />
      </section>

      <section className="mt-12 grid gap-6 border-t border-paper-300 pt-10 lg:grid-cols-2">
        <div>
          <TituloSeccion titulo="Ahora" descripcion="El tiempo actual y cuánta agua viene juntando el campo." />
          {lotes[0] ? (
            <PanelClima loteReferenciaId={lotes[0].id} conDias={false} />
          ) : (
            <p className="text-sm text-ink-600">Hace falta al menos un lote dibujado para ubicar el campo.</p>
          )}
        </div>
        <div>
          <TituloSeccion titulo="Lo que ya llovió" descripcion="Medido por satélite en las últimas horas." />
          {/* El bloque se reserva ANTES de tener el dato. La consulta baja 12 barridos de GOES y
              tarda ~20 s en frio: sin esto la seccion aparecia de la nada a los veinte segundos. */}
          {cargandoObservacion && <ObservacionCargando />}
          {!cargandoObservacion && observacion && <ResumenObservacion capa={observacion} lotes={lotes} />}
        </div>
      </section>
    </div>
  );
}

/** Hueco del bloque de observacion mientras baja el dato, con el mismo alto para que no salte. */
function ObservacionCargando() {
  return (
    <div className="rounded-xl border border-paper-300 bg-paper-50 p-4">
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
    <div className="rounded-xl border border-paper-300 bg-paper-50 p-4">
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

