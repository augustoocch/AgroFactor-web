"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { InfoAside } from "@/components/InfoAside";
import { api, clasificarError } from "@/lib/api";
import { boton, enlace } from "@/lib/estilos";
import { revealVariants } from "@/lib/motion";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type { Alerta, EstadoRevisionAlertas, NivelAlerta, RevisionAlertas } from "@/lib/types";

const ESTILO_NIVEL: Record<NivelAlerta, { borde: string; texto: string; etiqueta: string }> = {
  CRITICA: { borde: "border-l-risk-alto", texto: "text-risk-alto-ink", etiqueta: "Crítica" },
  ATENCION: { borde: "border-l-risk-medio", texto: "text-risk-medio-ink", etiqueta: "Atención" },
  INFORMATIVA: { borde: "border-l-paper-300", texto: "text-ink-600", etiqueta: "Informativa" },
};

const PESO_NIVEL: Record<NivelAlerta, number> = { CRITICA: 3, ATENCION: 2, INFORMATIVA: 1 };

/** Cada cuanto se pregunta por el avance mientras hay una revision corriendo. */
const SONDEO_MS = 3000;

/** Filas del historial antes de "ver todas". */
const HISTORIAL_INICIAL = 10;

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Bandeja de alertas (user flow 4). Se generan solas todas las madrugadas corriendo la simulacion
 * sobre el pronostico real; el boton solo adelanta esa corrida. Cada alerta lleva a los dos
 * lugares donde se sigue: el lote (donde se junta el agua) y el plan (que proteger primero).
 *
 * Arriba van solo las vigentes (las de la ultima revision terminada); lo anterior queda en el
 * historial. La revision manual corre en el servidor: se puede salir de la pantalla y, al volver,
 * el estado de la revision dice si sigue en curso y por que lote va.
 */
export default function AlertasPage({ params }: PageProps<"/establecimientos/[id]/alertas">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas", id],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${id}/alertas`),
  });

  const { data: historicas = [] } = useQuery({
    queryKey: ["alertas-historico", id],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${id}/alertas/historico`),
  });

  const { data: estado } = useQuery({
    queryKey: ["alertas-revision", id],
    queryFn: () => api.get<EstadoRevisionAlertas>(`/establecimientos/${id}/alertas/revision`),
    refetchInterval: (q) => (q.state.data?.enCurso ? SONDEO_MS : false),
  });
  const enCurso = estado?.enCurso ?? null;
  const ultima = estado?.ultima ?? null;

  // Cuando la revision que se estaba siguiendo termina, se recargan las bandejas y se avisa el
  // resultado. Si termino mientras el usuario estaba en otra pantalla, al volver ya llega cargado.
  const seguida = useRef<string | null>(null);
  useEffect(() => {
    if (enCurso) {
      seguida.current = enCurso.id;
      return;
    }
    if (seguida.current === null) return;
    const terminada = ultima?.id === seguida.current ? ultima : null;
    seguida.current = null;
    queryClient.invalidateQueries({ queryKey: ["alertas", id] });
    queryClient.invalidateQueries({ queryKey: ["alertas-historico", id] });
    if (terminada?.estado === "FALLIDA") {
      notificar("error-servicio", "La revisión no pudo completarse. Las alertas vigentes son las de la revisión anterior.");
    } else if (terminada) {
      notificar(
        "exito",
        terminada.alertasEmitidas > 0 ? `Revisión terminada: ${terminada.alertasEmitidas} alerta(s)` : "Revisión terminada: sin anegamiento previsto",
      );
    }
  }, [enCurso, ultima, id, queryClient, notificar]);

  const revisar = useMutation({
    mutationFn: () => api.post<RevisionAlertas>(`/establecimientos/${id}/alertas/revisar`),
    onSuccess: (revision) => {
      queryClient.setQueryData<EstadoRevisionAlertas>(["alertas-revision", id], (previo) => ({
        enCurso: revision,
        ultima: previo?.ultima ?? null,
      }));
      notificar("exito", "Revisión en marcha. Podés salir de esta pantalla: el resultado queda guardado acá.");
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
          <button onClick={() => revisar.mutate()} disabled={revisar.isPending || !!enCurso} className={boton.secundario}>
            {enCurso || revisar.isPending ? "Revisando..." : "Revisar ahora"}
          </button>
        }
      />

      {enCurso && <RevisionEnCurso revision={enCurso} />}
      {!enCurso && ultima && <UltimaRevision revision={ultima} />}

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
              <p className="mt-0.5 text-xs text-ink-600">Emitida el {fechaHora(alerta.generadaEn)}</p>

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

      <Historial alertas={historicas} />
    </div>
  );
}

/** Banner de la revision corriendo. Sale del servidor, asi que sobrevive a salir y volver. */
function RevisionEnCurso({ revision }: { revision: RevisionAlertas }) {
  const preparando = revision.lotesTotal === 0;
  const avance = preparando ? 0 : (100 * revision.lotesHechos) / revision.lotesTotal;
  return (
    <div role="status" className="mb-6 rounded-xl border border-brand-600/30 bg-brand-100 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium text-ink-950">
          Revisión {revision.origen === "AUTOMATICA" ? "automática" : "manual"} en curso
        </p>
        <p className="font-mono text-sm tabular-nums text-ink-700">
          {preparando ? "preparando..." : `${revision.lotesHechos} de ${revision.lotesTotal} lotes`}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-200">
        <div className="h-full bg-brand-600 transition-[width] duration-500" style={{ width: `${avance}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink-700">
        Empezó el {fechaHora(revision.iniciadaEn)}. Se simula cada lote sobre el pronóstico, así que tarda: podés salir de
        esta pantalla y volver, el cálculo sigue en el servidor.
      </p>
    </div>
  );
}

