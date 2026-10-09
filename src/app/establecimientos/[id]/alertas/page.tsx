"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { use } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { InfoAside } from "@/components/InfoAside";
import { api, clasificarError } from "@/lib/api";
import { boton, enlace } from "@/lib/estilos";
import { revealVariants } from "@/lib/motion";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type { Alerta, NivelAlerta } from "@/lib/types";

const ESTILO_NIVEL: Record<NivelAlerta, { borde: string; texto: string; etiqueta: string }> = {
  CRITICA: { borde: "border-l-risk-alto", texto: "text-risk-alto-ink", etiqueta: "Crítica" },
  ATENCION: { borde: "border-l-risk-medio", texto: "text-risk-medio-ink", etiqueta: "Atención" },
  INFORMATIVA: { borde: "border-l-paper-300", texto: "text-ink-600", etiqueta: "Informativa" },
};

const PESO_NIVEL: Record<NivelAlerta, number> = { CRITICA: 3, ATENCION: 2, INFORMATIVA: 1 };

/**
 * Bandeja de alertas (user flow 4). Se generan solas todas las madrugadas corriendo la simulacion
 * sobre el pronostico real; el boton solo adelanta esa corrida. Cada alerta lleva a los dos
 * lugares donde se sigue: el lote (donde se junta el agua) y el plan (que proteger primero).
 */
export default function AlertasPage({ params }: PageProps<"/establecimientos/[id]/alertas">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas", id],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${id}/alertas`),
  });

  const revisar = useMutation({
    mutationFn: () => api.post<Alerta[]>(`/establecimientos/${id}/alertas/revisar`),
    onSuccess: (nuevas) => {
      queryClient.setQueryData(["alertas", id], nuevas);
      notificar("exito", nuevas.length > 0 ? `${nuevas.length} alerta(s) al día` : "Sin anegamiento previsto");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const ordenadas = [...alertas].sort((a, b) => PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel]);

  return (
    <div>
      <EncabezadoPantalla
        segmento="alertas"
        titulo="Alertas de anegamiento"
        descripcion="Lotes donde el pronóstico de las próximas 48 horas deja agua en superficie: cuánta, sobre qué parte del lote y en cuántas horas."
        ayuda={
          <InfoAside titulo="De dónde salen las alertas" etiqueta="Cuándo se emite una alerta">
            <p>
              Todas las madrugadas se simula cada lote sobre el pronóstico real de las próximas 48 horas. Si el
              resultado cruza alguno de estos umbrales, se emite una alerta:
            </p>
            <dl className="space-y-2">
              <div>
                <dt className="font-medium text-risk-alto-ink">Crítica</dt>
                <dd>Más del 40% del lote con agua, o más de 20 cm de lámina.</dd>
              </div>
              <div>
                <dt className="font-medium text-risk-medio-ink">Atención</dt>
                <dd>Más del 15% del lote con agua.</dd>
              </div>
              <div>
                <dt className="font-medium text-ink-700">Informativa</dt>
                <dd>Se prevé agua, por debajo de esos valores.</dd>
              </div>
            </dl>
            <p className="text-ink-600">
              El horizonte es corto a propósito: más allá de dos días el pronóstico deja de ser confiable, y una alerta
              sobre un dato flojo enseña a ignorar las alertas.
            </p>
          </InfoAside>
        }
        acciones={
          <button onClick={() => revisar.mutate()} disabled={revisar.isPending} className={boton.secundario}>
            {revisar.isPending ? "Revisando..." : "Revisar ahora"}
          </button>
        }
      />

      {isLoading && <p className="text-sm text-ink-600">Cargando alertas...</p>}

      {!isLoading && alertas.length === 0 && (
        <div className="rounded-xl border border-dashed border-paper-300 px-6 py-10 text-center">
          <p className="font-display text-lg text-ink-950">Sin alertas</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            No se prevé agua en superficie en ningún lote durante las próximas 48 horas. La próxima revisión automática
            es esta madrugada.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {ordenadas.map((alerta, i) => {
          const estilo = ESTILO_NIVEL[alerta.nivel];
          return (
            <motion.li
              key={alerta.id}
              initial="hidden"
              animate="visible"
              custom={i}
              variants={revealVariants}
              className={`rounded-xl border border-l-4 border-paper-300 ${estilo.borde} bg-paper-50 p-5`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg font-medium text-ink-950">{alerta.loteNombre}</p>
                <span className={`text-xs font-medium uppercase tracking-wide ${estilo.texto}`}>{estilo.etiqueta}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Dato etiqueta="Agua en superficie" valor={`${(alerta.laminaMaximaEsperadaMm / 10).toFixed(1)} cm`} />
                <Dato etiqueta="Parte del lote" valor={`${alerta.superficieAnegadaPct.toFixed(0)}%`} />
                <Dato etiqueta="Momento más alto" valor={`en ${alerta.horasHastaPico} h`} />
                <Dato etiqueta="Lluvia prevista" valor={`${alerta.lluviaPronosticadaMm.toFixed(0)} mm`} />
              </dl>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-700">{alerta.mensaje}</p>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link href={`${rutaDe(id, "lotes")}/${alerta.loteId}`} className={enlace}>
                  Ver dónde se junta el agua
                </Link>
                <Link href={rutaDe(id, "plan-accion")} className={enlace}>
                  Qué proteger primero
                </Link>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-600">{etiqueta}</dt>
      <dd className="font-mono text-sm font-medium tabular-nums text-ink-950">{valor}</dd>
    </div>
  );
}
