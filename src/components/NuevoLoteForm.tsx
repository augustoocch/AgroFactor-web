"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/Modal";
import type { Coordenada, Lote, TipoUso } from "@/lib/types";

interface Props {
  establecimientoId: string;
  anillo: Coordenada[] | null;
  onCerrar: () => void;
  /** Despues de guardar (ademas de cerrar). Cancelar no lo dispara: vuelve a donde estaba. */
  onGuardado?: () => void;
}

/**
 * Se abre cuando EditorDibujo termina un poligono en el mapa (ver MapaEstablecimiento) o cuando se
 * confirman los vertices de CargaPorCoordenadas.
 */
export function NuevoLoteForm({ establecimientoId, anillo, onCerrar, onGuardado }: Props) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [nombre, setNombre] = useState("");
  const [tipoUso, setTipoUso] = useState<TipoUso>("PASTURA");
  const [antecedentes, setAntecedentes] = useState<number>(0);

  const crearLote = useMutation({
    mutationFn: () =>
      api.post<Lote>(`/establecimientos/${establecimientoId}/lotes`, {
        nombre,
        tipoUso,
        anillo,
        antecedentesAnegamientoUltimos10Anios: antecedentes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes", establecimientoId] });
      setNombre("");
      setTipoUso("PASTURA");
      setAntecedentes(0);
      notificar("exito", "Lote guardado");
      onGuardado?.();
      onCerrar();
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => crearLote.mutate() : undefined);
    },
  });

  return (
    <Modal abierto={anillo !== null} onCerrar={onCerrar} titulo={`Nuevo lote · ${anillo?.length ?? 0} vertices`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          crearLote.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-medium text-ink-700">Nombre del lote</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Potrero norte"
            required
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700">Tipo de uso</label>
            <select
              value={tipoUso}
              onChange={(e) => setTipoUso(e.target.value as TipoUso)}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="AGRICULTURA">Agricultura</option>
              <option value="PASTURA">Pastura</option>
              <option value="POTRERO">Potrero</option>
              <option value="MONTE">Monte</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700">Veces anegado (10 anios)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={antecedentes}
              onChange={(e) => setAntecedentes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <p className="mt-1 text-[11px] leading-tight text-ink-600">
              En cuantos de los ultimos 10 anios se anego. Un lote con historia de agua se evalua como mas expuesto.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={crearLote.isPending}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 disabled:opacity-50"
          >
            Guardar lote
          </button>
        </div>
      </form>
    </Modal>
  );
}
