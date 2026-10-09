"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icono } from "@/components/Icono";
import { easeOutExpo } from "@/lib/motion";

/**
 * Boton de info + panel lateral (no un Modal centrado) para explicar un numero o una decision de
 * diseno sin tapar el resto de la pantalla: pensado para contenido de REFERENCIA que se quiere
 * consultar mientras se sigue mirando el mapa/los datos de fondo (ej. el desglose de un score),
 * a diferencia de `Modal`, que sigue siendo lo correcto para decisiones que exigen atencion
 * exclusiva (confirmar un borrado, dibujar una geometria).
 *
 * Misma API que `InfoModal` (titulo/etiqueta/children) para poder migrar un uso puntual sin
 * reescribir el contenido.
 */
export function InfoAside({
  titulo,
  etiqueta,
  antetitulo = "Referencia",
  children,
}: {
  titulo: string;
  etiqueta?: string;
  /** "Referencia" para explicaciones; otra palabra cuando el panel es para ajustar algo. */
  antetitulo?: string;
  /** Como funcion recibe `cerrar`, para los paneles que terminan en una accion (guardar). */
  children: React.ReactNode | ((cerrar: () => void) => React.ReactNode);
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  return (
    <>
      {etiqueta ? (
        <button
          onClick={() => setAbierto(true)}
          aria-expanded={abierto}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline decoration-brand-200 underline-offset-[3px] transition-colors hover:decoration-brand-600"
        >
          <Icono nombre="info" className="h-4 w-4 shrink-0" />
          {etiqueta}
        </button>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          aria-label={`Qué significa: ${titulo}`}
          aria-expanded={abierto}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-500 transition-colors hover:text-brand-700"
        >
          <Icono nombre="info" className="h-4 w-4" />
        </button>
      )}

      <AnimatePresence>
        {abierto && (
          <>
            {/* Sin scrim oscuro: es contenido de referencia, no un bloqueo. Este overlay
                invisible solo existe para poder cerrar clickeando afuera. */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAbierto(false)}
            />
            <motion.aside
              role="complementary"
              aria-label={titulo}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease: easeOutExpo }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-paper-300 bg-paper-50 shadow-[-24px_0_48px_-24px_rgb(20_30_45/0.25)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-paper-200 px-5 py-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-brand-600">{antetitulo}</p>
                  <h2 className="font-display text-lg font-medium leading-snug text-ink-950">{titulo}</h2>
                </div>
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="rounded-full p-1.5 text-ink-600 transition-colors hover:bg-paper-200 hover:text-ink-950"
                >
                  <Icono nombre="cerrar" className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-ink-800">
                {typeof children === "function" ? children(() => setAbierto(false)) : children}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
