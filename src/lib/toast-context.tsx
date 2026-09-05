"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useState } from "react";
import { easeOutExpo } from "@/lib/motion";

export type TipoToast = "error-validacion" | "error-servicio" | "exito";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
  onReintentar?: () => void;
}

interface ToastContextValue {
  /** error-validacion: mensaje del backend tal cual. error-servicio: algo (red/risk-engine) no responde, admite reintentar. exito: confirmacion. */
  notificar: (tipo: TipoToast, mensaje: string, onReintentar?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ESTILO_POR_TIPO: Record<TipoToast, string> = {
  "error-validacion": "border-risk-alto bg-risk-alto-bg text-risk-alto",
  "error-servicio": "border-clay-500 bg-clay-100 text-clay-600",
  exito: "border-risk-bajo bg-risk-bajo-bg text-risk-bajo",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notificar = useCallback<ToastContextValue["notificar"]>((tipo, mensaje, onReintentar) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tipo, mensaje, onReintentar }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
  }, []);

  const cerrar = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ notificar }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3, ease: easeOutExpo }}
              className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${ESTILO_POR_TIPO[t.tipo]}`}
            >
              <span className="flex-1">{t.mensaje}</span>
              {t.onReintentar && (
                <button
                  onClick={() => {
                    t.onReintentar?.();
                    cerrar(t.id);
                  }}
                  className="shrink-0 rounded-full border border-current px-2.5 py-1 text-xs font-medium"
                >
                  Reintentar
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast debe usarse dentro de ToastProvider");
  return context;
}
