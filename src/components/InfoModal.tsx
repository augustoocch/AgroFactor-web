"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

/** Boton de info + modal con contenido especifico (no generico) para explicar un numero o una decision de diseno al usuario final. */
export function InfoModal({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        aria-label={`Que significa: ${titulo}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink-400 text-[10px] leading-none text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"
      >
        i
      </button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={titulo}>
        <div className="space-y-3 text-sm text-ink-800">{children}</div>
      </Modal>
    </>
  );
}
