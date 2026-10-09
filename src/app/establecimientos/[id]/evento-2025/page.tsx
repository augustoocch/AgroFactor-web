"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { use, useState } from "react";
import { EncabezadoPantalla, TituloSeccion } from "@/components/EncabezadoPantalla";
import { Icono } from "@/components/Icono";
import { InfoAside } from "@/components/InfoAside";
import { COLOR_AGUA, COLOR_AGUA_PREVIA, COLOR_AGUA_SIMULADA, colorBandaSimulada } from "@/components/MapaReproduccion";
import { SerieAnegamiento2025, fechaCorta } from "@/components/SerieAnegamiento2025";
import { api, clasificarError } from "@/lib/api";
import { boton, tarjeta } from "@/lib/estilos";
import { revealVariants } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import type {
  Establecimiento,
  ImagenReproduccion,
  Lote,
  LoteReproduccion,
  Reproduccion2025,
  SimulacionReproduccion,
} from "@/lib/types";

const MapaReproduccion = dynamic(() => import("@/components/MapaReproduccion").then((m) => m.MapaReproduccion), {
  ssr: false,
  loading: () => <div className="h-[56vh] min-h-[340px] animate-pulse rounded-2xl bg-paper-200" />,
});

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}

function rangoSemana(desde: string, hasta: string): string {
  const [, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return m1 === m2
    ? `${d1} al ${d2} de ${MESES_LARGOS[m2 - 1]} de ${a2}`
    : `${d1} de ${MESES_LARGOS[m1 - 1]} al ${d2} de ${MESES_LARGOS[m2 - 1]} de ${a2}`;
}

const ha = (v: number) => `${Math.round(v).toLocaleString("es-AR")} ha`;

/**
 * Inundacion 2025: lo que efectivamente paso sobre este campo, visto por satelite.
 *
 * Reemplaza al "lote de demo" que tenia un pronostico armado a mano: aquel mostraba datos
 * inventados con la misma cara que los reales, y no habia forma de saber cual era cual. Aca todo
 * es observado -imagenes Sentinel-2 y lluvia de reanalisis- y la pantalla lo dice antes que nada.
 *
 * Es por establecimiento y no por lote porque es la unidad que se arrienda y se compara, y porque
 * la imagen satelital cubre todos los lotes a la vez; el desglose por lote va al final, que es la
 * parte que le sirve a quien administra campos de terceros para comparar.
 */
export default function Evento2025Page({ params }: PageProps<"/establecimientos/[id]/evento-2025">) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reproduccion-2025", id],
    queryFn: () => api.get<Reproduccion2025>(`/establecimientos/${id}/reproduccion-2025`),
    // El pasado no cambia: api-core lo persiste y solo lo recalcula si cambian los lotes.
    staleTime: Infinity,
    retry: false,
  });

  const recalcular = useMutation({
    mutationFn: () => api.get<Reproduccion2025>(`/establecimientos/${id}/reproduccion-2025?recalcular=true`),
    onSuccess: (nuevo) => {
      queryClient.setQueryData(["reproduccion-2025", id], nuevo);
      notificar("exito", "Reproducción recalculada con las imágenes de 2025");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const [elegida, setElegida] = useState<string | null>(null);
  const [mostrarImagen, setMostrarImagen] = useState(true);
  const [mostrarAgua, setMostrarAgua] = useState(true);
  // Escenario de lluvia: atado a la fecha, asi cambiar de semana vuelve a la lluvia registrada.
  const [escenario, setEscenario] = useState<{ fecha: string; mm: number } | null>(null);

  const disponible = data?.disponible ? data : null;
  const fecha = elegida ?? disponible?.resumen.fechaMax ?? null;
  const escena = disponible?.serie.find((s) => s.fecha === fecha) ?? null;
  const lluviaEscenario = escenario && escenario.fecha === fecha ? escenario.mm : null;
  const indice = disponible && escena ? disponible.serie.indexOf(escena) : -1;

  const { data: imagen, isFetching: cargandoImagen } = useQuery({
    queryKey: ["reproduccion-2025-imagen", id, fecha],
    queryFn: () => api.get<ImagenReproduccion>(`/establecimientos/${id}/reproduccion-2025/imagen?fecha=${fecha}`),
    enabled: !!fecha && mostrarImagen,
    staleTime: Infinity,
    retry: false,
  });

  // La simulacion del sistema para la semana elegida. La primera corrida de un campo baja el
  // relieve (DEM) y tarda; despues el motor lo tiene en memoria y cada semana sale en segundos.
  const {
    data: simulacion,
    isFetching: simulando,
    error: errorSimulacion,
    refetch: reintentarSimulacion,
  } = useQuery({
    queryKey: ["reproduccion-2025-simulacion", id, fecha, lluviaEscenario],
    queryFn: () =>
      api.get<SimulacionReproduccion>(
        `/establecimientos/${id}/reproduccion-2025/simulacion?fecha=${fecha}` +
          (lluviaEscenario != null ? `&lluviaTotalMm=${lluviaEscenario}` : ""),
      ),
    // Mientras corre un escenario nuevo se sigue viendo el anterior en vez de un mapa vacio.
    placeholderData: (previo) => previo,
    enabled: !!fecha && !!disponible,
    staleTime: Infinity,
    retry: false,
  });

  return (
    <div>
      <EncabezadoPantalla
        segmento="evento-2025"
        titulo={establecimiento ? `Inundación 2025 en ${establecimiento.nombre}` : "Inundación 2025"}
        descripcion="Si tu campo se anegó en 2025, cuándo, cuánto y qué lotes, con las imágenes reales del satélite; y si la simulación del sistema lo hubiera reproducido."
        ayuda={
          <InfoAside titulo="Cómo se reconstruyó 2025" etiqueta="De dónde salen estos datos">
            {(cerrar) => <Metodo datos={disponible} onRecalcular={() => { cerrar(); recalcular.mutate(); }} recalculando={recalcular.isPending} />}
          </InfoAside>
        }
      />

      <AvisoDatoReal />

      {isLoading && <Cargando />}

      {error && (
        <div className={`${tarjeta} mt-6 p-5`}>
          <p className="text-sm text-ink-800">{clasificarError(error).mensaje}</p>
          <button className={`${boton.sutil} mt-3`} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {data && !data.disponible && (
        <div className={`${tarjeta} mt-6 p-5`}>
          <p className="text-sm text-ink-800">{data.motivoNoDisponible}</p>
        </div>
      )}

      {disponible && escena && (
        <>
          <Veredicto datos={disponible} />

          <section className="mt-12">
            <TituloSeccion
              titulo="El año, pasada por pasada"
              descripcion="Cada punto es un día en que el satélite vio el campo sin nubes. Abajo, la lluvia de cada semana."
            />
            <div className={`${tarjeta} p-4`}>
              <SerieAnegamiento2025 datos={disponible} seleccionada={escena.fecha} onSeleccionar={setElegida} />
            </div>
          </section>

          <section className="mt-12">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-brand-600">
                  {escena.fecha === disponible.resumen.fechaMax ? "Semana crítica" : "Semana elegida"}
                </p>
                <h2 className="font-display text-lg font-medium text-ink-950">
                  Semana del {rangoSemana(escena.semanaDesde, escena.semanaHasta)}
                </h2>
                <p className="mt-0.5 text-sm text-ink-600">
                  Imagen del {fechaLarga(escena.fecha)}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={boton.sutil}
                  disabled={indice <= 0}
                  onClick={() => setElegida(disponible.serie[indice - 1].fecha)}
                  aria-label="Pasada anterior"
                >
                  <Icono nombre="izquierda" className="h-4 w-4" /> Anterior
                </button>
                {escena.fecha !== disponible.resumen.fechaMax && (
                  <button className={boton.sutil} onClick={() => setElegida(disponible.resumen.fechaMax)}>
                    Ir al pico
                  </button>
                )}
                <button
                  className={boton.sutil}
                  disabled={indice >= disponible.serie.length - 1}
                  onClick={() => setElegida(disponible.serie[indice + 1].fecha)}
                  aria-label="Pasada siguiente"
                >
                  Siguiente <Icono nombre="derecha" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <figure className="space-y-2">
                <figcaption className="flex items-center gap-2 text-sm font-medium text-ink-950">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLOR_AGUA }} />
                  Lo que vio el satélite · {fechaCorta(escena.fecha)}
                </figcaption>
                <MapaReproduccion
                  lotes={lotes}
                  bounds={disponible.bounds}
                  escena={escena}
                  aguaPrevia={disponible.aguaPrevia}
                  imagen={imagen ?? null}
                  mostrarImagen={mostrarImagen}
                  mostrarAgua={mostrarAgua}
                  alto="h-[46vh] min-h-[300px]"
                />
              </figure>
              <figure className="space-y-2">
                <figcaption className="flex items-center gap-2 text-sm font-medium text-ink-950">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLOR_AGUA_SIMULADA }} />
                  Lo que simula el sistema
                  {simulacion?.disponible && simulacion.inicio === "IMAGEN_ANTERIOR" && simulacion.fechaAnterior
                    ? ` · desde el ${fechaCorta(simulacion.fechaAnterior)} (${pct(simulacion.inicialPct)} con agua)`
                    : ""}
                  {simulacion?.disponible && simulacion.escenario ? ` · ${simulacion.lluviaSemanaMm.toLocaleString("es-AR")} mm` : ""}
                </figcaption>
                <div className="relative">
                  <MapaReproduccion
                    lotes={lotes}
                    bounds={disponible.bounds}
                    escena={escena}
                    aguaPrevia={null}
                    imagen={null}
                    mostrarImagen={false}
                    mostrarAgua={mostrarAgua}
                    bandasSimuladas={simulacion?.disponible ? simulacion.bandasSimuladas : null}
                    claveSimulacion={
                      simulacion?.disponible ? `${simulacion.fecha}-${simulacion.escenario ? simulacion.lluviaSemanaMm : "real"}` : "vacia"
                    }
                    alto="h-[46vh] min-h-[300px]"
                  />
                  {simulando && (
                    <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-2xl bg-paper-50/70 backdrop-blur-[1px]">
                      <p className="flex items-center gap-2 rounded-full border border-paper-300 bg-paper-50 px-3 py-1.5 text-xs text-ink-700 shadow-sm">
                        <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-paper-300 border-t-clay-500" />
                        Corriendo la simulación con el clima de esa semana…
                      </p>
                    </div>
                  )}
                </div>
              </figure>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-paper-300 bg-paper-50 px-3 py-2 text-xs text-ink-700">
              <Interruptor activo={mostrarImagen} onCambio={setMostrarImagen}>
                Foto real del satélite {cargandoImagen && mostrarImagen && <span className="text-ink-500">(bajando…)</span>}
              </Interruptor>
              <Interruptor activo={mostrarAgua} onCambio={setMostrarAgua}>
                Agua
              </Interruptor>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded-sm" style={{ background: COLOR_AGUA }} /> Observada
              </span>
              <span className="inline-flex items-center gap-1.5">
                Simulada (mm):
                {simulacion?.disponible && simulacion.bandasSimuladas.length > 0 ? (
                  simulacion.bandasSimuladas.map((b, i, todas) => (
                    <span key={b.desde} className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <span className="inline-block h-3 w-4 rounded-sm" style={{ background: colorBandaSimulada(i, todas.length) }} />
                      {i === todas.length - 1 ? `≥${b.desde}` : `${b.desde}–${b.hasta}`}
                    </span>
                  ))
                ) : (
                  <span className="text-ink-500">sin agua</span>
                )}
              </span>
              {disponible.aguaPrevia && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-5 rounded-sm opacity-60" style={{ background: COLOR_AGUA_PREVIA }} />
                  Lagunas que ya estaban
                </span>
              )}
              {imagen && !imagen.disponible && mostrarImagen && <span className="text-ink-500">{imagen.motivoNoDisponible}</span>}
            </div>

            <Comparacion
              lluviaEscenario={lluviaEscenario}
              onReintentar={() => reintentarSimulacion()}
              onEscenario={(mm) => setEscenario(mm == null ? null : { fecha: escena.fecha, mm })}
              escena={escena}
              superficieHa={disponible.resumen.superficieHa}
              simulacion={simulacion ?? null}
              simulando={simulando}
              error={errorSimulacion ? clasificarError(errorSimulacion).mensaje : null}
              nombres={Object.fromEntries(disponible.lotes.map((l) => [l.loteId, l.nombre ?? "Lote"]))}
            />
          </section>

          <section className="mt-12">
            <TituloSeccion
              titulo="Lote por lote en 2025"
              descripcion="Para comparar lotes o campos: el peor momento de cada uno y cuánto tiempo tuvo agua."
            />
            <TablaLotes lotes={disponible.lotes} umbral={disponible.metodo.umbralAnegadoPct} onVerFecha={setElegida} />
          </section>
        </>
      )}
    </div>
  );
}

