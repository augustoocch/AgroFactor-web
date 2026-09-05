"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { CultivoImplantado } from "@/lib/types";

const ETIQUETA_MARGEN: Record<string, string> = {
  NINGUNO: "sin margen de accion",
  COSECHA_ANTICIPADA: "cosecha anticipada",
  RESIEMBRA: "resiembra",
};

export function ListaCultivos({
  loteId,
  cultivos,
  onEditar,
}: {
  loteId: string;
  cultivos: CultivoImplantado[];
  onEditar: (cultivo: CultivoImplantado) => void;
}) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const eliminar = useMutation({
    mutationFn: (cultivoId: string) => api.delete(`/cultivos/${cultivoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivos", loteId] });
      notificar("exito", "Zona de cultivo eliminada");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  if (cultivos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-paper-300 p-4 text-center text-sm text-ink-600">
        Todavia no hay zonas de cultivo. Usa &quot;+ Zona de cultivo&quot; sobre el mapa.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {cultivos.map((cultivo) => (
        <li key={cultivo.id} className="rounded-xl border border-paper-300 bg-paper-50 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-900">{cultivo.tipoCultivo}</p>
              <p className="text-xs text-ink-600">
                {cultivo.estadoFenologico} · sembrado {new Date(cultivo.fechaSiembra).toLocaleDateString("es-AR")} ·{" "}
                {ETIQUETA_MARGEN[cultivo.margenAccion]}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => onEditar(cultivo)}
                className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:border-brand-500 hover:text-brand-700"
              >
                Editar
              </button>
              <button
                onClick={() => eliminar.mutate(cultivo.id)}
                disabled={eliminar.isPending}
                className="rounded-full border border-paper-300 px-3 py-1 text-xs text-risk-alto hover:border-risk-alto disabled:opacity-50"
              >
                Borrar
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
