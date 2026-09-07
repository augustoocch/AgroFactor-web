"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { FormularioCultivo } from "@/components/formularios/FormularioCultivo";
import { api } from "@/lib/api";
import type { CultivoImplantado } from "@/lib/types";

/** Edicion de una zona de cultivo: la geometria ya existe, solo se editan los campos. */
export default function EditarCultivoPage({
  params,
}: PageProps<"/establecimientos/[id]/lotes/[loteId]/cultivos/[cultivoId]">) {
  const { id, loteId, cultivoId } = use(params);

  const { data: cultivos = [], isPending } = useQuery({
    queryKey: ["cultivos", loteId],
    queryFn: () => api.get<CultivoImplantado[]>(`/lotes/${loteId}/cultivos`),
  });

  if (isPending) return <div className="h-64 w-full animate-pulse rounded-2xl bg-paper-200" />;

  const cultivo = cultivos.find((c) => c.id === cultivoId) ?? null;
  if (!cultivo) {
    return (
      <p className="rounded-2xl border border-dashed border-paper-300 p-8 text-center text-sm text-ink-600">
        Esa zona de cultivo ya no existe.
      </p>
    );
  }

  return <FormularioCultivo establecimientoId={id} loteId={loteId} anilloNuevo={null} cultivoAEditar={cultivo} />;
}