/** El primer mensaje de la pantalla: esto paso, no es un calculo del sistema sobre el futuro. */
function AvisoDatoReal() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-100/60 px-4 py-3">
      <Icono nombre="historico" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
      <div className="text-sm leading-relaxed text-ink-800">
        <p className="font-medium text-ink-950">Reproducción de lo que pasó, con datos reales.</p>
        <p>
          El agua en azul es la que fotografió el satélite Sentinel-2 (ESA) sobre tus lotes en 2025, y la lluvia es la registrada
          en la zona. Al lado, en otro color, está lo que simula el sistema con esa misma lluvia: así se ve si el modelo hubiera
          reproducido lo que pasó.
        </p>
      </div>
    </div>
  );
}

function Cargando() {
  return (
    <div className={`${tarjeta} mt-6 p-5`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper-300 border-t-brand-600" />
        <p className="text-sm text-ink-800">Bajando las imágenes de 2025 sobre tus lotes…</p>
      </div>
      <p className="mt-1 text-xs text-ink-600">
        Se revisa cada pasada del satélite del año (unas cien). La primera vez tarda alrededor de un minuto; después queda
        guardado.
      </p>
      <div className="mt-4 h-40 animate-pulse rounded-lg bg-paper-200" />
    </div>
  );
}

function Veredicto({ datos }: { datos: Reproduccion2025 }) {
  const r = datos.resumen;
  const lluviaSobreNormal =
    datos.lluvia.totalMm != null && datos.lluvia.normalAnualMm
      ? Math.round((100 * (datos.lluvia.totalMm - datos.lluvia.normalAnualMm)) / datos.lluvia.normalAnualMm)
      : null;
  const anegados = datos.lotes.filter((l) => l.huboAnegamiento).length;

  return (
    <motion.section variants={revealVariants} initial="hidden" animate="visible" className="mt-8">
      <h2 className="max-w-3xl font-display text-2xl leading-snug text-ink-950">
        {r.huboAnegamiento ? (
          <>
            Sí: en 2025 el campo tuvo agua en superficie. En el peor momento, el {fechaLarga(r.fechaMax)}, cubría el{" "}
            <span style={{ color: COLOR_AGUA }}>{r.maxPct.toLocaleString("es-AR")} %</span> de los lotes.
          </>
        ) : (
          <>No se vio anegamiento significativo sobre los lotes en ninguna pasada despejada de 2025.</>
        )}
      </h2>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Superficie bajo agua en el pico" valor={ha(r.maxHa)} detalle={`${r.maxPct.toLocaleString("es-AR")} % de ${ha(r.superficieHa)}`} />
        <Dato etiqueta="Semana crítica" valor={`${fechaCorta(r.semanaCriticaDesde)} – ${fechaCorta(r.semanaCriticaHasta)}`} detalle="La de más agua observada" />
        <Dato
          etiqueta="Tiempo con agua"
          valor={r.diasConAgua ? `${r.diasConAgua} días` : "—"}
          detalle={
            r.primeraFechaConAgua && r.ultimaFechaConAgua
              ? `Del ${fechaCorta(r.primeraFechaConAgua)} al ${fechaCorta(r.ultimaFechaConAgua)}, sobre ${datos.metodo.umbralAnegadoPct} %`
              : `Nunca pasó el ${datos.metodo.umbralAnegadoPct} % de los lotes`
          }
        />
        <Dato
          etiqueta="Lluvia del año"
          valor={datos.lluvia.totalMm != null ? `${datos.lluvia.totalMm.toLocaleString("es-AR")} mm` : "—"}
          detalle={
            lluviaSobreNormal != null
              ? `${lluviaSobreNormal >= 0 ? "+" : ""}${lluviaSobreNormal} % sobre lo normal (${datos.lluvia.normalAnualMm?.toLocaleString("es-AR")} mm)`
              : undefined
          }
        />
      </div>
      {datos.lotes.length > 1 && (
        <p className="mt-3 text-sm text-ink-600">
          {anegados === 0
            ? "Ningún lote pasó el umbral de anegamiento."
            : `${anegados} de ${datos.lotes.length} lotes pasaron el ${datos.metodo.umbralAnegadoPct} % de su superficie bajo agua en algún momento.`}
        </p>
      )}
    </motion.section>
  );
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className={`${tarjeta} p-4`}>
      <p className="text-xs text-ink-600">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold text-ink-950">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-ink-600">{detalle}</p>}
    </div>
  );
}