/** De que revision salen las alertas que se ven, y si hubo algo que no se pudo revisar. */
function UltimaRevision({ revision }: { revision: RevisionAlertas }) {
  const cuando = fechaHora(revision.terminadaEn ?? revision.iniciadaEn);
  if (revision.estado === "FALLIDA") {
    return (
      <p className="mb-6 rounded-lg border border-risk-alto/40 px-4 py-3 text-sm text-risk-alto-ink">
        La última revisión ({cuando}) no pudo completarse{revision.error ? `: ${revision.error}` : "."} Las alertas vigentes
        son las de la revisión completa anterior.
      </p>
    );
  }
  return (
    <p className="mb-6 text-sm text-ink-600">
      Última revisión: {cuando} · {revision.origen === "AUTOMATICA" ? "automática" : "manual"} · {revision.lotesHechos}{" "}
      {revision.lotesHechos === 1 ? "lote revisado" : "lotes revisados"}
      {revision.lotesConError > 0 && (
        <span className="text-risk-medio-ink">
          {" "}
          · {revision.lotesConError} no se {revision.lotesConError === 1 ? "pudo" : "pudieron"} simular: su alerta anterior
          quedó en el historial
        </span>
      )}
    </p>
  );
}

/** Alertas que ya no son vigentes: una revision posterior no las volvio a emitir. */
function Historial({ alertas }: { alertas: Alerta[] }) {
  const [todas, setTodas] = useState(false);
  if (alertas.length === 0) return null;
  const visibles = todas ? alertas : alertas.slice(0, HISTORIAL_INICIAL);
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-medium text-ink-950">Historial</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">
        Alertas que ya no están vigentes: una revisión posterior no las volvió a emitir. Quedan como registro de lo que se
        anunció y cuándo.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-paper-300">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-paper-100 text-left text-xs text-ink-600">
            <tr>
              <th className="px-3 py-2 font-medium">Emitida</th>
              <th className="px-3 py-2 font-medium">Lote</th>
              <th className="px-3 py-2 font-medium">Nivel</th>
              <th className="px-3 py-2 font-medium">Parte del lote</th>
              <th className="px-3 py-2 font-medium">Agua</th>
              <th className="px-3 py-2 font-medium">Lluvia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-200">
            {visibles.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">{fechaHora(a.generadaEn)}</td>
                <td className="px-3 py-2">{a.loteNombre}</td>
                <td className={`px-3 py-2 ${ESTILO_NIVEL[a.nivel].texto}`}>{ESTILO_NIVEL[a.nivel].etiqueta}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{a.superficieAnegadaPct.toFixed(0)}%</td>
                <td className="px-3 py-2 font-mono tabular-nums">{(a.laminaMaximaEsperadaMm / 10).toFixed(1)} cm</td>
                <td className="px-3 py-2 font-mono tabular-nums">{a.lluviaPronosticadaMm.toFixed(0)} mm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {alertas.length > HISTORIAL_INICIAL && (
        <button onClick={() => setTodas(!todas)} className={`mt-3 text-sm ${enlace}`}>
          {todas ? "Ver menos" : `Ver las ${alertas.length}`}
        </button>
      )}
    </section>
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
