"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Establecimiento } from "@/lib/types";

/**
 * CUIT y RENSPA del productor: sin esto el informe de emergencia agropecuaria (Ley 26.509) sale
 * sin identificar al productor ni al predio, y no sirve como evidencia ante ningún trámite.
 */
export function PanelDatosFiscales({ establecimientoId }: { establecimientoId: string }) {
  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", establecimientoId],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${establecimientoId}`),
  });

  if (!establecimiento) return null;

  // key=id: si cambia el establecimiento (o llega un dato mas reciente por otra via), el estado
  // local se reinicializa desde los props en vez de sincronizarse con un efecto.
  return <FormularioDatosFiscales key={establecimiento.id} establecimientoId={establecimientoId} establecimiento={establecimiento} />;
}

function FormularioDatosFiscales({
  establecimientoId,
  establecimiento,
}: {
  establecimientoId: string;
  establecimiento: Establecimiento;
}) {
  const { notificar } = useToast();
  const queryClient = useQueryClient();

  const [cuit, setCuit] = useState(establecimiento.cuit ?? "");
  const [renspa, setRenspa] = useState(establecimiento.renspa ?? "");

  const guardar = useMutation({
    mutationFn: () =>
      api.put<Establecimiento>(`/establecimientos/${establecimientoId}/datos-fiscales`, {
        cuit: cuit || null,
        renspa: renspa || null,
      }),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(["establecimiento", establecimientoId], actualizado);
      notificar("exito", "Datos fiscales guardados");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const faltanDatos = !establecimiento.cuit || !establecimiento.renspa;
  const cambiaron = cuit !== (establecimiento.cuit ?? "") || renspa !== (establecimiento.renspa ?? "");

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <p className="text-sm uppercase tracking-wide text-brand-600">Identificación del productor</p>
      <h2 className="font-display text-lg font-medium text-ink-950">CUIT y RENSPA</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">
        Van en el encabezado del informe de emergencia agropecuaria: sin esto, la denuncia ante Ley 26.509 no
        identifica al productor ni al predio.
      </p>
      {faltanDatos && (
        <p className="mt-2 rounded-lg bg-risk-alto-bg px-3 py-1.5 text-xs text-risk-alto">
          Falta cargar {!establecimiento.cuit && !establecimiento.renspa ? "el CUIT y el RENSPA" : !establecimiento.cuit ? "el CUIT" : "el RENSPA"}.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink-700">CUIT del productor</label>
          <input
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="20-12345678-9"
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-700">RENSPA</label>
          <input
            value={renspa}
            onChange={(e) => setRenspa(e.target.value)}
            placeholder="20.123.4.56789/A0"
            className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <button
        onClick={() => guardar.mutate()}
        disabled={guardar.isPending || !cambiaron}
        className="mt-3 rounded-full bg-brand-700 px-4 py-1.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
      >
        {guardar.isPending ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}
