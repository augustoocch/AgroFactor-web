"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { FormularioActivo } from "@/components/formularios/FormularioActivo";
import { api } from "@/lib/api";
import type { Activo, Lote } from "@/lib/types";

/** Edicion de un activo: la ubicacion ya existe, se ajusta arrastrando el pin en el mapa. */
export default function EditarActivoPage({
  params,
}: PageProps<"/establecimientos/[id]/lotes/[loteId]/activos/[activoId]">) {
  const { id, loteId, activoId } = use(params);

  const { data: activos = [], isPending } = useQuery({
    queryKey: ["activos", "lote", loteId],
    queryFn: () => api.get<Activo[]>(`/lotes/${loteId}/activos`),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  if (isPending) return <div className="h-64 w-full animate-pulse rounded-2xl bg-paper-200" />;

  const activo = activos.find((a) => a.id === activoId) ?? null;
  if (!activo) {
    return (
      <p className="rounded-2xl border border-dashed border-paper-300 p-8 text-center text-sm text-ink-600">
        Ese activo ya no existe.
      </p>
    );
  }

  return (
    <FormularioActivo
      establecimientoId={id}
      loteId={loteId}
      lotes={lotes}
      ubicacionNueva={null}
      activoAEditar={activo}
    />
  );
}
