"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Activo, CultivoImplantado, Lote } from "@/lib/types";

/**
 * El dato central de una DDJJ real de emergencia agropecuaria (Ley 26.509): el formulario oficial
 * de la Provincia de Buenos Aires pide, en cada línea de cultivo o de bien, un "% de afectación"
 * declarado por el productor. El sistema nunca tuvo dónde cargar ese número — solo calculaba la
 * propensión del lote a inundarse, que es otra cosa. Esta pantalla existe para completar eso.
 */
export function PanelDeclaracionDanos({ establecimientoId }: { establecimientoId: string }) {
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", establecimientoId],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${establecimientoId}/lotes`),
  });
  const { data: activos = [] } = useQuery({
    queryKey: ["activos", establecimientoId],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${establecimientoId}/activos`),
  });
  const { data: cultivos = [] } = useQuery({
    queryKey: ["cultivos", establecimientoId],
    queryFn: () => api.get<CultivoImplantado[]>(`/establecimientos/${establecimientoId}/cultivos`),
  });

  const nombreDeLote = (loteId: string | null) => lotes.find((l) => l.id === loteId)?.nombre ?? "sin lote";

  if (activos.length === 0 && cultivos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <p className="text-sm uppercase tracking-wide text-brand-600">Después de un evento</p>
      <h2 className="font-display text-lg font-medium text-ink-950">Declaración de daños</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">
        La Ley 26.509 define &quot;emergencia agropecuaria&quot; como un daño de al menos 50% sobre la producción, y
        &quot;desastre agropecuario&quot; desde el 80%. Ese porcentaje lo declarás vos por cada activo o cultivo afectado —
        el sistema no lo puede calcular, solo estimar exposición. Se usa en el informe y queda como respaldo de la
        DDJJ que se presenta ante la autoridad provincial.
      </p>

      {cultivos.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-600">Cultivos</p>
          <ul className="space-y-1.5">
            {cultivos.map((c) => (
              <FilaDanoCultivo key={c.id} cultivo={c} nombreLote={nombreDeLote(c.loteId)} establecimientoId={establecimientoId} />
            ))}
          </ul>
        </div>
      )}

      {activos.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-600">Activos</p>
          <ul className="space-y-1.5">
            {activos.map((a) => (
              <FilaDanoActivo key={a.id} activo={a} nombreLote={nombreDeLote(a.loteAsociadoId)} establecimientoId={establecimientoId} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilaDano({
  titulo,
  subtitulo,
  valorGuardado,
  fechaDeclarada,
  guardando,
  onGuardar,
}: {
  titulo: string;
  subtitulo: string;
  valorGuardado: number | null;
  fechaDeclarada: string | null;
  guardando: boolean;
  onGuardar: (porcentaje: number) => void;
}) {
  const [valor, setValor] = useState(valorGuardado != null ? String(valorGuardado) : "");
  const numero = Number(valor);
  const esValido = valor !== "" && !Number.isNaN(numero) && numero >= 0 && numero <= 100;
  const cambio = valor !== (valorGuardado != null ? String(valorGuardado) : "");

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper-300 bg-paper-100/60 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-ink-900">{titulo}</p>
        <p className="text-xs text-ink-600">
          {subtitulo}
          {fechaDeclarada && (
            <span> · declarado el {new Date(fechaDeclarada).toLocaleDateString("es-AR")}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="%"
          className="w-16 rounded-lg border border-paper-300 bg-paper-50 px-2 py-1 text-sm text-right outline-none focus:border-brand-500"
        />
        <span className="text-xs text-ink-600">%</span>
        <button
          onClick={() => onGuardar(numero)}
          disabled={!esValido || !cambio || guardando}
          className="rounded-full border border-brand-500 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </li>
  );
}

function FilaDanoCultivo({
  cultivo,
  nombreLote,
  establecimientoId,
}: {
  cultivo: CultivoImplantado;
  nombreLote: string;
  establecimientoId: string;
}) {
  const { notificar } = useToast();
  const queryClient = useQueryClient();

  const guardar = useMutation({
    mutationFn: (porcentaje: number) =>
      api.put<CultivoImplantado>(`/cultivos/${cultivo.id}/dano-declarado`, { porcentajeDanoDeclarado: porcentaje }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivos", establecimientoId] });
      notificar("exito", "Daño declarado");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <FilaDano
      titulo={`${cultivo.tipoCultivo} — ${cultivo.estadoFenologico}`}
      subtitulo={`Lote ${nombreLote}`}
      valorGuardado={cultivo.porcentajeDanoDeclarado}
      fechaDeclarada={cultivo.danoDeclaradoEn}
      guardando={guardar.isPending}
      onGuardar={(p) => guardar.mutate(p)}
    />
  );
}

function FilaDanoActivo({
  activo,
  nombreLote,
  establecimientoId,
}: {
  activo: Activo;
  nombreLote: string;
  establecimientoId: string;
}) {
  const { notificar } = useToast();
  const queryClient = useQueryClient();

  const guardar = useMutation({
    mutationFn: (porcentaje: number) =>
      api.put<Activo>(`/activos/${activo.id}/dano-declarado`, { porcentajeDanoDeclarado: porcentaje }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activos", establecimientoId] });
      notificar("exito", "Daño declarado");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <FilaDano
      titulo={activo.nombre}
      subtitulo={`Lote ${nombreLote}`}
      valorGuardado={activo.porcentajeDanoDeclarado}
      fechaDeclarada={activo.danoDeclaradoEn}
      guardando={guardar.isPending}
      onGuardar={(p) => guardar.mutate(p)}
    />
  );
}
