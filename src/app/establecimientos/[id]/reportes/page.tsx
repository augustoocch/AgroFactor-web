"use client";

import { use } from "react";
import { PanelDatosFiscales } from "@/components/PanelDatosFiscales";
import { PanelDeclaracionDanos } from "@/components/PanelDeclaracionDanos";
import { PanelDuracionAnegamiento } from "@/components/PanelDuracionAnegamiento";
import { PanelImpactoEconomico } from "@/components/PanelImpactoEconomico";
import { PanelReportes } from "@/components/PanelReportes";

export default function ReportesPage({ params }: PageProps<"/establecimientos/[id]/reportes">) {
  const { id } = use(params);

  return (
    <div className="space-y-5">
      <PanelDatosFiscales establecimientoId={id} />
      <PanelDeclaracionDanos establecimientoId={id} />
      {/* Cuanto va a durar el agua va ANTES de cuanta plata hay en juego: la duracion es lo que
          decide si la hacienda se mueve de potrero o se saca del campo, y esa decision se toma
          durante el evento, mientras que el informe economico se arma despues. */}
      <PanelDuracionAnegamiento establecimientoId={id} />
      <PanelImpactoEconomico establecimientoId={id} />
      <PanelReportes establecimientoId={id} />
    </div>
  );
}
