"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { PanelReportes } from "@/components/PanelReportes";
import { api } from "@/lib/api";
import { enlace } from "@/lib/estilos";
import { rutaDe } from "@/lib/navegacion";
import type { Establecimiento } from "@/lib/types";

/**
 * Salida documental: el informe de emergencia agropecuaria y todo lo emitido. Los datos fiscales
 * que el informe necesita se cargan en "Datos y acceso"; aca solo se avisa si faltan y se enlaza.
 */
export default function InformesPage({ params }: PageProps<"/establecimientos/[id]/informes">) {
  const { id } = use(params);
  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });

  const faltan = establecimiento
    ? [!establecimiento.cuit && "el CUIT", !establecimiento.renspa && "el RENSPA"].filter(Boolean)
    : [];

  return (
    <div>
      <EncabezadoPantalla
        segmento="informes"
        titulo="Informes"
        descripcion="Documentos en PDF armados con lo que el sistema ya sabe de tu campo, para presentar ante un organismo o una aseguradora."
      />

      {faltan.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-clay-400 bg-clay-100/60 px-5 py-4">
          <p className="text-sm text-ink-800">
            Falta cargar {faltan.join(" y ")}. Sin eso, el informe no identifica al productor ni al predio.
          </p>
          <Link href={rutaDe(id, "ajustes")} className={`${enlace} text-sm`}>
            Completar en Datos y acceso
          </Link>
        </div>
      )}

      <PanelReportes establecimientoId={id} />
    </div>
  );
}
