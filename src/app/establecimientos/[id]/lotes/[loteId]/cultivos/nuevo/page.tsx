"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { FormularioCultivo } from "@/components/formularios/FormularioCultivo";
import { tomarGeometriaPendiente } from "@/lib/geometria-pendiente";
import type { Coordenada } from "@/lib/types";

/**
 * Alta de una zona de cultivo. La geometria llega desde el mapa del lote por sessionStorage:
 * dibujar es una accion del mapa, pero cargar la ficha ya no cabe en un modal.
 */
export default function NuevoCultivoPage({
  params,
}: PageProps<"/establecimientos/[id]/lotes/[loteId]/cultivos/nuevo">) {
  const { id, loteId } = use(params);
  const [anillo, setAnillo] = useState<Coordenada[] | null>(null);
  const [buscando, setBuscando] = useState(true);
  const yaLeido = useRef(false);

  useEffect(() => {
    // La geometria es de un solo uso y se borra al leerla. StrictMode corre los efectos dos
    // veces en desarrollo: sin esta guarda, la segunda pasada encuentra el storage ya vacio y
    // pisa con null lo que la primera habia leido bien.
    if (yaLeido.current) return;
    yaLeido.current = true;
    const pendiente = tomarGeometriaPendiente();
    setAnillo(pendiente?.anillo ?? null);
    setBuscando(false);
  }, []);

  if (buscando) return <div className="h-64 w-full animate-pulse rounded-2xl bg-paper-200" />;

  if (!anillo) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-paper-300 p-8 text-center">
        <p className="text-sm text-ink-700">Primero hay que dibujar la zona sobre el mapa del lote.</p>
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
    <FormularioCultivo establecimientoId={id} loteId={loteId} anilloNuevo={anillo} cultivoAEditar={null} />
  );
}
