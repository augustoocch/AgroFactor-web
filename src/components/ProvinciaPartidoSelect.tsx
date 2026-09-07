"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PartidoCatalogo, ProvinciaCatalogo } from "@/lib/types";

interface Props {
  provincia: string;
  partido: string;
  onCambiarProvincia: (provincia: string) => void;
  onCambiarPartido: (partido: string) => void;
}

const selectClassName =
  "mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500";

/** Selector en dos pasos (provincia -> partido) contra el catalogo de CatalogoPartidosService en api-core. */
export function ProvinciaPartidoSelect({ provincia, partido, onCambiarProvincia, onCambiarPartido }: Props) {
  const [provinciaCodigo, setProvinciaCodigo] = useState("");

  const { data: provincias = [] } = useQuery({
    queryKey: ["catalogo-provincias"],
    queryFn: () => api.get<ProvinciaCatalogo[]>("/catalogo/provincias"),
    staleTime: Infinity,
  });

  const { data: partidos = [] } = useQuery({
    queryKey: ["catalogo-partidos", provinciaCodigo],
    queryFn: () => api.get<PartidoCatalogo[]>(`/catalogo/provincias/${provinciaCodigo}/partidos`),
    enabled: !!provinciaCodigo,
    staleTime: Infinity,
  });

  // Si el formulario resetea la provincia por fuera (ej. al limpiar el form), el codigo interno
  // tiene que acompanar. Se ajusta durante el render y no en un efecto: un efecto que llama a
  // setState dispara un render en cascada, y ademas deja un frame con el codigo viejo apuntando
  // a una provincia que ya no esta elegida.
  const [provinciaAnterior, setProvinciaAnterior] = useState(provincia);
  if (provincia !== provinciaAnterior) {
    setProvinciaAnterior(provincia);
    if (!provincia) setProvinciaCodigo("");
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-ink-800">Provincia</label>
        <select
          className={selectClassName}
          value={provinciaCodigo}
          onChange={(e) => {
            const codigo = e.target.value;
            const nombre = provincias.find((p) => p.codigo === codigo)?.nombre ?? "";
            setProvinciaCodigo(codigo);
            onCambiarProvincia(nombre);
            onCambiarPartido("");
          }}
        >
          <option value="">Seleccionar...</option>
          {provincias.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-800">Partido</label>
        <select
          className={selectClassName}
          value={partido}
          disabled={!provinciaCodigo}
          onChange={(e) => onCambiarPartido(e.target.value)}
        >
          <option value="">{provinciaCodigo ? "Seleccionar..." : "Elegi una provincia primero"}</option>
          {partidos.map((p) => (
            <option key={p.id} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