function Interruptor({ activo, onCambio, children }: { activo: boolean; onCambio: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={activo} onChange={(e) => onCambio(e.target.checked)} className="h-3.5 w-3.5 accent-brand-700" />
      {children}
    </label>
  );
}

function TablaLotes({
  lotes,
  umbral,
  onVerFecha,
}: {
  lotes: LoteReproduccion[];
  umbral: number;
  onVerFecha: (fecha: string) => void;
}) {
  const ordenados = [...lotes].sort((a, b) => (b.maxPct ?? -1) - (a.maxPct ?? -1));
  return (
    <div className="overflow-x-auto rounded-xl border border-paper-300 bg-paper-50">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-paper-100 text-xs text-ink-600">
          <tr>
            <th className="px-4 py-2.5 font-medium">Lote</th>
            <th className="px-4 py-2.5 text-right font-medium">Peor momento</th>
            <th className="px-4 py-2.5 font-medium">Tiempo con agua</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((l) => {
            return (
              <tr key={l.loteId} className="border-t border-paper-200 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink-950">{l.nombre ?? "Lote"}</p>
                  <p className="text-xs text-ink-600">{ha(l.superficieHa)}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  {l.maxPct != null && l.fechaMax ? (
                    <>
                      <p className="font-tabular text-ink-950">
                        {l.maxPct.toLocaleString("es-AR")} % · {ha(l.maxHa ?? 0)}
                      </p>
                      <button onClick={() => onVerFecha(l.fechaMax!)} className="text-xs text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600">
                        {fechaCorta(l.fechaMax)} · ver en el mapa
                      </button>
                    </>
                  ) : (
                    <span className="text-ink-500">sin observaciones</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-800">
                  {l.huboAnegamiento && l.primeraFechaConAgua && l.ultimaFechaConAgua ? (
                    <>
                      <p>{l.diasConAgua} días</p>
                      <p className="text-xs text-ink-600">
                        {fechaCorta(l.primeraFechaConAgua)} → {fechaCorta(l.ultimaFechaConAgua)} · {l.escenasConAgua} de {l.escenasObservadas} imágenes
                      </p>
                    </>
                  ) : (
                    <p className="text-ink-600">No pasó el {umbral} % en ninguna imagen</p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Recalcular la simulacion con otra lluvia total para la semana. La lluvia se reparte sobre los
 * MISMOS dias en que llovio en 2025 y en la misma proporcion (si fueron 3 dias, 3 dias); lo demas
 * -temperatura, viento, radiacion, lluvia previa, suelo, relieve- sigue siendo el real. Sirve para
 * ver cuanto depende el modelo de la cantidad de agua y refinarlo, no para "hacer que coincida".
 */
function ControlLluvia({
  real,
  dias,
  actual,
  simulando,
  onAplicar,
}: {
  real: number;
  dias: string[];
  actual: number | null;
  simulando: boolean;
  onAplicar: (mm: number | null) => void;
}) {
  const [borrador, setBorrador] = useState<number>(actual ?? real);
  // La lluvia real casi nunca es entera (64,5 mm): con paso de 1 mm el control no podia volver a
  // ella y "volver a 64" corria en realidad un escenario de 64 o 65 mm. Paso de 0,1 mm, y lo que
  // cae a menos de medio decimo de la real se trata como la real.
  const esLaReal = (mm: number) => Math.abs(mm - real) < 0.05;
  const tope = Math.max(300, Math.ceil((real * 4) / 50) * 50);
  const sinLluvia = dias.length === 0;

  return (
    <div className={`${tarjeta} p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink-950">Probar con otra lluvia total</p>
        <p className="text-xs text-ink-600">
          Real: {real.toLocaleString("es-AR")} mm
          {sinLluvia ? " (no llovió ningún día)" : ` en ${dias.length} ${dias.length === 1 ? "día" : "días"}: ${dias.map(fechaCorta).join(", ")}`}
        </p>
      </div>
      {sinLluvia ? (
        <p className="mt-2 text-xs text-ink-600">
          Esa semana no llovió: no hay días sobre los cuales repartir otra cantidad de lluvia. Elegí otra semana.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="range"
              min={0}
              max={tope}
              step={0.1}
              value={borrador}
              onChange={(e) => setBorrador(Number(e.target.value))}
              className="w-full max-w-md accent-clay-500"
              aria-label="Lluvia total de la semana en milímetros"
            />
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-800">
              <input
                type="number"
                min={0}
                max={1000}
                step={0.1}
                value={borrador}
                onChange={(e) => setBorrador(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                className="w-20 rounded-lg border border-paper-300 bg-paper-50 px-2 py-1 text-right font-tabular"
              />
              mm
            </label>
            <button
              className={boton.secundario}
              disabled={simulando || (actual == null ? esLaReal(borrador) : Math.abs(borrador - actual) < 0.05)}
              onClick={() => onAplicar(esLaReal(borrador) ? null : Math.round(borrador * 10) / 10)}
            >
              {simulando ? "Simulando…" : "Recalcular simulación"}
            </button>
            {actual != null && (
              <button
                className={boton.sutil}
                disabled={simulando}
                onClick={() => {
                  setBorrador(real);
                  onAplicar(null);
                }}
              >
                Volver a la lluvia real
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-600">
            Se reparte en los mismos días y proporción que en 2025. El resto de los datos sigue siendo real.
          </p>
        </>
      )}
    </div>
  );
}

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("es-AR")} %`);

/**
 * El backtest: la simulacion del sistema -el mismo modelo diario del Pronostico, con el suelo de
 * cada lote- corrida con el clima REAL de los 7 dias previos a la foto, contra el agua de la foto.
 *
 * Se compara agua con agua, en el mismo lugar y el mismo dia. Antes aca se ponia al lado el score
 * de riesgo del lote, que es otra cosa (un indice calculado con el clima de hoy) y exigia haber
 * evaluado el riesgo. Los porcentajes de la comparacion se miden en la grilla del modelo (celdas
 * de ~500 m), por eso el observado puede diferir un poco del que da la foto a 30 m.
 */
function Comparacion({
  lluviaEscenario,
  onReintentar,
  onEscenario,
  escena,
  superficieHa,
  simulacion,
  simulando,
  error,
  nombres,
}: {
  lluviaEscenario: number | null;
  onReintentar: () => void;
  onEscenario: (mm: number | null) => void;
  escena: { fecha: string; anegadoPct: number; anegadoHa: number };
  superficieHa: number;
  simulacion: SimulacionReproduccion | null;
  simulando: boolean;
  error: string | null;
  nombres: Record<string, string>;
}) {
  // Los servicios de relieve y suelo son gratuitos y a veces no contestan a tiempo: el "no
  // disponible" queda en cache como cualquier respuesta, asi que tiene que poder reintentarse.
  if (error) {
    return (
      <div className={`${tarjeta} mt-4 flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm text-ink-800">No se pudo correr la simulación: {error}</p>
        <button className={boton.sutil} onClick={onReintentar} disabled={simulando}>Reintentar</button>
      </div>
    );
  }
  const sim = simulacion?.disponible ? simulacion : null;
  if (simulacion && !simulacion.disponible) {
    return (
      <div className="mt-4 space-y-3">
        <div className={`${tarjeta} flex flex-wrap items-center justify-between gap-3 p-4`}>
          <p className="text-sm text-ink-800">{simulacion.motivoNoDisponible}</p>
          <button className={boton.sutil} onClick={onReintentar} disabled={simulando}>
            {simulando ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
        {lluviaEscenario != null && (
          <button className={boton.sutil} onClick={() => onEscenario(null)}>
            Volver a la lluvia real
          </button>
        )}
      </div>
    );
  }
  const maxLluvia = Math.max(1, ...(sim?.dias.map((d) => d.lluviaMm) ?? [1]));

  return (
    <div className="mt-6 space-y-4">
      {sim && (
        <ControlLluvia
          key={`${escena.fecha}-${sim.lluviaRealMm}`}
          real={sim.lluviaRealMm}
          dias={sim.diasConLluvia}
          actual={lluviaEscenario}
          simulando={simulando}
          onAplicar={onEscenario}
        />
      )}

      {sim && (
        <p className="max-w-3xl text-sm leading-relaxed text-ink-800">{sim.diagnostico}</p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className={`${tarjeta} p-4`}>
          <p className="flex items-center gap-2 text-xs text-ink-600">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_AGUA }} /> Satélite, {fechaCorta(escena.fecha)}
          </p>
          <p className="mt-1 text-3xl font-semibold text-ink-950">{pct(escena.anegadoPct)}</p>
          <p className="text-xs text-ink-600">{ha(escena.anegadoHa)} de {ha(superficieHa)} con agua, a 30 m</p>
          {sim?.total.observadoPct != null && (
            <p className="mt-2 border-t border-paper-200 pt-2 text-xs text-ink-700">
              En celdas del modelo: <strong className="font-tabular">{pct(sim.total.observadoPct)}</strong> (la misma escala que la simulación)
            </p>
          )}
        </div>
        <div className={`${tarjeta} p-4`}>
          <p className="flex items-center gap-2 text-xs text-ink-600">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_AGUA_SIMULADA }} /> Simulación del sistema
          </p>
          <p className="mt-1 text-3xl font-semibold text-ink-950">{sim ? pct(sim.total.simuladoPct) : simulando ? "…" : "—"}</p>
          <p className="text-xs text-ink-600">
            {!sim
              ? "Corriendo con el clima real de esos días"
              : sim.inicio === "IMAGEN_ANTERIOR" && sim.fechaAnterior
                ? `Agua que deja el ${fechaCorta(sim.fecha)}, arrancando con la foto del ${fechaCorta(sim.fechaAnterior)}`
                : sim.diaPicoSimulado
                  ? `Máximo de los 7 días previos (sin foto anterior cercana), el ${fechaCorta(sim.diaPicoSimulado)}`
                  : "Ningún día dejó agua en la simulación"}
          </p>
        </div>
        <div className={`${tarjeta} p-4`}>
          <p className="text-xs text-ink-600">Acierto (0 a 1: aciertos sobre aciertos, omisiones y falsas alarmas)</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-700">Modelo</dt>
              <dd className="text-lg font-semibold text-ink-950">{sim?.total.csi != null ? sim.total.csi.toLocaleString("es-AR") : sim ? "—" : "…"}</dd>
            </div>
            {sim?.persistencia && (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-700">Si nada cambiaba desde la foto anterior</dt>
                  <dd className="text-lg font-semibold text-ink-950">
                    {sim.persistencia.csi != null ? sim.persistencia.csi.toLocaleString("es-AR") : "—"}
                  </dd>
                </div>
                <p className="text-xs text-ink-600">
                  Es la vara: si el modelo no le gana, simular no agrega nada sobre mirar la última foto.
                </p>
              </>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t border-paper-200 pt-2">
              <dt className="text-ink-700">Detección</dt>
              <dd className="text-lg font-semibold text-ink-950">{sim ? pct(sim.total.deteccionPct) : "…"}</dd>
            </div>
            <p className="text-xs text-ink-600">De lo que se vio inundado, qué parte marcó el modelo.</p>
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <dt className="text-ink-700">Falsas alarmas</dt>
              <dd className="text-lg font-semibold text-ink-950">{sim ? pct(sim.total.falsaAlarmaPct) : "…"}</dd>
            </div>
            <p className="text-xs text-ink-600">De lo que marcó el modelo, qué parte estaba seca.</p>
          </dl>
        </div>
      </div>

      {sim && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${tarjeta} p-4`}>
            <p className="mb-3 text-xs text-ink-600">
              {sim.inicio === "IMAGEN_ANTERIOR" && sim.fechaAnterior
                ? `Los ${sim.dias.length} días entre las dos fotos (${fechaCorta(sim.fechaAnterior)} → ${fechaCorta(sim.fecha)}): lluvia y humedad del suelo reales, y superficie con agua en la simulación`
                : `Los ${sim.dias.length} días simulados: lluvia y humedad del suelo reales, y superficie con agua en la simulación`}
            </p>
            <table className="w-full text-xs">
              <thead className="text-ink-600">
                <tr>
                  <th className="pb-1.5 text-left font-medium">Día</th>
                  <th className="pb-1.5 text-left font-medium">Lluvia</th>
                  <th className="pb-1.5 text-right font-medium">Suelo saturado</th>
                  <th className="pb-1.5 text-right font-medium">Simulado con agua</th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {sim.dias.map((d) => (
                  <tr key={d.fecha} className="border-t border-paper-200">
                    <td className="py-1.5 text-ink-800">{fechaCorta(d.fecha)}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2 rounded-full bg-ink-400" style={{ width: `${Math.max(2, (d.lluviaMm / maxLluvia) * 80)}px` }} />
                        <span className="text-ink-700">{d.lluviaMm.toLocaleString("es-AR")} mm</span>
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-ink-700">{pct(d.saturacionSueloPct)}</td>
                    <td className="py-1.5 text-right text-ink-950">{pct(d.simuladoPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-ink-600">
              En esa semana llovieron {sim.lluviaSemanaMm.toLocaleString("es-AR")} mm; en los 30 días previos a la foto,{" "}
              {sim.lluvia30DiasMm.toLocaleString("es-AR")} mm.
            </p>
          </div>

          <div className={`${tarjeta} p-4`}>
            <p className="mb-3 text-xs text-ink-600">Por lote, ese día</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-600">
                <tr>
                  <th className="pb-1.5 text-left font-medium">Lote</th>
                  <th className="pb-1.5 text-right font-medium">Satélite</th>
                  <th className="pb-1.5 text-right font-medium">Simulado</th>
                  <th className="pb-1.5 text-right font-medium">Detección</th>
                </tr>
              </thead>
              <tbody className="font-tabular">
                {sim.porLote.map((l) => (
                  <tr key={l.loteId} className="border-t border-paper-200">
                    <td className="py-1.5 text-ink-800">{nombres[l.loteId] ?? l.nombre ?? "Lote"}</td>
                    <td className="py-1.5 text-right text-ink-950">{pct(l.observadoPct)}</td>
                    <td className="py-1.5 text-right text-ink-950">{pct(l.simuladoPct)}</td>
                    <td className="py-1.5 text-right text-ink-700">{pct(l.deteccionPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-ink-600">
              Medido en la escala del modelo: celdas de ~{Math.round(sim.celdaM)} m, con agua si tienen al menos{" "}
              {sim.umbralLaminaMm} mm de lámina media. La foto pasa por la misma conversión, así que el satélite acá no es el
              porcentaje a 30 m de arriba.
            </p>
          </div>
        </div>
      )}

      {sim && <p className="text-xs text-ink-500">{sim.fuente}.</p>}
    </div>
  );
}

function Metodo({ datos, onRecalcular, recalculando }: { datos: Reproduccion2025 | null; onRecalcular: () => void; recalculando: boolean }) {
  return (
    <>
      <p>
        <strong>Imágenes.</strong> Sentinel-2 (ESA/Copernicus) pasa sobre la zona cada 2 a 5 días. Se usan todas las pasadas de 2025
        en las que al menos el {datos?.metodo.despejadoMinimoPct ?? 75} % de tus lotes se vio sin nubes; las nubladas no cuentan
        como “seco”, se descartan.
      </p>
      <p>
        <strong>Qué es agua.</strong> Un píxel tiene agua cuando refleja más en el verde que en el infrarrojo de onda corta (índice
        MNDWI mayor a 0), o cuando la propia clasificación de ESA lo marca como agua. Se trabaja con píxeles de{" "}
        {datos?.metodo.resolucionM ?? 30} m.
      </p>
      <p>
        <strong>Lagunas.</strong> {datos?.metodo.lineaDeBase ?? "El agua que ya estaba antes del evento se descuenta."}
      </p>
      <p>
        <strong>Lluvia.</strong> Reanálisis ERA5 (ECMWF) vía Open-Meteo, en el centro del establecimiento. Lo “normal” es el
        promedio 2001-2024 de cada mes.
      </p>
      <p>
        <strong>Umbral.</strong> Un lote cuenta como anegado si alguna imagen lo mostró con al menos el{" "}
        {datos?.metodo.umbralAnegadoPct ?? 5} % de su superficie bajo agua. Por debajo, la diferencia es del orden del error de
        clasificación.
      </p>
      <p>
        <strong>La comparación con el sistema.</strong> Para cada foto se corre la misma simulación diaria que usa el
        Pronóstico, alimentada con lo que realmente pasó: arranca con el agua que se vio en la foto despejada anterior (su
        profundidad se estima con el relieve, por el método FwDET) y avanza día por día, arrastrando el agua, con la lluvia y
        la humedad del suelo registradas (ERA5) hasta la fecha de la foto. El relieve es el Copernicus DEM promediado por
        celda. Si no hay una foto anterior en los 25 días previos, arranca seco la semana anterior.
      </p>
      <p>
        <strong>La vara.</strong> Al lado del acierto del modelo se muestra el de suponer que el agua quedó igual que en la
        foto anterior. En un anegamiento lento como el de 2025 esa suposición acierta mucho: el modelo aporta cuando le gana,
        es decir, cuando la lluvia de esos días cambió el agua y el modelo lo capturó.
      </p>
      <p className="rounded-lg bg-paper-100 px-3 py-2 text-xs text-ink-700">
        <strong>Lo que no se ve.</strong> El agua bajo un cultivo o pastizal muy denso, las semanas completamente nubladas y los
        charcos de menos de un tercio de hectárea. Por eso los valores son un piso: el campo pudo tener algo más de agua, no menos.
      </p>
      <p className="text-xs text-ink-600">
        Se calcula una vez y queda guardado. Si redibujás un lote se recalcula solo.
      </p>
      <button className={boton.sutil} onClick={onRecalcular} disabled={recalculando}>
        {recalculando ? "Recalculando…" : "Volver a calcular"}
      </button>
    </>
  );
}
