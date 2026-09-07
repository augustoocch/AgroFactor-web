"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Activo } from "@/lib/types";

export function ListaActivos({
  loteId,
  activos,
  onEditar,
}: {
  loteId: string;
  activos: Activo[];
  onEditar: (activo: Activo) => void;
}) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const eliminar = useMutation({
    mutationFn: (activoId: string) => api.delete(`/activos/${activoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activos", "lote", loteId] });
      queryClient.invalidateQueries({ queryKey: ["activos"] });
      notificar("exito", "Activo eliminado");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  if (activos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-paper-300 p-4 text-center text-sm text-ink-600">
        Todavia no hay activos. Usa &quot;+ Activo&quot; sobre el mapa.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {activos.map((activo) => (
        <li key={activo.id} className="flex items-center justify-between gap-3 rounded-xl border border-paper-300 bg-paper-50 p-3.5">
          <div>
            <p className="text-sm font-medium text-ink-900">{activo.nombre}</p>
            <p className="text-xs text-ink-600">
              {activo.movilidad === "MOVIBLE" ? "movible" : "fijo"} · USD {activo.valorEstimado.toLocaleString("es-AR")}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => onEditar(activo)}
              className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:border-brand-500 hover:text-brand-700"
            >
              Editar
            </button>
            <button
              onClick={() => eliminar.mutate(activo.id)}
              disabled={eliminar.isPending}
              className="rounded-full border border-paper-300 px-3 py-1 text-xs text-risk-alto hover:border-risk-alto disabled:opacity-50"
            >
              Borrar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
