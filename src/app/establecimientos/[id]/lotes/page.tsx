"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { use, useState } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { ListaLotes } from "@/components/ListaLotes";
import { NuevoLoteForm } from "@/components/NuevoLoteForm";
import { api } from "@/lib/api";
import { useReubicarActivo, useScoresRiesgo } from "@/lib/hooks";
import type { Activo, Coordenada, Lote } from "@/lib/types";

const MapaEstablecimiento = dynamic(
  () => import("@/components/MapaEstablecimiento").then((m) => m.MapaEstablecimiento),
  { ssr: false, loading: () => <div className="h-[52vh] w-full animate-pulse rounded-xl bg-paper-200" /> },
);

/**
 * Lotes: el unico lugar donde se dibuja un lote nuevo, y la puerta a cada lote.
 *
 * Antes el mapa editable estaba en "Resumen" y esta pantalla tenia uno de solo lectura con un
 * texto que decia "para dibujar un lote, anda a Resumen". Crear lotes y listarlos es una sola
 * responsabilidad; ahora esta junta.
 */
export default function LotesPage({ params }: PageProps<"/establecimientos/[id]/lotes">) {
  const { id } = use(params);
  const [anilloNuevoLote, setAnilloNuevoLote] = useState<Coordenada[] | null>(null);

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data: activos = [] } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const scorePorLote = useScoresRiesgo(lotes);
  const reubicarActivo = useReubicarActivo(id);

  return (
    <div>
      <EncabezadoPantalla
        segmento="lotes"
        titulo="Lotes"
        descripcion="Dibujá cada lote sobre el mapa con el botón del mapa. Adentro de cada lote se cargan sus cultivos, sus activos y su suelo."
      />

      <MapaEstablecimiento
        establecimientoId={id}
        lotes={lotes}
        activos={activos}
        scorePorLote={scorePorLote}
        onLoteDibujado={setAnilloNuevoLote}
        onActivoMovido={(activo, coordenada) => reubicarActivo.mutate({ activo, coordenada })}
        alto="h-[52vh]"
      />

      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-medium text-ink-950">
          {lotes.length === 1 ? "Un lote" : `${lotes.length} lotes`}
        </h2>
        {isLoading ? (
          <p className="text-sm text-ink-600">Cargando...</p>
        ) : (
          <ListaLotes establecimientoId={id} lotes={lotes} scorePorLote={scorePorLote} />
        )}
      </section>

      <NuevoLoteForm establecimientoId={id} anillo={anilloNuevoLote} onCerrar={() => setAnilloNuevoLote(null)} />
    </div>
  );
}
