"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

interface Props {
  abierto: boolean;
  titulo: string;
  /** Qué se lleva puesto el borrado, en palabras del usuario (ej. "3 zonas de cultivo y 2 activos"). */
  queSeBorra: string;
  /** Si viene, hay que escribirlo exacto para habilitar el borrado (para lo irreversible y grande). */
  confirmacionEscrita?: string;
  borrando: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}

/** Confirmacion de borrado definitivo: dice que se pierde antes de perderlo. */
export function ConfirmarBorrado({
  abierto,
  titulo,
  queSeBorra,
  confirmacionEscrita,
  borrando,
  onConfirmar,
  onCerrar,
}: Props) {
  const [texto, setTexto] = useState("");
  const habilitado = !confirmacionEscrita || texto.trim() === confirmacionEscrita.trim();

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <div className="space-y-3">
        <p className="text-sm text-ink-700">{queSeBorra}</p>
        <p className="text-sm font-medium text-risk-alto">Esto no se puede deshacer.</p>

        {confirmacionEscrita && (
          <div>
            <label className="block text-xs font-medium text-ink-700">
              Escribi <span className="font-mono text-ink-950">{confirmacionEscrita}</span> para confirmar
            </label>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-risk-alto"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCerrar} className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={!habilitado || borrando}
            className="rounded-full bg-risk-alto px-4 py-2 text-sm font-medium text-paper-50 disabled:opacity-40"
          >
            {borrando ? "Borrando..." : "Borrar definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
