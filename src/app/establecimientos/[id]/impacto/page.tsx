"use client";

import { use } from "react";
import { PanelImpactoEconomico } from "@/components/PanelImpactoEconomico";

export default function ImpactoPage({ params }: PageProps<"/establecimientos/[id]/impacto">) {
  const { id } = use(params);
  return <PanelImpactoEconomico establecimientoId={id} />;
}
