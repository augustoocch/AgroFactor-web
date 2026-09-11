"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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
  children,
}: {
  titulo: string;
  etiqueta?: string;
  children: React.ReactNode;
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
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 px-2.5 py-0.5 text-xs font-medium text-ink-700 transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none">
            i
          </span>
          {etiqueta}
        </button>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          aria-label={`Que significa: ${titulo}`}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink-400 text-[10px] leading-none text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          i
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
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-paper-300 bg-paper-50 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-paper-200 px-5 py-4">
                <h2 className="font-display text-lg font-medium text-ink-950">{titulo}</h2>
                <button
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="rounded-full p-1.5 text-ink-600 transition-colors hover:bg-paper-200 hover:text-ink-950"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
