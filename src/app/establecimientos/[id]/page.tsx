"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { EstadoNoEncontrado } from "@/components/EstadoNoEncontrado";
import { NuevoLoteForm } from "@/components/NuevoLoteForm";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { useReubicarActivo, useScoresRiesgo } from "@/lib/hooks";
import { revealVariants } from "@/lib/motion";
import type { Activo, Coordenada, Establecimiento, Lote } from "@/lib/types";

const MapaEstablecimiento = dynamic(
  () => import("@/components/MapaEstablecimiento").then((m) => m.MapaEstablecimiento),
  { ssr: false },
);

export default function ResumenEstablecimientoPage({ params }: PageProps<"/establecimientos/[id]">) {
  const { id } = use(params);
  const [anilloNuevoLote, setAnilloNuevoLote] = useState<Coordenada[] | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const {
    data: establecimiento,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data: activos = [] } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const borrarEstablecimiento = useMutation({
    mutationFn: () => api.delete(`/establecimientos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["establecimientos"] });
      notificar("exito", "Establecimiento eliminado");
      router.push("/establecimientos");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const scorePorLote = useScoresRiesgo(lotes);
  const reubicarActivo = useReubicarActivo(id);

  // Cargando, no encontrado y cargado son tres estados distintos. Antes el unico gate era
  // `data`, asi que un 404 se veia identico a una carga en curso y no salia nunca de ahi.
  if (isError) return <EstadoNoEncontrado error={error} onReintentar={() => refetch()} />;
  if (isPending || !establecimiento) return <p className="text-sm text-ink-600">Cargando...</p>;

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" variants={revealVariants} className="space-y-3">
        <MapaEstablecimiento
          establecimientoId={id}
          lotes={lotes}
          activos={activos}
          scorePorLote={scorePorLote}
          onLoteDibujado={setAnilloNuevoLote}
          onActivoMovido={(activo, coordenada) => reubicarActivo.mutate({ activo, coordenada })}
        />
        <p className="text-xs text-ink-600">
          Usa el boton sobre el mapa para dibujar un lote nuevo. Los cultivos y los activos se cargan dentro de cada
          lote, desde la pestania <span className="font-medium">Lotes</span>.
        </p>
      </motion.div>

      <div className="flex justify-end border-t border-paper-300 pt-4">
        <button
          onClick={() => setConfirmandoBorrado(true)}
          className="rounded-full border border-paper-300 px-3.5 py-1.5 text-sm text-ink-600 hover:border-risk-alto hover:text-risk-alto"
        >
          Borrar establecimiento
        </button>
      </div>

      <ConfirmarBorrado
        abierto={confirmandoBorrado}
        titulo={`Borrar "${establecimiento.nombre}"`}
        queSeBorra={`Se borran sus ${lotes.length} lote(s) con sus cultivos, ${activos.length} activo(s), las evaluaciones de riesgo, los planes de accion y los reportes generados.`}
        confirmacionEscrita={establecimiento.nombre}
        borrando={borrarEstablecimiento.isPending}
        onConfirmar={() => borrarEstablecimiento.mutate()}
        onCerrar={() => setConfirmandoBorrado(false)}
      />

      <NuevoLoteForm establecimientoId={id} anillo={anilloNuevoLote} onCerrar={() => setAnilloNuevoLote(null)} />
    </div>
  );
}
