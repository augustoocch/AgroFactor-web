"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { EstablecimientoShell } from "@/components/EstablecimientoShell";
import { EstadoNoEncontrado } from "@/components/EstadoNoEncontrado";
import { api } from "@/lib/api";
import type { Establecimiento } from "@/lib/types";

/**
 * Todo establecimiento abierto vive dentro del menu lateral. Lo que antes estaba en el encabezado
 * de cada pantalla (ID copiable, tenencia, perfil, "volver al listado") se reparte donde se usa:
 * el nombre y el cambio de establecimiento en el menu, el ID en "Datos y acceso".
 */
export default function EstablecimientoLayout({ children, params }: LayoutProps<"/establecimientos/[id]">) {
  const { id } = use(params);

  const {
    data: establecimiento,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });

  return (
    <EstablecimientoShell establecimientoId={id} establecimiento={establecimiento}>
      {/* Sin establecimiento, cada pantalla fallaria por su cuenta: mejor un solo estado claro. */}
      {isError ? <EstadoNoEncontrado error={error} onReintentar={() => refetch()} /> : children}
    </EstablecimientoShell>
  );
}
