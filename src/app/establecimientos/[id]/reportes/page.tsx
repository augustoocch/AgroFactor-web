"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { PanelDatosFiscales } from "@/components/PanelDatosFiscales";
import { PanelDeclaracionDanos } from "@/components/PanelDeclaracionDanos";
import { PanelDuracionAnegamiento } from "@/components/PanelDuracionAnegamiento";
import { PanelImpactoEconomico } from "@/components/PanelImpactoEconomico";
import { PanelReportes } from "@/components/PanelReportes";
import { api } from "@/lib/api";
import type { Lote } from "@/lib/types";

export default function ReportesPage({ params }: PageProps<"/establecimientos/[id]/reportes">) {
  const { id } = use(params);

  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  return (
    <div className="space-y-5">
      <PanelDatosFiscales establecimientoId={id} />
      <PanelDeclaracionDanos establecimientoId={id} />
      {/* Cuanto va a durar el agua va ANTES de cuanta plata hay en juego: la duracion es lo que
          decide si la hacienda se mueve de potrero o se saca del campo, y esa decision se toma
          durante el evento, mientras que el informe economico se arma despues. */}
      <PanelDuracionAnegamiento establecimientoId={id} />
      <PanelImpactoEconomico establecimientoId={id} />
      <PanelReportes establecimientoId={id} lotes={lotes} />
    </div>
  );
}
