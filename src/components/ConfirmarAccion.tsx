"use client";

import { Modal } from "@/components/Modal";

/** Confirmacion de una accion que cambia quien ve el campo (revocar, terminar una cesion). Se puede revertir invitando de nuevo. */
export function ConfirmarAccion({
  abierto,
  titulo,
  detalle,
  textoConfirmar,
  enCurso,
  onConfirmar,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  detalle: string;
  textoConfirmar: string;
  enCurso: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <div className="space-y-3">
        <p className="text-sm text-ink-700">{detalle}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCerrar} className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={enCurso}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 disabled:opacity-40"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
}
