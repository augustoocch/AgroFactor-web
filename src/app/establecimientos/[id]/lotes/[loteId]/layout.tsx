"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { ContextoEnsoChip } from "@/components/ContextoEnsoChip";
import { Icono } from "@/components/Icono";
import { RiesgoChip } from "@/components/RiesgoChip";
import { api } from "@/lib/api";
import { rutaDe } from "@/lib/navegacion";
import type { EvaluacionRiesgo, Lote } from "@/lib/types";

const ETIQUETA_USO: Record<string, string> = {
  AGRICULTURA: "Agricultura",
  PASTURA: "Pastura",
  POTRERO: "Potrero",
  MONTE: "Monte",
  OTRO: "Otro uso",
};

/**
 * Un lote tiene dos trabajos distintos y antes estaban apilados en una sola pantalla de siete
 * bloques: ENTENDER su riesgo (lo que se consulta durante un evento) y CARGAR lo que tiene
 * adentro (lo que se hace una vez, en calma). Son dos pestañas con el mismo encabezado.
 *
 * Los formularios de alta y edicion (cultivos/…, activos/…) no llevan pestañas: tienen su propio
 * "volver al lote" y un solo objetivo.
 */
export default function LoteLayout({ children, params }: LayoutProps<"/establecimientos/[id]/lotes/[loteId]">) {
  const { id, loteId } = use(params);
  const pathname = usePathname();
  const base = `${rutaDe(id, "lotes")}/${loteId}`;
  const enFormulario = /\/(cultivos|activos)\//.test(pathname.slice(base.length));

  const { data: lote } = useQuery({
    queryKey: ["lote", loteId],
    queryFn: () => api.get<Lote>(`/lotes/${loteId}`),
  });
  const { data: evaluacion } = useQuery({
    queryKey: ["evaluacion-riesgo", loteId, "ultima"],
    queryFn: () => api.get<EvaluacionRiesgo>(`/lotes/${loteId}/evaluaciones-riesgo/ultima`),
    retry: false,
  });

  if (enFormulario) return <>{children}</>;

  const pestanas = [
    { href: base, etiqueta: "Riesgo y pronóstico" },
    { href: `${base}/mapa`, etiqueta: "Mapa y contenido" },
  ];

  return (
    <div>
      <nav aria-label="Ubicación" className="mb-3 flex items-center gap-1.5 text-sm text-ink-600">
        <Link href={rutaDe(id, "lotes")} className="hover:text-brand-700">
          Lotes
        </Link>
        <Icono nombre="derecha" className="h-3.5 w-3.5 text-ink-400" />
        <span className="text-ink-900">{lote?.nombre ?? "…"}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium leading-tight text-ink-950">
            {lote?.nombre ?? <span className="inline-block h-7 w-48 animate-pulse rounded bg-paper-200 align-middle" />}
          </h1>
          {lote && (
            <p className="mt-1 text-sm text-ink-600">
              {ETIQUETA_USO[lote.tipoUso] ?? lote.tipoUso} · se anegó {lote.antecedentesAnegamientoUltimos10Anios ?? 0} de
              los últimos 10 años
            </p>
          )}
        </div>
        {evaluacion && (
          <div className="flex items-center gap-2">
            <RiesgoChip score={evaluacion.scoreSusceptibilidad} />
            {evaluacion.factores.faseEnso && <ContextoEnsoChip fase={evaluacion.factores.faseEnso} />}
          </div>
        )}
      </header>

      <nav aria-label="Secciones del lote" className="mb-8 mt-6 flex gap-6 border-b border-paper-300">
        {pestanas.map((p) => {
          const activa = pathname === p.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={activa ? "page" : undefined}
              className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
                activa ? "border-brand-700 text-brand-700" : "border-transparent text-ink-600 hover:text-ink-950"
              }`}
            >
              {p.etiqueta}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
