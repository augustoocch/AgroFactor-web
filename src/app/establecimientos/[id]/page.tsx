"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { EncabezadoPantalla, TituloSeccion } from "@/components/EncabezadoPantalla";
import { Icono } from "@/components/Icono";
import { InfoAside } from "@/components/InfoAside";
import { RiesgoChip } from "@/components/RiesgoChip";
import { api, clasificarError } from "@/lib/api";
import { boton, enlace, tarjeta } from "@/lib/estilos";
import { useScoresRiesgo } from "@/lib/hooks";
import { revealVariants } from "@/lib/motion";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type {
  Activo,
  Alerta,
  CultivoImplantado,
  DuracionAnegamiento,
  Establecimiento,
  EvaluacionRiesgo,
  Lote,
  NivelAlerta,
  PlanAccion,
} from "@/lib/types";

const MapaEstablecimiento = dynamic(
  () => import("@/components/MapaEstablecimiento").then((m) => m.MapaEstablecimiento),
  { ssr: false, loading: () => <div className="h-[44vh] w-full animate-pulse rounded-xl bg-paper-200" /> },
);

const PESO_NIVEL: Record<NivelAlerta, number> = { CRITICA: 3, ATENCION: 2, INFORMATIVA: 1 };

const ESTILO_NIVEL: Record<NivelAlerta, { etiqueta: string; texto: string; punto: string }> = {
  CRITICA: { etiqueta: "Crítica", texto: "text-risk-alto-ink", punto: "bg-risk-alto" },
  ATENCION: { etiqueta: "Atención", texto: "text-risk-medio-ink", punto: "bg-risk-medio" },
  INFORMATIVA: { etiqueta: "Informativa", texto: "text-ink-600", punto: "bg-ink-400" },
};

/**
 * Panorama: la primera pantalla de un establecimiento responde, en este orden, las tres preguntas
 * del productor durante un evento (Persona 1 del research): ¿viene agua?, ¿dónde?, ¿qué hago
 * primero? Cada bloque resume y enlaza a la pantalla que tiene el detalle; ninguno repite la
 * pantalla completa.
 *
 * Antes esta ruta se llamaba "Resumen" y era un mapa para dibujar lotes con un boton de borrar el
 * establecimiento abajo: no resumia nada, y dibujar lotes era la unica forma de llegar a esa
 * funcion. Dibujar vive ahora en Lotes; borrar, en Datos y acceso.
 */
