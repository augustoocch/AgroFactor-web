"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { FormularioActivo } from "@/components/formularios/FormularioActivo";
import { api } from "@/lib/api";
import { tomarGeometriaPendiente } from "@/lib/geometria-pendiente";
import type { Coordenada, Lote } from "@/lib/types";

/** Alta de un activo. La ubicacion llega desde el mapa del lote por sessionStorage. */
export default function NuevoActivoPage({
  params,
}: PageProps<"/establecimientos/[id]/lotes/[loteId]/activos/nuevo">) {
  const { id, loteId } = use(params);
  const [punto, setPunto] = useState<Coordenada | null>(null);
  const [buscando, setBuscando] = useState(true);
  const yaLeido = useRef(false);

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  useEffect(() => {
    // La geometria es de un solo uso y se borra al leerla. StrictMode corre los efectos dos
    // veces en desarrollo: sin esta guarda, la segunda pasada encuentra el storage ya vacio y
    // pisa con null lo que la primera habia leido bien.
    if (yaLeido.current) return;
    yaLeido.current = true;
    const pendiente = tomarGeometriaPendiente();
    setPunto(pendiente?.punto ?? null);
    setBuscando(false);
  }, []);

  if (buscando) return <div className="h-64 w-full animate-pulse rounded-2xl bg-paper-200" />;

  if (!punto) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-paper-300 p-8 text-center">
        <p className="text-sm text-ink-700">Primero hay que marcar la ubicacion sobre el mapa del lote.</p>
        <Link
          href={`/establecimientos/${id}/lotes/${loteId}/mapa`}
          className="mt-3 inline-block rounded-full border border-brand-500 px-4 py-2 text-sm font-medium text-brand-700"
        >
          Ir al mapa del lote
        </Link>
      </div>
    );
  }

  return (
    <FormularioActivo
      establecimientoId={id}
      loteId={loteId}
      lotes={lotes}
      ubicacionNueva={punto}
      activoAEditar={null}
    />
  );
}
