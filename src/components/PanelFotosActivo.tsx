"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, clasificarError, obtenerImagenUrl, subirArchivo } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { ActivoFoto } from "@/lib/types";

const TAMANO_MAXIMO_MB = 5;
const CANTIDAD_MAXIMA = 6;
const FORMATOS_ACEPTADOS = "image/jpeg,image/png,image/webp";

/**
 * Fotos del activo: se adjuntan al informe de emergencia agropecuaria y documentan el estado
 * antes del evento (ver ReporteService#agregarFotosDelActivo). MVP guardado en la propia base,
 * sin storage externo — límites en ActivoFotoService: 5MB por foto, 6 por activo, jpg/png/webp.
 */
export function PanelFotosActivo({ activoId }: { activoId: string }) {
  const { data: fotos = [] } = useQuery({
    queryKey: ["activo-fotos", activoId],
    queryFn: () => api.get<ActivoFoto[]>(`/activos/${activoId}/fotos`),
  });

  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = useMutation({
    mutationFn: (archivo: File) => {
      const datos = new FormData();
      datos.append("archivo", archivo);
      return subirArchivo<ActivoFoto>(`/activos/${activoId}/fotos`, datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activo-fotos", activoId] });
      notificar("exito", "Foto subida");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const eliminar = useMutation({
    mutationFn: (fotoId: string) => api.delete(`/activos/${activoId}/fotos/${fotoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activo-fotos", activoId] });
      notificar("exito", "Foto eliminada");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const alcanzoElMaximo = fotos.length >= CANTIDAD_MAXIMA;

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-600">
        Se adjuntan al informe de emergencia agropecuaria. Hasta {CANTIDAD_MAXIMA} fotos por activo, {TAMANO_MAXIMO_MB}MB
        cada una, formato JPG, PNG o WEBP.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fotos.map((foto) => (
          <MiniaturaFoto key={foto.id} activoId={activoId} foto={foto} onBorrar={() => eliminar.mutate(foto.id)} borrando={eliminar.isPending} />
        ))}

        {!alcanzoElMaximo && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subir.isPending}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-paper-300 text-xs text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
          >
            <span className="text-xl" aria-hidden>
              +
            </span>
            {subir.isPending ? "Subiendo..." : "Agregar foto"}
          </button>
        )}
      </div>

      {alcanzoElMaximo && (
        <p className="text-xs text-ink-600">Llegaste al máximo de {CANTIDAD_MAXIMA} fotos. Borrá alguna para subir otra.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={FORMATOS_ACEPTADOS}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subir.mutate(archivo);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function MiniaturaFoto({
  activoId,
  foto,
  onBorrar,
  borrando,
}: {
  activoId: string;
  foto: ActivoFoto;
  onBorrar: () => void;
  borrando: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let objectUrl: string | null = null;
    obtenerImagenUrl(`/activos/${activoId}/fotos/${foto.id}/archivo`).then((u) => {
      if (cancelado) {
        URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
    });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activoId, foto.id]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-paper-300 bg-paper-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- viene de un blob autenticado, no de una URL publica optimizable
        <img src={url} alt={foto.nombreOriginal ?? "Foto del activo"} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse bg-paper-200" />
      )}
      <button
        type="button"
        onClick={onBorrar}
        disabled={borrando}
        className="absolute right-1.5 top-1.5 rounded-full bg-ink-950/70 px-2 py-0.5 text-[10px] font-medium text-paper-50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
      >
        Borrar
      </button>
    </div>
  );
}
