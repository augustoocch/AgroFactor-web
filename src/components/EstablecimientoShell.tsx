"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Icono } from "@/components/Icono";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { easeOutExpo } from "@/lib/motion";
import { GRUPOS, rutaDe, seccionActiva, type Seccion } from "@/lib/navegacion";
import { ETIQUETA_ACCESO } from "@/lib/permisos";
import type { Alerta, Establecimiento, NivelAlerta } from "@/lib/types";

const CLAVE_CONTRAIDO = "agrofactor.menu-contraido";

/*
 * Preferencia de menu contraido. Es una comodidad de este navegador, no un dato: si el storage
 * no esta disponible (ventana privada, bloqueado) el menu arranca abierto y listo.
 */
const oyentes = new Set<() => void>();
function leerContraido(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_CONTRAIDO) === "1";
  } catch {
    return false;
  }
}
function guardarContraido(valor: boolean) {
  try {
    window.localStorage.setItem(CLAVE_CONTRAIDO, valor ? "1" : "0");
  } catch {
    /* sin storage: la preferencia dura lo que la pestaña */
  }
  oyentes.forEach((o) => o());
}
function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

const PESO_NIVEL: Record<NivelAlerta, number> = { CRITICA: 3, ATENCION: 2, INFORMATIVA: 1 };

/**
 * Armazon de todas las pantallas de un establecimiento: menu lateral agrupado por momento del
 * evento + area de contenido.
 *
 * Reemplaza a la fila de siete pestañas planas. Con pestañas, "Reportes" y "Meteorologia" tenian
 * que absorber lo que no entraba en otro lado; con grupos, cada pantalla tiene una sola
 * responsabilidad y el grupo le dice al usuario en que momento se usa.
 *
 * En escritorio el menu se contrae a una columna de iconos para devolverle el ancho al mapa. En
 * pantallas chicas se vuelve un cajon que se abre desde la barra superior.
 */
