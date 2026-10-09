"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { api, clasificarError } from "@/lib/api";
import { boton, enlace } from "@/lib/estilos";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type { Activo, Lote } from "@/lib/types";

const ETIQUETA_TIPO: Record<string, string> = {
  HACIENDA: "Hacienda",
  MAQUINARIA: "Maquinaria",
  INSTALACION: "Instalación",
  RESERVA_FORRAJERA: "Reserva forrajera",
  CAMINO_ACCESO: "Camino / acceso",
};

/**
 * Inventario de todo el establecimiento, agrupado por lote. Es la vista de conjunto; la carga se
 * hace en el mapa de cada lote, porque la ubicacion del activo es lo que define su exposicion.
 * El selector de arriba lleva directo a ese mapa en vez de explicar como llegar.
 */
export default function ActivosPage({ params }: PageProps<"/establecimientos/[id]/activos">) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [aBorrar, setABorrar] = useState<Activo | null>(null);

  const { data: activos = [], isLoading } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const eliminar = useMutation({
    mutationFn: (activo: Activo) => api.delete(`/activos/${activo.id}`),
    onSuccess: (_data, activo) => {
      queryClient.invalidateQueries({ queryKey: ["activos", id] });
      if (activo.loteAsociadoId) queryClient.invalidateQueries({ queryKey: ["activos", "lote", activo.loteAsociadoId] });
      notificar("exito", "Activo eliminado");
      setABorrar(null);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const total = activos.reduce((acc, a) => acc + a.valorEstimado, 0);
  const grupos = [
    ...lotes.map((l) => ({ lote: l as Lote | null, activos: activos.filter((a) => a.loteAsociadoId === l.id) })),
    { lote: null, activos: activos.filter((a) => !a.loteAsociadoId || !lotes.some((l) => l.id === a.loteAsociadoId)) },
  ].filter((g) => g.activos.length > 0);

  return (
    <div>
      <EncabezadoPantalla
        segmento="activos"
        titulo="Activos"
        descripcion="Hacienda, maquinaria, instalaciones y reservas de todo el campo. Cada activo se ubica en el mapa de su lote, porque de eso depende cuánto lo expone el agua."
        acciones={
          lotes.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <span className="whitespace-nowrap">Agregar en</span>
              <select
                defaultValue=""
                onChange={(e) => e.target.value && router.push(`${rutaDe(id, "lotes")}/${e.target.value}/mapa`)}
                className="rounded-full border border-brand-500 bg-paper-50 px-3 py-2 text-sm font-medium text-brand-700 outline-none"
              >
                <option value="" disabled>
                  elegir lote
                </option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />

      {isLoading && <p className="text-sm text-ink-600">Cargando...</p>}

      {!isLoading && activos.length === 0 && (
        <div className="rounded-xl border border-dashed border-paper-300 px-6 py-10 text-center">
          <p className="font-display text-lg text-ink-950">Todavía no hay activos</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            Entrá a un lote, pasá a “Mapa y contenido” y usá “+ Activo” para marcar dónde está.
          </p>
          <Link href={rutaDe(id, "lotes")} className={`${boton.secundario} mt-4`}>
            Ir a lotes
          </Link>
        </div>
      )}

      {activos.length > 0 && (
        <>
          <div className="mb-8 border-l-2 border-brand-500 pl-4">
            <p className="font-display text-3xl font-medium tabular-nums text-ink-950">
              USD {total.toLocaleString("es-AR")}
            </p>
            <p className="text-sm text-ink-600">valor declarado de {activos.length} activos</p>
          </div>

          <div className="space-y-8">
            {grupos.map(({ lote, activos: delLote }) => (
              <section key={lote?.id ?? "sin-lote"}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-lg font-medium text-ink-950">{lote?.nombre ?? "Sin lote asignado"}</h2>
                  {lote && (
                    <Link href={`${rutaDe(id, "lotes")}/${lote.id}/mapa`} className={`${enlace} text-sm`}>
                      Ver en el mapa
                    </Link>
                  )}
                </div>
                <ul className="divide-y divide-paper-200 rounded-xl border border-paper-300 bg-paper-50">
                  {delLote.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-950">{a.nombre}</p>
                        <p className="text-sm text-ink-600">
                          {ETIQUETA_TIPO[a.tipo]} · {a.movilidad === "MOVIBLE" ? "se puede mover" : "fijo"}
                        </p>
                      </div>
                      <span className="font-mono text-sm tabular-nums text-ink-700">
                        USD {a.valorEstimado.toLocaleString("es-AR")}
                      </span>
                      <div className="flex gap-2">
                        {a.loteAsociadoId && (
                          <Link
                            href={`${rutaDe(id, "lotes")}/${a.loteAsociadoId}/activos/${a.id}`}
                            className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:border-brand-500 hover:text-brand-700"
                          >
                            Editar
                          </Link>
                        )}
                        <button
                          onClick={() => setABorrar(a)}
                          className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-600 hover:border-risk-alto hover:text-risk-alto-ink"
                        >
                          Borrar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <ConfirmarBorrado
        abierto={aBorrar !== null}
        titulo={`Borrar "${aBorrar?.nombre ?? ""}"`}
        queSeBorra="Se borra el activo con su ficha. Deja de aparecer en el plan de acción y en los informes nuevos."
        borrando={eliminar.isPending}
        onConfirmar={() => aBorrar && eliminar.mutate(aBorrar)}
        onCerrar={() => setABorrar(null)}
      />
    </div>
  );
}