export default function PanoramaPage({ params }: PageProps<"/establecimientos/[id]">) {
  const { id } = use(params);

  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });
  const { data: lotes = [], isPending: cargandoLotes } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });
  const { data: activos = [] } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });
  const { data: cultivos = [] } = useQuery({
    queryKey: ["cultivos", id],
    queryFn: () => api.get<CultivoImplantado[]>(`/establecimientos/${id}/cultivos`),
  });
  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas", id],
    queryFn: () => api.get<Alerta[]>(`/establecimientos/${id}/alertas`),
  });
  const { data: plan } = useQuery({
    queryKey: ["plan-accion", id],
    queryFn: () => api.get<PlanAccion>(`/establecimientos/${id}/planes-accion/ultimo`),
    retry: false,
  });
  const { data: duracion } = useQuery({
    queryKey: ["duracion-anegamiento", id],
    // Sin anegamiento estimable la API responde 204 (cuerpo vacio): react-query no acepta undefined.
    queryFn: async () =>
      (await api.get<DuracionAnegamiento | undefined>(`/establecimientos/${id}/anegamiento/duracion`)) ?? null,
    retry: false,
  });

  const scorePorLote = useScoresRiesgo(lotes);

  if (!establecimiento || cargandoLotes) return <PanoramaCargando />;

  const alertasOrdenadas = [...alertas].sort((a, b) => PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel]);
  const hayEvento = !!duracion?.hayAnegamiento;
  const configurado = lotes.length > 0 && activos.length > 0;

  const titular =
    lotes.length === 0
      ? "Empecemos por dibujar el campo"
      : alertas.length > 0
        ? `${alertas.length === 1 ? "Un lote" : `${alertas.length} lotes`} con agua prevista en las próximas 48 horas`
        : "Sin agua prevista para las próximas 48 horas";

  const bajada =
    lotes.length === 0
      ? "Con los lotes dibujados y lo que hay en cada uno, el sistema puede estimar qué se anega, cuánto dinero está en juego y qué conviene proteger primero."
      : alertas.length > 0
        ? "El pronóstico real se simula todas las madrugadas sobre cada lote. Abajo, dónde se juntaría el agua y qué conviene atender primero."
        : "La revisión automática corre todas las madrugadas sobre el pronóstico real. Mientras tanto, así está el riesgo de cada lote.";

  return (
    <div>
      <EncabezadoPantalla
        antetitulo={`Panorama · ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
        titulo={titular}
        descripcion={bajada}
      />

      {!configurado && (
        <PrimerosPasos
          establecimientoId={id}
          hayLotes={lotes.length > 0}
          hayActivos={activos.length > 0}
          hayCultivos={cultivos.length > 0}
          hayFiscales={!!establecimiento.cuit && !!establecimiento.renspa}
        />
      )}

      {(alertas.length > 0 || hayEvento) && (
        <motion.section
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className={`mb-10 grid gap-4 ${alertas.length > 0 && hayEvento ? "lg:grid-cols-12" : ""}`}
        >
          {alertas.length > 0 && (
            <div className={`${tarjeta} overflow-hidden ${hayEvento ? "lg:col-span-7" : ""}`}>
              <ul className="divide-y divide-paper-200">
                {alertasOrdenadas.slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`${rutaDe(id, "lotes")}/${a.loteId}`}
                      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper-100"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO_NIVEL[a.nivel].punto}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink-950">{a.loteNombre}</p>
                        <p className="text-sm text-ink-600">
                          Hasta {(a.laminaMaximaEsperadaMm / 10).toFixed(0)} cm de agua sobre el{" "}
                          {a.superficieAnegadaPct.toFixed(0)}% del lote, en {a.horasHastaPico} horas
                        </p>
                      </div>
                      <span className={`text-xs font-medium uppercase tracking-wide ${ESTILO_NIVEL[a.nivel].texto}`}>
                        {ESTILO_NIVEL[a.nivel].etiqueta}
                      </span>
                      <Icono nombre="derecha" className="h-4 w-4 text-ink-400 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-paper-200 bg-paper-100/60 px-5 py-2.5 text-sm">
                <Link href={rutaDe(id, "alertas")} className={enlace}>
                  {alertas.length > 4 ? `Ver las ${alertas.length} alertas` : "Ir a alertas"}
                </Link>
              </div>
            </div>
          )}

          {hayEvento && duracion && <DuracionResumida duracion={duracion} ancho={alertas.length > 0 ? "lg:col-span-5" : ""} />}
        </motion.section>
      )}

      {lotes.length > 0 && (
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
          <motion.section initial="hidden" animate="visible" custom={1} variants={revealVariants} className="lg:col-span-7">
            <TituloSeccion
              titulo="Riesgo de cada lote"
              descripcion="Qué tan propenso es cada lote a juntar agua, comparado con el resto del campo."
            />
            <MapaEstablecimiento
              establecimientoId={id}
              lotes={lotes}
              activos={activos}
              scorePorLote={scorePorLote}
              onLoteDibujado={() => {}}
              soloLectura
              alto="h-[44vh]"
            />
            <LotesPorRiesgo establecimientoId={id} lotes={lotes} scorePorLote={scorePorLote} />
          </motion.section>

          <motion.section initial="hidden" animate="visible" custom={2} variants={revealVariants} className="lg:col-span-5">
            <QueAtenderPrimero establecimientoId={id} plan={plan} hayActivos={activos.length > 0} />
          </motion.section>
        </div>
      )}
    </div>
  );
}

function PanoramaCargando() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-paper-300 pb-6">
        <div className="h-3 w-48 animate-pulse rounded bg-paper-200" />
        <div className="h-7 w-2/3 animate-pulse rounded bg-paper-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-paper-200" />
      </div>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="h-[44vh] animate-pulse rounded-xl bg-paper-200 lg:col-span-7" />
        <div className="h-64 animate-pulse rounded-xl bg-paper-200 lg:col-span-5" />
      </div>
    </div>
  );
}

/**
 * Lo que falta cargar para que el sistema pueda estimar, en el orden del user flow 1. Aparece
 * mientras falten lotes o activos, que son lo minimo para tener riesgo y plan; desaparece solo.
 */
function PrimerosPasos({
  establecimientoId,
  hayLotes,
  hayActivos,
  hayCultivos,
  hayFiscales,
}: {
  establecimientoId: string;
  hayLotes: boolean;
  hayActivos: boolean;
  hayCultivos: boolean;
  hayFiscales: boolean;
}) {
  const pasos = [
    {
      hecho: hayLotes,
      titulo: "Dibujar los lotes",
      detalle: "Sobre el mapa, con el contorno de cada lote. Es lo que permite estimar lote por lote y no por partido.",
      href: rutaDe(establecimientoId, "lotes"),
      accion: "Ir a lotes",
    },
    {
      hecho: hayActivos,
      titulo: "Ubicar los activos",
      detalle: "Hacienda, maquinaria, instalaciones y reservas, cada uno en su lugar dentro del lote.",
      href: rutaDe(establecimientoId, "lotes"),
      accion: "Elegir un lote",
    },
    {
      hecho: hayCultivos,
      titulo: "Cargar lo sembrado",
      detalle: "Cultivo y estado de cada zona sembrada. Sin esto, la pérdida de producción no se puede estimar.",
      href: rutaDe(establecimientoId, "lotes"),
      accion: "Elegir un lote",
    },
    {
      hecho: hayFiscales,
      titulo: "Completar CUIT y RENSPA",
      detalle: "Solo hacen falta para emitir el informe de emergencia agropecuaria. Se puede dejar para después.",
      href: rutaDe(establecimientoId, "ajustes"),
      accion: "Completar",
    },
  ];
  const siguiente = pasos.findIndex((p) => !p.hecho);

  return (
    <section className="mb-10">
      <TituloSeccion titulo="Para que el sistema pueda estimar" />
      <ol className={`${tarjeta} divide-y divide-paper-200`}>
        {pasos.map((paso, i) => {
          const esSiguiente = i === siguiente;
          return (
            <li key={paso.titulo} className={`flex items-start gap-4 px-5 py-4 ${esSiguiente ? "bg-clay-100/50" : ""}`}>
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                  paso.hecho
                    ? "bg-risk-bajo-bg text-risk-bajo-ink"
                    : esSiguiente
                      ? "bg-clay-500 text-paper-50"
                      : "border border-paper-300 text-ink-600"
                }`}
              >
                {paso.hecho ? <Icono nombre="check" className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${paso.hecho ? "text-ink-600" : "text-ink-950"}`}>{paso.titulo}</p>
                {!paso.hecho && <p className="mt-0.5 text-sm text-ink-600">{paso.detalle}</p>}
              </div>
              {!paso.hecho && (
                <Link href={paso.href} className={esSiguiente ? boton.primario : boton.sutil}>
                  {paso.accion}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const ETIQUETA_REGIMEN: Record<string, string> = {
  LOCAL: "Evento de este campo",
  TRANSICION: "La región ya está cargada",
  FREATICO_REGIONAL: "Anegamiento regional",
  SIN_DRENAJE: "El campo no está drenando",
  SIN_ANEGAMIENTO: "Sin anegamiento",
};

/**
 * Cuanto va a durar el agua. Vivia al pie de "Reportes", entre la declaracion de daños y el
 * informe economico, aunque es una informacion de DURANTE el evento: decide si la hacienda se
 * mueve de potrero o se saca del campo. Aca se ve la franja; las señales, en el panel lateral.
 */
function DuracionResumida({ duracion, ancho }: { duracion: DuracionAnegamiento; ancho: string }) {
  const [titular, ...resto] = duracion.resumen.split(".");
  return (
    <div className={`${tarjeta} flex flex-col p-5 ${ancho}`}>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-brand-600">Cuánto va a durar el agua</p>
      <p className="mt-2 font-display text-2xl font-medium leading-tight text-ink-950">{titular}</p>
      <p className="mt-1 text-sm text-ink-600">{ETIQUETA_REGIMEN[duracion.regimen]}</p>
      {resto.join(".").trim() && <p className="mt-3 text-sm leading-relaxed text-ink-700">{resto.join(".").trim()}</p>}
      <div className="mt-auto pt-4">
        <InfoAside titulo="Cómo se estima la duración" etiqueta="Cómo se estimó">
          <p>
            Se combinan dos señales. La primera es cuánto tarda en bajar el agua del lote: lo que infiltra y lo que se
            evapora, menos lo que sigue lloviendo. La segunda es el estado de la Cuenca del Salado: con mucha lluvia
            acumulada en la región, la napa está alta y el agua del campo no tiene a dónde ir.
          </p>
          <p>
            La señal regional actúa como piso, no como promedio: un lote que drena bien no compensa que la cuenca entera
            esté bajo agua. Por eso la respuesta es una franja y no un número único.
          </p>
          <ul className="space-y-3 border-t border-paper-200 pt-3">
            {duracion.senales.map((s) => (
              <li key={s.nombre}>
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-950">{s.nombre}</span>
                  <span className="font-mono text-xs text-ink-600">
                    {s.aporteDias != null ? `${Math.round(s.aporteDias)} días` : "no concluyente"}
                  </span>
                </p>
                <p className="text-ink-700">{s.detalle}</p>
                <p className="mt-0.5 text-xs text-ink-500">{s.fuente}</p>
              </li>
            ))}
          </ul>
        </InfoAside>
      </div>
    </div>
  );
}

function LotesPorRiesgo({
  establecimientoId,
  lotes,
  scorePorLote,
}: {
  establecimientoId: string;
  lotes: Lote[];
  scorePorLote: Record<string, number>;
}) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const sinEvaluar = lotes.filter((l) => scorePorLote[l.id] === undefined);
  const ordenados = [...lotes].sort((a, b) => (scorePorLote[b.id] ?? -1) - (scorePorLote[a.id] ?? -1));

  const evaluarPendientes = useMutation({
    mutationFn: () =>
      Promise.all(sinEvaluar.map((l) => api.post<EvaluacionRiesgo>(`/lotes/${l.id}/evaluaciones-riesgo`))),
    onSuccess: (evaluaciones) => {
      evaluaciones.forEach((e) => queryClient.setQueryData(["evaluacion-riesgo", e.loteId, "ultima"], e));
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <div className="mt-4">
      <ul className="divide-y divide-paper-200 border-y border-paper-200">
        {ordenados.map((lote) => (
          <li key={lote.id}>
            <Link
              href={`${rutaDe(establecimientoId, "lotes")}/${lote.id}`}
              className="group flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-brand-700"
            >
              <span className="truncate text-sm font-medium text-ink-900 group-hover:text-brand-700">{lote.nombre}</span>
              {scorePorLote[lote.id] !== undefined ? (
                <RiesgoChip score={scorePorLote[lote.id]} />
              ) : (
                <span className="text-xs text-ink-500">Sin evaluar</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {sinEvaluar.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-600">
          <span>
            {sinEvaluar.length === 1 ? "Un lote todavía no tiene" : `${sinEvaluar.length} lotes todavía no tienen`} su riesgo
            calculado.
          </span>
          <button onClick={() => evaluarPendientes.mutate()} disabled={evaluarPendientes.isPending} className={boton.sutil}>
            {evaluarPendientes.isPending ? "Calculando..." : "Calcular ahora"}
          </button>
        </div>
      )}
    </div>
  );
}

function QueAtenderPrimero({
  establecimientoId,
  plan,
  hayActivos,
}: {
  establecimientoId: string;
  plan: PlanAccion | undefined;
  hayActivos: boolean;
}) {
  const hrefPlan = rutaDe(establecimientoId, "plan-accion");

  if (!plan || plan.items.length === 0) {
    return (
      <>
        <TituloSeccion titulo="Qué atender primero" />
        <div className="rounded-xl border border-dashed border-paper-300 p-6">
          <p className="text-sm text-ink-700">
            {hayActivos
              ? "Todavía no se armó el orden de prioridad de tus activos."
              : "El orden de prioridad se arma con los activos cargados en cada lote."}
          </p>
          <Link href={hayActivos ? hrefPlan : rutaDe(establecimientoId, "lotes")} className={`${boton.secundario} mt-4`}>
            {hayActivos ? "Armar el plan de acción" : "Cargar activos"}
          </Link>
        </div>
      </>
    );
  }

  const total = plan.items.reduce((acc, i) => acc + (i.valorEnRiesgo ?? 0), 0);

  return (
    <>
      <TituloSeccion
        titulo="Qué atender primero"
        descripcion={`Según el plan del ${new Date(plan.fecha).toLocaleDateString("es-AR")}.`}
      />
      {total > 0 && (
        <div className="mb-4 border-l-2 border-clay-500 pl-4">
          <p className="font-display text-3xl font-medium tabular-nums text-ink-950">
            USD {Math.round(total).toLocaleString("es-AR")}
          </p>
          <p className="text-sm text-ink-600">en riesgo entre los {plan.items.length} activos del plan</p>
        </div>
      )}
      <ol className="space-y-2">
        {plan.items.slice(0, 3).map((item) => (
          <li key={item.activoId} className={`${tarjeta} flex gap-3.5 p-4`}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                item.orden === 1 ? "bg-clay-500 text-paper-50" : "bg-paper-200 text-ink-700"
              }`}
            >
              {item.orden}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-ink-950">{item.activoNombre}</p>
              <p className="mt-0.5 text-sm leading-snug text-ink-700">{item.recomendacion}</p>
              {item.valorEnRiesgo != null && (
                <p className="mt-1 font-mono text-xs text-ink-600">
                  USD {Math.round(item.valorEnRiesgo).toLocaleString("es-AR")} en riesgo
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Link href={hrefPlan} className={`${enlace} mt-4 inline-block text-sm`}>
        {plan.items.length > 3 ? `Ver el plan completo (${plan.items.length} activos)` : "Ver por qué este orden"}
      </Link>
    </>
  );
}
