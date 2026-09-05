"use client";

import { use } from "react";
import { BandejaAlertas } from "@/components/BandejaAlertas";

export default function AlertasPage({ params }: PageProps<"/establecimientos/[id]/alertas">) {
  const { id } = use(params);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-brand-600">Vigilancia diaria</p>
        <p className="mt-1 text-sm text-ink-600">
          El sistema corre la simulacion de cada lote todas las madrugadas sobre el pronostico real y avisa antes de
          que el agua llegue, con cuanta lamina esperar, sobre que parte del lote y en cuantas horas.
        </p>
      </div>
      <BandejaAlertas establecimientoId={id} />
    </div>
  );
}
