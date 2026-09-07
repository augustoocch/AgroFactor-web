"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { PanelDatosFiscales } from "@/components/PanelDatosFiscales";
import { PanelDeclaracionDanos } from "@/components/PanelDeclaracionDanos";
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
      <PanelReportes establecimientoId={id} lotes={lotes} />
    </div>
  );
}
