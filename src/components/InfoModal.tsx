"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

/**
 * Boton de info + modal con contenido especifico (no generico) para explicar un numero o una
 * decision de diseno al usuario final.
 *
 * `etiqueta` es opcional: sin ella, el trigger es el circulo "i" de siempre (compacto, para
 * cuando ya hay texto alrededor que da contexto). Con ella, se ve un texto corto ademas del
 * icono -usar cuando el boton es la UNICA pista de que hay mas informacion disponible y un
 * circulo de 16px sin texto no alcanza para que alguien lo note (ver feedback de usuario: un
 * icono "i" solo, sin texto, es invisible para quien no sabe de antemano que esta ahi).
 */
export function InfoModal({
  titulo,
  etiqueta,
  children,
}: {
  titulo: string;
  etiqueta?: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  if (etiqueta) {
    return (
      <>
        <button
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 px-2.5 py-0.5 text-xs font-medium text-ink-700 transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none">
            i
          </span>
          {etiqueta}
        </button>
        <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={titulo}>
          <div className="space-y-3 text-sm text-ink-800">{children}</div>
        </Modal>
      </>
    );
  }

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
