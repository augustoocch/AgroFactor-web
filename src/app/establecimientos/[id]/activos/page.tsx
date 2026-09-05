"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { use } from "react";
import { api } from "@/lib/api";
import { revealVariants } from "@/lib/motion";
import type { Activo, Lote } from "@/lib/types";

const ETIQUETA_TIPO: Record<string, string> = {
  HACIENDA: "Hacienda",
  MAQUINARIA: "Maquinaria",
  INSTALACION: "Instalacion",
  RESERVA_FORRAJERA: "Reserva forrajera",
  CAMINO_ACCESO: "Camino / acceso",
};

export default function ActivosPage({ params }: PageProps<"/establecimientos/[id]/activos">) {
  const { id } = use(params);

  const { data: activos = [], isLoading } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const nombreDeLote = (loteId: string | null) => lotes.find((l) => l.id === loteId)?.nombre ?? "sin lote";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-brand-600">Inventario</p>
        <h2 className="font-display text-lg font-medium text-ink-950">Activos</h2>
        <p className="mt-1 text-sm text-ink-600">
          Cada activo pertenece al lote desde cuya pantalla se lo agrego. Para cargar uno nuevo, o para pasar un activo
          movible a otro lote, entra al lote desde la pestania <span className="font-medium">Lotes</span>.
        </p>
      </div>

      {isLoading && <p className="text-sm text-ink-600">Cargando...</p>}

      {!isLoading && activos.length === 0 && (
        <p className="rounded-xl border border-dashed border-paper-300 p-6 text-center text-sm text-ink-600">
          Todavia no hay activos cargados.
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
            className="flex items-center justify-between rounded-xl border border-paper-300 bg-paper-50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink-900">{a.nombre}</p>
              <p className="text-xs text-ink-600">
                {ETIQUETA_TIPO[a.tipo]} · {nombreDeLote(a.loteAsociadoId)}
              </p>
            </div>
            <span className="font-mono text-sm text-ink-600">USD {a.valorEstimado.toLocaleString("es-AR")}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
