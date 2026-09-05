"use client";

import { use } from "react";
import { PanelPlanAccion } from "@/components/PanelPlanAccion";

export default function PlanAccionPage({ params }: PageProps<"/establecimientos/[id]/plan-accion">) {
  const { id } = use(params);
  return <PanelPlanAccion establecimientoId={id} />;
}
