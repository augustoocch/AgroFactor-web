"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/Modal";
import type { Coordenada, CultivoCatalogo, CultivoImplantado } from "@/lib/types";

interface Props {
  loteId: string;
  /** Zona recien dibujada en el mapa (alta) o null si se esta editando una existente. */
  anilloNuevo: Coordenada[] | null;
  /** Zona existente a editar (los campos, no la geometria) o null si es alta. */
  cultivoAEditar: CultivoImplantado | null;
  onCerrar: () => void;
}

const OTRO = "OTRO";

const ETIQUETA_TOLERANCIA: Record<string, string> = {
  BAJA: "poco tolerante al agua",
  MEDIA: "tolerancia media al agua",
  ALTA: "tolerante al agua",
};

/**
 * Alta y edicion de una zona de cultivo. El cultivo y su estado salen del catalogo agronomico:
 * con eso el backend deriva solo el margen de accion, en vez de pedirselo al productor.
 */
export function CultivoForm({ loteId, anilloNuevo, cultivoAEditar, onCerrar }: Props) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const esEdicion = cultivoAEditar !== null;

  const { data: catalogo = [] } = useQuery({
    queryKey: ["catalogo-cultivos"],
    queryFn: () => api.get<CultivoCatalogo[]>("/catalogo/cultivos"),
    staleTime: Infinity,
  });

  const [campos, setCampos] = useState(() => ({
    cultivoCodigo: cultivoAEditar?.cultivoCodigo ?? "",
    estadoFenologicoCodigo: cultivoAEditar?.estadoFenologicoCodigo ?? "",
    tipoCultivoLibre: cultivoAEditar?.cultivoCodigo ? "" : (cultivoAEditar?.tipoCultivo ?? ""),
    estadoFenologicoLibre: cultivoAEditar?.cultivoCodigo ? "" : (cultivoAEditar?.estadoFenologico ?? ""),
    fechaSiembra: cultivoAEditar?.fechaSiembra ?? "",
  }));

  const esOtro = campos.cultivoCodigo === OTRO || campos.cultivoCodigo === "";
  const cultivoElegido = catalogo.find((c) => c.codigo === campos.cultivoCodigo);
  const estadoElegido = cultivoElegido?.estados.find((e) => e.codigo === campos.estadoFenologicoCodigo);

  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        anillo: esEdicion ? cultivoAEditar!.anillo : anilloNuevo!,
        cultivoCodigo: cultivoElegido ? cultivoElegido.codigo : null,
        estadoFenologicoCodigo: cultivoElegido ? campos.estadoFenologicoCodigo : null,
        tipoCultivo: cultivoElegido ? cultivoElegido.nombre : campos.tipoCultivoLibre,
        estadoFenologico: estadoElegido ? estadoElegido.nombre : campos.estadoFenologicoLibre,
        fechaSiembra: campos.fechaSiembra,
      };
      return esEdicion
        ? api.put<CultivoImplantado>(`/cultivos/${cultivoAEditar!.id}`, body)
        : api.post<CultivoImplantado>(`/lotes/${loteId}/cultivos`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivos", loteId] });
      notificar("exito", esEdicion ? "Zona de cultivo actualizada" : "Zona de cultivo guardada");
      onCerrar();
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => guardar.mutate() : undefined);
    },
  });

  return (
    <Modal
      abierto={anilloNuevo !== null || esEdicion}
      onCerrar={onCerrar}
      titulo={esEdicion ? "Editar zona de cultivo" : "Nueva zona de cultivo"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-medium text-ink-700">Cultivo</label>
          <select
            value={campos.cultivoCodigo}
            onChange={(e) =>
              setCampos((c) => ({ ...c, cultivoCodigo: e.target.value, estadoFenologicoCodigo: "" }))
            }
            required
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Elegi un cultivo...</option>
            {catalogo.map((cultivo) => (
              <option key={cultivo.codigo} value={cultivo.codigo}>
                {cultivo.nombre}
              </option>
            ))}
            <option value={OTRO}>Otro (no esta en la lista)</option>
          </select>
          {cultivoElegido && (
            <p className="mt-1 text-[11px] leading-tight text-ink-600">
              {ETIQUETA_TOLERANCIA[cultivoElegido.toleranciaAnegamiento]} · resiste unos{" "}
              {cultivoElegido.diasToleranciaAnegamiento} dias con agua encima.
            </p>
          )}
        </div>

        {campos.cultivoCodigo === OTRO && (
          <div className="space-y-3 rounded-xl border border-clay-500/40 bg-clay-100 p-3">
            <p className="text-[11px] leading-tight text-clay-600">
              Al estar fuera del catalogo no podemos calcular el margen de accion ni ajustar el consumo de agua del
              cultivo. Se guarda igual, pero sin ese analisis.
            </p>
            <input
              value={campos.tipoCultivoLibre}
              onChange={(e) => setCampos((c) => ({ ...c, tipoCultivoLibre: e.target.value }))}
              placeholder="Nombre del cultivo"
              required
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <input
              value={campos.estadoFenologicoLibre}
              onChange={(e) => setCampos((c) => ({ ...c, estadoFenologicoLibre: e.target.value }))}
              placeholder="Estado fenologico"
              required
              className="w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
        )}

        {cultivoElegido && (
          <div>
            <label className="block text-xs font-medium text-ink-700">Estado fenologico</label>
            <select
              value={campos.estadoFenologicoCodigo}
              onChange={(e) => setCampos((c) => ({ ...c, estadoFenologicoCodigo: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">En que estado esta...</option>
              {cultivoElegido.estados.map((estado) => (
                <option key={estado.codigo} value={estado.codigo}>
                  {estado.codigo} — {estado.nombre}
                </option>
              ))}
            </select>
            {estadoElegido?.criticoAnegamiento && (
              <p className="mt-1 text-[11px] font-medium leading-tight text-risk-alto">
                Estado critico: un anegamiento en este momento compromete el rendimiento.
              </p>
            )}
            {estadoElegido?.madurezFisiologica && (
              <p className="mt-1 text-[11px] leading-tight text-brand-700">
                El grano ya esta hecho: se puede adelantar la cosecha.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-ink-700">Fecha de siembra</label>
          <input
            type="date"
            value={campos.fechaSiembra}
            onChange={(e) => setCampos((c) => ({ ...c, fechaSiembra: e.target.value }))}
            required
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>

        <p className="text-[11px] leading-tight text-ink-600">
          El margen de accion (cosechar antes, resembrar, o ninguno) lo calcula el sistema a partir del cultivo, su
          estado y la fecha: no hay que elegirlo.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending || (!cultivoElegido && !esOtro)}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 disabled:opacity-50"
          >
            {esEdicion ? "Guardar cambios" : "Guardar zona"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
