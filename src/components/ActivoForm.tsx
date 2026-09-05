"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/Modal";
import type { Activo, Coordenada, Lote, Movilidad, TipoActivo } from "@/lib/types";

const MOVILIDAD_POR_DEFECTO: Record<TipoActivo, Movilidad> = {
  HACIENDA: "MOVIBLE",
  MAQUINARIA: "MOVIBLE",
  RESERVA_FORRAJERA: "MOVIBLE",
  INSTALACION: "FIJO",
  CAMINO_ACCESO: "FIJO",
};

interface Props {
  loteId: string;
  /** Lotes del establecimiento: solo se usan para mover un activo movible a otro lote. */
  lotes: Lote[];
  ubicacionNueva: Coordenada | null;
  activoAEditar: Activo | null;
  onCerrar: () => void;
}

/**
 * Alta y edicion de un activo. El alta siempre cuelga del lote en cuya pantalla estamos; la
 * edicion es el unico lugar donde el lote se elige, y solo para activos movibles (una instalacion
 * o un camino no se mudan de lote).
 */
export function ActivoForm({ loteId, lotes, ubicacionNueva, activoAEditar, onCerrar }: Props) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const esEdicion = activoAEditar !== null;

  const [campos, setCampos] = useState(() => ({
    nombre: activoAEditar?.nombre ?? "",
    tipo: activoAEditar?.tipo ?? ("HACIENDA" as TipoActivo),
    movilidad: activoAEditar?.movilidad ?? MOVILIDAD_POR_DEFECTO.HACIENDA,
    valorEstimado: activoAEditar ? String(activoAEditar.valorEstimado) : "",
    loteDestinoId: activoAEditar?.loteAsociadoId ?? loteId,
  }));

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        nombre: campos.nombre,
        tipo: campos.tipo,
        movilidad: campos.movilidad,
        valorEstimado: Number(campos.valorEstimado),
        ubicacion: esEdicion ? activoAEditar!.ubicacion : ubicacionNueva,
      };
      return esEdicion
        ? api.put<Activo>(`/activos/${activoAEditar!.id}`, { ...datos, loteId: campos.loteDestinoId })
        : api.post<Activo>(`/lotes/${loteId}/activos`, datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activos"] });
      notificar("exito", esEdicion ? "Activo actualizado" : "Activo agregado al lote");
      onCerrar();
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => guardar.mutate() : undefined);
    },
  });

  const puedeMoverse = campos.movilidad === "MOVIBLE";

  return (
    <Modal
      abierto={ubicacionNueva !== null || esEdicion}
      onCerrar={onCerrar}
      titulo={esEdicion ? "Editar activo" : "Nuevo activo en el lote"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-medium text-ink-700">Nombre del activo</label>
          <input
            value={campos.nombre}
            onChange={(e) => setCampos((c) => ({ ...c, nombre: e.target.value }))}
            placeholder="Ej. Rodeo potrero norte"
            required
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-700">Tipo</label>
            <select
              value={campos.tipo}
              onChange={(e) => {
                const tipo = e.target.value as TipoActivo;
                setCampos((c) => ({ ...c, tipo, movilidad: MOVILIDAD_POR_DEFECTO[tipo] }));
              }}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="HACIENDA">Hacienda</option>
              <option value="MAQUINARIA">Maquinaria</option>
              <option value="INSTALACION">Instalacion</option>
              <option value="RESERVA_FORRAJERA">Reserva forrajera</option>
              <option value="CAMINO_ACCESO">Camino / acceso</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700">Valor estimado (USD)</label>
            <input
              type="number"
              min={0}
              value={campos.valorEstimado}
              onChange={(e) => setCampos((c) => ({ ...c, valorEstimado: e.target.value }))}
              placeholder="0"
              required
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700">Movilidad</label>
          <select
            value={campos.movilidad}
            onChange={(e) => setCampos((c) => ({ ...c, movilidad: e.target.value as Movilidad }))}
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="MOVIBLE">Movible (se puede sacar del lote)</option>
            <option value="FIJO">Fijo (no se traslada)</option>
          </select>
        </div>

        {esEdicion && (
          <div>
            <label className="block text-xs font-medium text-ink-700">Lote</label>
            <select
              value={campos.loteDestinoId}
              onChange={(e) => setCampos((c) => ({ ...c, loteDestinoId: e.target.value }))}
              disabled={!puedeMoverse}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:opacity-50"
            >
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] leading-tight text-ink-600">
              {puedeMoverse
                ? "Un activo movible se puede pasar a otro lote."
                : "Un activo fijo no se mueve de lote. Marcalo como movible si en realidad se traslada."}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 disabled:opacity-50"
          >
            {esEdicion ? "Guardar cambios" : "Agregar activo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
