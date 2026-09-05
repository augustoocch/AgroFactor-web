"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { ListaLotes } from "@/components/ListaLotes";
import { api } from "@/lib/api";
import { useScoresRiesgo } from "@/lib/hooks";
import type { Activo, Lote } from "@/lib/types";

const MapaEstablecimiento = dynamic(
  () => import("@/components/MapaEstablecimiento").then((m) => m.MapaEstablecimiento),
  { ssr: false },
);

/**
 * Pantalla general de lotes: aca se ve el conjunto (mapa de todos los lotes + lista). El detalle
 * de un lote vive en /lotes/[loteId] y ahi se ve unicamente ese lote.
 */
export default function LotesPage({ params }: PageProps<"/establecimientos/[id]/lotes">) {
  const { id } = use(params);

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data: activos = [] } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const scorePorLote = useScoresRiesgo(lotes);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-brand-600">Manejo por lote</p>
        <h2 className="font-display text-lg font-medium text-ink-950">Lotes del establecimiento</h2>
        <p className="mt-1 text-sm text-ink-600">
          Vista general de todos los lotes. Tocá uno para abrir su pantalla propia (mapa solo de ese lote, zonas de
          cultivo, clima y simulacion de anegamiento), o usá{" "}
          <span className="font-medium text-brand-700">+ Cultivo</span> para dibujar una zona sembrada dentro de él.
          Para dibujar un lote nuevo o ubicar un activo, andá a{" "}
          <Link href={`/establecimientos/${id}`} className="underline underline-offset-2 hover:text-brand-700">
            Resumen
          </Link>
          .
        </p>
      </div>

      {isLoading && <p className="text-sm text-ink-600">Cargando...</p>}

      {!isLoading && lotes.length > 0 && (
        <MapaEstablecimiento
          establecimientoId={id}
          lotes={lotes}
          activos={activos}
          scorePorLote={scorePorLote}
          onLoteDibujado={() => {}}
          soloLectura
          alto="h-[38vh]"
        />
      )}

      {!isLoading && <ListaLotes establecimientoId={id} lotes={lotes} scorePorLote={scorePorLote} />}
    </div>
  );
}
