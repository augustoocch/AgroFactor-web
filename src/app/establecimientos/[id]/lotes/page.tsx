"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { use, useCallback, useState } from "react";
import { CargaPorCoordenadas, type VistaPreviaLote } from "@/components/CargaPorCoordenadas";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { ListaLotes } from "@/components/ListaLotes";
import { NuevoLoteForm } from "@/components/NuevoLoteForm";
import { api } from "@/lib/api";
import { useReubicarActivo, useScoresRiesgo } from "@/lib/hooks";
import type { Activo, Coordenada, Establecimiento, Lote } from "@/lib/types";

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
  // La carga por coordenadas queda abierta mientras se completa el formulario del lote: si se
  // cancela ahi, se vuelve a los vertices cargados en vez de perderlos.
  const [porCoordenadas, setPorCoordenadas] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaLote | null>(null);
  const cerrarCoordenadas = useCallback(() => {
    setPorCoordenadas(false);
    setVistaPrevia(null);
  }, []);

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data: activos = [] } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });

  // Donde abrir el mapa si todavia no hay lotes: el partido declarado en el alta. Si el partido se
  // escribio a mano y no esta en el catalogo, el endpoint da 404 y el mapa queda en su encuadre.
  const { data: centroPartido = null } = useQuery({
    queryKey: ["centroide-partido", establecimiento?.provincia, establecimiento?.partido],
    queryFn: () =>
      api.get<Coordenada>(
        `/catalogo/centroide?provincia=${encodeURIComponent(establecimiento!.provincia)}&partido=${encodeURIComponent(establecimiento!.partido)}`,
      ),
    enabled: !!establecimiento,
    retry: false,
    staleTime: Infinity,
  });

  const scorePorLote = useScoresRiesgo(lotes);
  const reubicarActivo = useReubicarActivo(id);

  return (
    <div>
      <EncabezadoPantalla
        segmento="lotes"
        titulo="Lotes"
        descripcion="Con «+ Lote» en el mapa elegís dibujarlo o cargar sus coordenadas. Adentro de cada lote se cargan sus cultivos, sus activos y su suelo."
      />

      {/* El panel va antes del mapa en el mismo contenedor: el mapa no se vuelve a montar al abrirlo. */}
      <div className={porCoordenadas ? "grid items-start gap-4 lg:grid-cols-[minmax(0,30rem)_1fr]" : ""}>
        {porCoordenadas && (
          <CargaPorCoordenadas
            centroPartido={centroPartido}
            onCambio={setVistaPrevia}
            onContinuar={setAnilloNuevoLote}
            onCancelar={cerrarCoordenadas}
          />
        )}
        <MapaEstablecimiento
          establecimientoId={id}
          lotes={lotes}
          activos={activos}
          scorePorLote={scorePorLote}
          onLoteDibujado={setAnilloNuevoLote}
          onCargarPorCoordenadas={() => setPorCoordenadas(true)}
          vistaPrevia={porCoordenadas ? vistaPrevia : null}
          onActivoMovido={(activo, coordenada) => reubicarActivo.mutate({ activo, coordenada })}
          alto={porCoordenadas ? "h-[52vh] lg:h-[70vh]" : "h-[52vh]"}
          centroPartido={centroPartido}
        />
      </div>

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

      <NuevoLoteForm
        establecimientoId={id}
        anillo={anilloNuevoLote}
        onCerrar={() => setAnilloNuevoLote(null)}
        onGuardado={cerrarCoordenadas}
      />
    </div>
  );
}