export function EstablecimientoShell({
  establecimientoId,
  establecimiento,
  children,
}: {
  establecimientoId: string;
  establecimiento: Establecimiento | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const contraido = useSyncExternalStore(suscribir, leerContraido, () => false);
  const [cajonAbierto, setCajonAbierto] = useState(false);

  // Navegar cierra el cajon: quedarse con el menu tapando la pantalla que se acaba de pedir
  // obligaria a un segundo toque para ver algo.
  const [rutaPrevia, setRutaPrevia] = useState(pathname);
  if (rutaPrevia !== pathname) {
    setRutaPrevia(pathname);
    setCajonAbierto(false);
  }

  useEffect(() => {
    if (!cajonAbierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCajonAbierto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cajonAbierto]);

  return (
    <div className="flex min-h-screen flex-1">
      {/* Escritorio */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-950 text-paper-100 transition-[width] duration-300 ease-[var(--ease-out-expo)] lg:flex ${
          contraido ? "w-[4.25rem]" : "w-64"
        }`}
      >
        <ContenidoMenu
          establecimientoId={establecimientoId}
          establecimiento={establecimiento}
          pathname={pathname}
          contraido={contraido}
          onAlternar={() => guardarContraido(!contraido)}
        />
      </aside>

      {/* Pantallas chicas: barra superior + cajon */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-900 bg-brand-950 px-4 py-2.5 text-paper-100 lg:hidden">
          <button
            onClick={() => setCajonAbierto(true)}
            aria-label="Abrir menú"
            aria-expanded={cajonAbierto}
            className="-ml-1 rounded-md p-1.5 text-brand-200 transition-colors hover:bg-white/10 hover:text-paper-50"
          >
            <Icono nombre="menu" />
          </button>
          <div className="min-w-0">
            <p className="truncate font-display text-[0.95rem] font-medium leading-tight text-paper-50">
              {establecimiento?.nombre ?? "Establecimiento"}
            </p>
            {establecimiento && (
              <p className="truncate text-[11px] text-brand-200">
                {establecimiento.partido}, {establecimiento.provincia}
              </p>
            )}
          </div>
        </div>

        <AnimatePresence>
          {cajonAbierto && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-ink-950/45 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCajonAbierto(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.32, ease: easeOutExpo }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-brand-950 text-paper-100 lg:hidden"
              >
                <ContenidoMenu
                  establecimientoId={establecimientoId}
                  establecimiento={establecimiento}
                  pathname={pathname}
                  contraido={false}
                  onCerrar={() => setCajonAbierto(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="mx-auto w-full max-w-[76rem] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}

function ContenidoMenu({
  establecimientoId,
  establecimiento,
  pathname,
  contraido,
  onAlternar,
  onCerrar,
}: {
  establecimientoId: string;
  establecimiento: Establecimiento | undefined;
  pathname: string;
  contraido: boolean;
  onAlternar?: () => void;
  onCerrar?: () => void;
}) {
  const { sesion, cerrarSesion } = useAuth();
  const router = useRouter();
  const activa = seccionActiva(pathname, establecimientoId);

  // La misma consulta que usa la bandeja: react-query la comparte, no es un pedido de mas.
  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas", establecimientoId],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${establecimientoId}/alertas`),
    enabled: !!establecimiento,
  });
  const nivelMaximo = alertas.reduce<NivelAlerta | null>(
    (max, a) => (max == null || PESO_NIVEL[a.nivel] > PESO_NIVEL[max] ? a.nivel : max),
    null,
  );

  return (
    <>
      <div className={`flex items-center border-b border-white/10 py-4 ${contraido ? "justify-center px-2" : "justify-between px-5"}`}>
        <Link href="/establecimientos" className="flex items-center gap-2.5" aria-label="AgroFactor, todos los establecimientos">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-paper-50">
            <BrandMark className="h-6 w-6" />
          </span>
          {!contraido && <span className="font-display text-[1.05rem] font-medium text-paper-50">AgroFactor</span>}
        </Link>
        {onCerrar && (
          <button
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="rounded-md p-1.5 text-brand-200 hover:bg-white/10 hover:text-paper-50"
          >
            <Icono nombre="cerrar" className="h-4 w-4" />
          </button>
        )}
      </div>

      {!contraido && (
        <div className="border-b border-white/10 px-5 py-4">
          {establecimiento ? (
            <>
              <p className="font-display text-lg font-medium leading-snug text-paper-50">{establecimiento.nombre}</p>
              <p className="mt-0.5 text-xs text-brand-200">
                {establecimiento.partido}, {establecimiento.provincia}
              </p>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
            </div>
          )}
          <Link
            href="/establecimientos"
            className="mt-3 inline-flex items-center gap-1 text-xs text-brand-200 transition-colors hover:text-paper-50"
          >
            <Icono nombre="cambiar" className="h-3.5 w-3.5" />
            Cambiar de establecimiento
          </Link>
        </div>
      )}

      <nav
        aria-label="Secciones del establecimiento"
        className={`flex-1 py-3 ${contraido ? "px-2" : "overflow-y-auto px-3"}`}
      >
        {GRUPOS.map((grupo, i) => (
          <div key={grupo.titulo ?? "inicio"} className={i > 0 ? "mt-4" : ""}>
            {grupo.titulo &&
              (contraido ? (
                <div className="mx-2 mb-2 border-t border-white/10" />
              ) : (
                <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-brand-200/70">
                  {grupo.titulo}
                </p>
              ))}
            <ul className="space-y-0.5">
              {grupo.secciones.map((seccion) => (
                <ItemMenu
                  key={seccion.segmento}
                  seccion={seccion}
                  href={rutaDe(establecimientoId, seccion.segmento)}
                  activo={activa === seccion.segmento}
                  contraido={contraido}
                  aviso={seccion.segmento === "alertas" && alertas.length > 0 ? { cantidad: alertas.length, nivel: nivelMaximo! } : null}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`border-t border-white/10 py-3 ${contraido ? "px-2" : "px-3"}`}>
        {onAlternar && (
          <button
            onClick={onAlternar}
            className={`group/tip relative flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-brand-200 transition-colors hover:bg-white/10 hover:text-paper-50 ${
              contraido ? "justify-center" : ""
            }`}
            aria-label={contraido ? "Expandir menú" : "Contraer menú"}
          >
            <Icono nombre={contraido ? "expandir" : "contraer"} className="h-[1.15rem] w-[1.15rem] shrink-0" />
            {!contraido && "Contraer menú"}
            {contraido && <EtiquetaFlotante texto="Expandir menú" />}
          </button>
        )}
        {sesion && (
          <div className={`mt-1 flex items-center gap-3 rounded-md px-2.5 py-2 ${contraido ? "justify-center" : ""}`}>
            {!contraido && (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm text-paper-50">{sesion.nombre}</p>
                {/* El rol es por campo: el mismo usuario puede ser dueño de uno y asesor de otro. */}
                {establecimiento && <p className="text-[11px] text-brand-200">{ETIQUETA_ACCESO[establecimiento.miAcceso]}</p>}
              </div>
            )}
            <button
              onClick={() => {
                cerrarSesion();
                router.replace("/login");
              }}
              aria-label="Cerrar sesión"
              className="group/tip relative rounded-md p-1.5 text-brand-200 transition-colors hover:bg-white/10 hover:text-paper-50"
            >
              <Icono nombre="salir" className="h-[1.15rem] w-[1.15rem]" />
              <EtiquetaFlotante texto="Cerrar sesión" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const COLOR_AVISO: Record<NivelAlerta, string> = {
  CRITICA: "bg-risk-alto text-paper-50",
  ATENCION: "bg-risk-medio text-ink-950",
  INFORMATIVA: "bg-brand-200 text-brand-950",
};

function ItemMenu({
  seccion,
  href,
  activo,
  contraido,
  aviso,
}: {
  seccion: Seccion;
  href: string;
  activo: boolean;
  contraido: boolean;
  aviso: { cantidad: number; nivel: NivelAlerta } | null;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={activo ? "page" : undefined}
        aria-label={contraido ? seccion.etiqueta : undefined}
        className={`group/tip relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
          contraido ? "justify-center" : ""
        } ${activo ? "bg-white/[0.09] text-paper-50" : "text-brand-200 hover:bg-white/5 hover:text-paper-50"}`}
      >
        {activo && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-clay-400" />}
        <span className="relative shrink-0">
          <Icono nombre={seccion.icono} className="h-[1.15rem] w-[1.15rem]" />
          {aviso && contraido && (
            <span aria-hidden className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${COLOR_AVISO[aviso.nivel].split(" ")[0]}`} />
          )}
        </span>
        {!contraido && <span className="flex-1 truncate">{seccion.etiqueta}</span>}
        {!contraido && aviso && (
          <span className={`rounded-full px-1.5 text-[11px] font-medium tabular-nums leading-5 ${COLOR_AVISO[aviso.nivel]}`}>
            {aviso.cantidad}
          </span>
        )}
        {contraido && (
          <EtiquetaFlotante texto={seccion.etiqueta} detalle={aviso ? `${aviso.cantidad} activa(s)` : seccion.proposito} />
        )}
      </Link>
    </li>
  );
}

/** Nombre de la seccion al pasar sobre un icono del menu contraido. */
function EtiquetaFlotante({ texto, detalle }: { texto: string; detalle?: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-950 px-2.5 py-1.5 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100"
    >
      <span className="block text-xs font-medium text-paper-50">{texto}</span>
      {detalle && <span className="block text-[11px] text-ink-300">{detalle}</span>}
    </span>
  );
}
