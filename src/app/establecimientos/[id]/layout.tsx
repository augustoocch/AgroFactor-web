"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { EstadoNoEncontrado } from "@/components/EstadoNoEncontrado";
import { IdCopiable } from "@/components/IdCopiable";
import { api } from "@/lib/api";
import type { Establecimiento } from "@/lib/types";

const ETIQUETA_TENENCIA: Record<string, string> = {
  PROPIO: "propio",
  ARRENDADO: "arrendado",
  MIXTO: "tenencia mixta",
};

function enlacesDe(id: string) {
  return [
    { href: `/establecimientos/${id}`, label: "Resumen" },
    { href: `/establecimientos/${id}/alertas`, label: "Alertas" },
    { href: `/establecimientos/${id}/meteorologia`, label: "Meteorologia" },
    { href: `/establecimientos/${id}/lotes`, label: "Lotes" },
    { href: `/establecimientos/${id}/activos`, label: "Activos" },
    { href: `/establecimientos/${id}/plan-accion`, label: "Plan de accion" },
    { href: `/establecimientos/${id}/reportes`, label: "Reportes" },
  ];
}

/** Pestanias horizontales en vez de un sidebar vertical: el mapa (el contenido real) recupera todo el ancho. */
export default function EstablecimientoLayout({ children, params }: LayoutProps<"/establecimientos/[id]">) {
  const { id } = use(params);
  const pathname = usePathname();
  const baseLotes = `/establecimientos/${id}/lotes`;
  const enLotes = pathname === baseLotes || pathname.startsWith(`${baseLotes}/`);

  const {
    data: establecimiento,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });

  return (
    <div className="space-y-5">
      {/* El usuario tiene que poder volver al listado sin adivinar que el logo es un link. */}
      <Link
        href="/establecimientos"
        className="inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-brand-700"
      >
        <span aria-hidden>←</span> Todos los establecimientos
      </Link>

      {isPending && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-paper-200" />
            <div className="h-6 w-64 animate-pulse rounded bg-paper-200" />
          </div>
          <div className="h-5 w-32 animate-pulse rounded-full bg-paper-200" />
        </div>
      )}

      {establecimiento && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-600">
              {establecimiento.partido}, {establecimiento.provincia}
            </p>
            <h1 className="font-display text-xl font-medium text-ink-950">{establecimiento.nombre}</h1>
            <div className="mt-1.5">
              <IdCopiable valor={establecimiento.id} />
            </div>
          </div>
          <span className="inline-block rounded-full bg-clay-100 px-2.5 py-0.5 text-xs font-medium text-clay-600">
            {establecimiento.perfilProductivo.toLowerCase()} · {ETIQUETA_TENENCIA[establecimiento.tipoTenencia]}
          </span>
        </div>
      )}

      {isError && <EstadoNoEncontrado error={error} onReintentar={() => refetch()} />}

      {/* Sin establecimiento las pestanias llevan a subpantallas que fallan de a una: mejor no ofrecerlas. */}
      {!isError && (
        <>
          <nav className="flex gap-1 overflow-x-auto border-b border-paper-300">
            {enlacesDe(id).map((link) => {
              const activo = link.label === "Lotes" ? enLotes : pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    activo ? "border-brand-700 text-brand-700" : "border-transparent text-ink-600 hover:text-ink-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div>{children}</div>
        </>
      )}
    </div>
  );
}
