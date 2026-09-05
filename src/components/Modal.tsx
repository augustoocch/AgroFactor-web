"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { easeOutExpo } from "@/lib/motion";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
}

/** Modal generico reutilizado tanto para formularios en contexto (dibujar lote/activo) como para contenido explicativo (InfoModal). */
export function Modal({ abierto, onCerrar, titulo, children }: Props) {
  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onCerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-titulo"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-paper-300 bg-paper-50 p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="modal-titulo" className="font-display text-lg font-medium text-ink-950">
                {titulo}
              </h2>
              <button
                onClick={onCerrar}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-ink-600 transition-colors hover:bg-paper-200 hover:text-ink-950"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
