"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { use } from "react";
import { api, clasificarError } from "@/lib/api";
import { revealVariants } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import type { Activo, Lote } from "@/lib/types";

const ETIQUETA_TIPO: Record<string, string> = {
  HACIENDA: "Hacienda",
  MAQUINARIA: "Maquinaria",
  INSTALACION: "Instalación",
  RESERVA_FORRAJERA: "Reserva forrajera",
  CAMINO_ACCESO: "Camino / acceso",
};

export default function ActivosPage({ params }: PageProps<"/establecimientos/[id]/activos">) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: activos = [], isLoading } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const nombreDeLote = (loteId: string | null) => lotes.find((l) => l.id === loteId)?.nombre ?? "sin lote";

  const eliminar = useMutation({
    mutationFn: (activo: Activo) => api.delete(`/activos/${activo.id}`),
    onSuccess: (_data, activo) => {
      queryClient.invalidateQueries({ queryKey: ["activos", id] });
      if (activo.loteAsociadoId) queryClient.invalidateQueries({ queryKey: ["activos", "lote", activo.loteAsociadoId] });
      notificar("exito", "Activo eliminado");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-brand-600">Inventario</p>
        <h2 className="font-display text-lg font-medium text-ink-950">Activos</h2>
        <p className="mt-1 text-sm text-ink-600">
          Cada activo pertenece al lote desde cuya pantalla se lo agregó. Para cargar uno nuevo, o para pasar un activo
          movible a otro lote, entrá al lote desde la pestaña <span className="font-medium">Lotes</span>.
        </p>
      </div>

      {isLoading && <p className="text-sm text-ink-600">Cargando...</p>}

      {!isLoading && activos.length === 0 && (
        <p className="rounded-xl border border-dashed border-paper-300 p-6 text-center text-sm text-ink-600">
          Todavía no hay activos cargados.
        </p>
      )}

      <ul className="space-y-2">
        {activos.map((a, i) => (
          <motion.li
            key={a.id}
            initial="hidden"
            animate="visible"
            custom={i}
            variants={revealVariants}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-300 bg-paper-50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink-900">{a.nombre}</p>
              <p className="text-xs text-ink-600">
                {ETIQUETA_TIPO[a.tipo]} · {nombreDeLote(a.loteAsociadoId)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-sm text-ink-600">USD {a.valorEstimado.toLocaleString("es-AR")}</span>
              {a.loteAsociadoId && (
                <button
                  onClick={() => router.push(`/establecimientos/${id}/lotes/${a.loteAsociadoId}/activos/${a.id}`)}
                  className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:border-brand-500 hover:text-brand-700"
                >
                  Editar
                </button>
              )}
              <button
                onClick={() => eliminar.mutate(a)}
                disabled={eliminar.isPending}
                className="rounded-full border border-paper-300 px-3 py-1 text-xs text-risk-alto hover:border-risk-alto disabled:opacity-50"
              >
                Borrar
              </button>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
