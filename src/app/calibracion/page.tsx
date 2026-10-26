"use client";

import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { boton, tarjeta } from "@/lib/estilos";
import { EncabezadoPantalla, TituloSeccion } from "@/components/EncabezadoPantalla";
import type { CorridaCalibracion, FactoresCalibracion, PesosSugeridos, ResultadoLoteCalibracion, ResumenCalibracion } from "@/lib/types";

const MapaCalibracion = dynamic(() => import("@/components/MapaCalibracion").then((m) => m.MapaCalibracion), {
  ssr: false,
  loading: () => <div className="h-[26rem] animate-pulse rounded-xl bg-paper-200" />,
});

const ETIQUETA_FACTOR: Record<keyof FactoresCalibracion, string> = {
  topografia: "Topografía",
  suelo: "Suelo (INTA)",
  antecedentes: "Historia de agua (JRC)",
  humedad: "Humedad antecedente",
  escorrentia: "Escorrentía (lluvia siguiente)",
  saturacion: "Humedad profunda (napa)",
  enso: "ENSO",
};

const EN_CURSO = new Set(["PENDIENTE", "CORRIENDO"]);

function pct(v: number | null | undefined, decimales = 0): string {
  return v == null ? "—" : `${(v * 100).toFixed(decimales)}%`;
}

function num(v: number | null | undefined, decimales = 2): string {
  return v == null ? "—" : v.toFixed(decimales);
}

/**
 * Sandbox de calibracion: el motor entero corrido hacia atras sobre N lotes sinteticos, contra el
 * agua que vio el satelite. Responde "que tan calibrado esta el motor" con numeros e intervalos,
 * no con un caso elegido a mano.
 */
export default function CalibracionPage() {
  const { sesion } = useAuth();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string | null>(null);
  const [anio, setAnio] = useState(2025);
  const [cantidad, setCantidad] = useState(40);
  const [semilla, setSemilla] = useState(2025);

  const { data: corridas = [] } = useQuery({
    queryKey: ["calibracion"],
    queryFn: () => api.get<CorridaCalibracion[]>("/calibracion/corridas"),
    enabled: !!sesion?.adminPlataforma,
    // Mientras haya una corrida en curso se refresca el avance; si no, no hay nada que mirar.
    refetchInterval: (q) => (q.state.data?.some((c) => EN_CURSO.has(c.estado)) ? 5000 : false),
  });
  const actualId = seleccionada ?? corridas[0]?.id ?? null;
  const resumenActual = corridas.find((c) => c.id === actualId);

  const { data: detalle } = useQuery({
    queryKey: ["calibracion", actualId],
    queryFn: () => api.get<CorridaCalibracion>(`/calibracion/corridas/${actualId}`),
    enabled: !!actualId,
    refetchInterval: resumenActual && EN_CURSO.has(resumenActual.estado) ? 10000 : false,
  });
  const otra = corridas.find((c) => c.id === comparar) ?? null;

  const iniciar = useMutation({
    mutationFn: () => api.post<CorridaCalibracion>("/calibracion/corridas", { anio, cantidadLotes: cantidad, semilla }),
    onSuccess: (c) => {
      setSeleccionada(c.id);
      queryClient.invalidateQueries({ queryKey: ["calibracion"] });
      notificar("exito", `Corrida iniciada: ${c.cantidadLotes} lotes del evento ${c.anio}. Tarda alrededor de un minuto y medio por lote.`);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const reintentar = useMutation({
    mutationFn: (id: string) => api.post<CorridaCalibracion>(`/calibracion/corridas/${id}/reintentar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calibracion"] });
      notificar("exito", "Reintentando los lotes que fallaron. Al terminar se rehace el resumen.");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  if (sesion && !sesion.adminPlataforma) {
    return <p className="text-ink-600">El sandbox de calibración es solo para administradores de la plataforma.</p>;
  }

  const hayEnCurso = corridas.some((c) => EN_CURSO.has(c.estado));

  return (
    <div className="space-y-10">
      <EncabezadoPantalla
        antetitulo="Herramientas"
        titulo="Calibración del motor"
        descripcion="El motor completo corrido hacia atrás sobre N lotes de prueba, contra el agua que vio Sentinel-2. El score se calcula como se hubiera calculado antes del evento; la simulación se compara con suponer que el agua queda igual que en la foto anterior."
      />

      <section className={`${tarjeta} p-5`}>
        <TituloSeccion
          titulo="Nueva corrida"
          descripcion="Lotes cuadrados de 100 a 300 ha sorteados dentro del límite oficial de la Cuenca del Río Salado (SSRH), en proporción al área de cada partido. La misma semilla da siempre los mismos lotes: para comparar dos versiones del motor, usá la misma."
        />
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm text-ink-700">
            Evento
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="mt-1 block rounded-lg border border-paper-300 bg-paper-50 px-3 py-2">
              <option value={2025}>2025 (calibración)</option>
              <option value={2017}>2017 (prueba fuera de muestra)</option>
            </select>
          </label>
          <label className="text-sm text-ink-700">
            Lotes
            <input type="number" min={1} max={100} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="mt-1 block w-24 rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 font-mono" />
          </label>
          <label className="text-sm text-ink-700">
            Semilla
            <input type="number" value={semilla} onChange={(e) => setSemilla(Number(e.target.value))} className="mt-1 block w-28 rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 font-mono" />
          </label>
          <button className={boton.primario} disabled={hayEnCurso || iniciar.isPending} onClick={() => iniciar.mutate()}>
            {hayEnCurso ? "Hay una corrida en curso" : "Iniciar corrida"}
          </button>
          <span className="text-xs text-ink-500">≈ {Math.round((cantidad * 1.5) / 60 * 10) / 10} h</span>
        </div>
      </section>

      {corridas.length > 0 && (
        <section>
          <TituloSeccion titulo="Corridas" descripcion="Elegí una para ver el detalle y, si querés, otra para comparar." />
          <div className="overflow-x-auto rounded-xl border border-paper-300">
            <table className="w-full text-sm">
              <thead className="bg-paper-100 text-left text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-3 py-2">Iniciada</th><th className="px-3 py-2">Evento</th><th className="px-3 py-2">Lotes</th>
                  <th className="px-3 py-2">Semilla</th><th className="px-3 py-2">Motor</th><th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Pares bien ordenados</th><th className="px-3 py-2">Comparar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-200">
                {corridas.map((c) => (
                  <tr key={c.id} onClick={() => setSeleccionada(c.id)} className={`cursor-pointer ${c.id === actualId ? "bg-brand-100" : "hover:bg-paper-100"}`}>
                    <td className="px-3 py-2">{new Date(c.iniciadaEn).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", hour12: false })}</td>
                    <td className="px-3 py-2">{c.anio}</td>
                    <td className="px-3 py-2 font-mono">{c.lotesHechos}/{c.cantidadLotes}</td>
                    <td className="px-3 py-2 font-mono">{c.semilla}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.versionMotor ?? "—"} · {c.huellaMotor ?? ""}</td>
                    <td className="px-3 py-2">
                      {c.estado === "CORRIENDO" ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-200">
                            <span className="block h-full bg-brand-600" style={{ width: `${(100 * c.lotesHechos) / c.cantidadLotes}%` }} />
                          </span>
                          corriendo
                        </span>
                      ) : c.estado.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 font-mono">{pct(c.resumen?.riesgo?.paresBienOrdenados)}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {c.id !== actualId && c.estado === "TERMINADA" && (
                        <input type="radio" name="comparar" checked={comparar === c.id} onChange={() => setComparar(c.id)} aria-label="Comparar con esta corrida" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {detalle?.error && <p className={`${tarjeta} p-4 text-sm text-risk-alto-ink`}>La corrida falló: {detalle.error}</p>}
      {detalle && !EN_CURSO.has(detalle.estado) && (detalle.resumen?.lotesConError.length ?? 0) > 0 && (
        <div className={`${tarjeta} flex flex-wrap items-center justify-between gap-3 p-4`}>
          <p className="text-sm text-ink-700">
            {detalle.resumen!.lotesConError.length} lotes no se pudieron evaluar (cortes de red, límites de la API de clima o del
            catálogo satelital). Las métricas de abajo son sobre {detalle.resumen!.lotesEvaluados} lotes.
          </p>
          <button className={boton.secundario} disabled={hayEnCurso || reintentar.isPending} onClick={() => reintentar.mutate(detalle.id)}>
            Reintentar lotes fallidos
          </button>
        </div>
      )}
      {detalle?.resumen && <Metricas resumen={detalle.resumen} otra={otra?.resumen ?? null} />}
      {detalle?.resultados && detalle.resultados.length > 0 && (
        <>
          <section>
            <TituloSeccion
              titulo="Lotes en el mapa"
              descripcion="Relleno: score antes del evento (más oscuro, más riesgo). Borde: lo que pasó (azul = el satélite lo vio anegado, negro = seco). Oscuro con borde negro es una falsa alarma; claro con borde azul, un anegamiento que el score no vio venir."
            />
            <MapaCalibracion resultados={detalle.resultados} />
          </section>
          <TablaLotes resultados={detalle.resultados} />
        </>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle, estado }: { titulo: string; valor: string; detalle?: React.ReactNode; estado?: "bien" | "mal" | "neutro" }) {
  const color = estado === "bien" ? "text-risk-bajo-ink" : estado === "mal" ? "text-risk-alto-ink" : "text-ink-950";
  return (
    <div className={`${tarjeta} p-4`}>
      <p className="text-xs uppercase tracking-wide text-ink-600">{titulo}</p>
      <p className={`mt-1 font-mono text-2xl ${color}`}>{valor}</p>
      {detalle && <p className="mt-1 text-xs leading-relaxed text-ink-600">{detalle}</p>}
    </div>
  );
}

function Delta({ actual, otra, puntos = true }: { actual: number | null | undefined; otra: number | null | undefined; puntos?: boolean }) {
  if (actual == null || otra == null) return null;
  const d = actual - otra;
  if (Math.abs(d) < 1e-9) return <span className="ml-1 text-ink-500">(=)</span>;
  return (
    <span className={`ml-1 ${d > 0 ? "text-risk-bajo-ink" : "text-risk-alto-ink"}`}>
      ({d > 0 ? "+" : ""}{puntos ? `${(d * 100).toFixed(1)} pts` : d.toFixed(3)} vs la otra)
    </span>
  );
}

function Metricas({ resumen, otra }: { resumen: ResumenCalibracion; otra: ResumenCalibracion | null }) {
  const r = resumen.riesgo;
  const s = resumen.simulacion;
  const meta = r?.metaParesBienOrdenados ?? 0.7;
  return (
    <section className="space-y-6">
      <TituloSeccion
        titulo="Qué tan calibrado está"
        descripcion={`${resumen.lotesEvaluados} de ${resumen.lotes} lotes evaluados (${resumen.lotesAnegados ?? 0} anegados según el satélite). Motor ${resumen.versionMotor} · ${resumen.huellaMotor}. Los intervalos son del 90 % (bootstrap): con pocos lotes y un solo evento la incertidumbre es grande.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Pares de lotes bien ordenados"
          valor={pct(r?.paresBienOrdenados)}
          estado={r?.paresBienOrdenados == null ? "neutro" : r.paresBienOrdenados >= meta ? "bien" : "mal"}
          detalle={<>Meta del TFI: ≥ {pct(meta)}. IC90 {r?.paresBienOrdenadosIntervalo90 ? `${pct(r.paresBienOrdenadosIntervalo90[0])}–${pct(r.paresBienOrdenadosIntervalo90[1])}` : "—"}<Delta actual={r?.paresBienOrdenados} otra={otra?.riesgo?.paresBienOrdenados} /></>}
        />
        <Tarjeta
          titulo="AUC del score"
          valor={num(r?.auc)}
          estado={r?.auc == null ? "neutro" : r.auc >= 0.7 ? "bien" : r.auc <= 0.6 ? "mal" : "neutro"}
          detalle={<>0,5 es azar; 1, separación perfecta entre lotes anegados y secos. IC90 {r?.aucIntervalo90 ? `${num(r.aucIntervalo90[0])}–${num(r.aucIntervalo90[1])}` : "—"}<Delta actual={r?.auc} otra={otra?.riesgo?.auc} puntos={false} /></>}
        />
        <Tarjeta
          titulo="Simulación vs persistencia"
          valor={`${num(s?.csiModeloMedio)} / ${num(s?.csiPersistenciaMedio)}`}
          estado={s?.csiModeloMedio == null || s.csiPersistenciaMedio == null ? "neutro" : s.csiModeloMedio > s.csiPersistenciaMedio ? "bien" : "mal"}
          detalle={<>CSI medio del modelo / de suponer que el agua queda igual que en la foto anterior, en {s?.pares ?? 0} pares. El modelo le gana en {pct(s?.fraccionQueGanaAPersistencia)} de los pares.<Delta actual={s?.csiModeloMedio} otra={otra?.simulacion?.csiModeloMedio} puntos={false} /></>}
        />
        <Tarjeta
          titulo="Duración: acierto de la franja"
          valor={pct(resumen.duracion?.aciertoFranja)}
          estado={resumen.duracion?.aciertoFranja == null ? "neutro" : resumen.duracion.aciertoFranja >= 0.6 ? "bien" : "mal"}
          detalle={<>En {resumen.duracion?.lotes ?? 0} lotes anegados: la franja estimada en el pico contiene la duración observada. Subestima en {pct(resumen.duracion?.subestima)}.</>}
        />
      </div>

      {r && (
        <div className="grid gap-6 lg:grid-cols-2">
          <BarrasFactores titulo="Qué factor separa anegados de secos (AUC por factor)" valores={r.aucPorFactor} />
          <div className={`${tarjeta} p-4`}>
            <p className="mb-3 text-sm font-medium text-ink-950">Fiabilidad: ¿más score, más anegamiento?</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-600">
                <tr><th className="py-1">Tercil de score</th><th className="py-1">Lotes</th><th className="py-1">Score medio</th><th className="py-1">Se anegó</th></tr>
              </thead>
              <tbody>
                {r.fiabilidad.map((t) => (
                  <tr key={t.tercil}><td className="py-1">{t.tercil}</td><td className="py-1 font-mono">{t.lotes}</td><td className="py-1 font-mono">{num(t.scoreMedio)}</td><td className="py-1 font-mono">{pct(t.fraccionAnegada)}</td></tr>
                ))}
              </tbody>
            </table>
            {resumen.porPartido && resumen.porPartido.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-ink-600">
                Muestra por partido (lotes / anegados):{" "}
                {resumen.porPartido.map((p) => `${p.partido} ${p.lotes}/${p.anegados}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

      {resumen.pesos && <PanelPesos pesos={resumen.pesos} titulo="Pesos sugeridos por los datos, evaluando el 1° de marzo (no aplicados)" />}

      {resumen.riesgoMensual && <Mensual m={resumen.riesgoMensual} otra={otra?.riesgoMensual ?? null} />}

      {resumen.lotesConError.length > 0 && (
        // Los mensajes de error pueden traer URLs largas sin espacios: se cortan para no estirar la pagina.
        <p className="text-xs text-ink-600 [overflow-wrap:anywhere]">
          Lotes sin evaluar: {resumen.lotesConError.map((e) => `${e.id} (${e.error.split(" for url")[0].slice(0, 120)})`).join("; ")}
        </p>
      )}
    </section>
  );
}

function BarrasFactores({ titulo, valores }: { titulo: string; valores: Partial<Record<keyof FactoresCalibracion, number | null>> }) {
  return (
    <div className={`${tarjeta} p-4`}>
      <p className="mb-3 text-sm font-medium text-ink-950">{titulo}</p>
      <div className="space-y-2">
        {(Object.keys(ETIQUETA_FACTOR) as (keyof FactoresCalibracion)[]).map((f) => {
          const v = valores[f] ?? null;
          return (
            <div key={f} className="grid grid-cols-[12rem_1fr_3rem] items-center gap-2 text-xs">
              <span className="text-ink-700">{ETIQUETA_FACTOR[f]}</span>
              <svg viewBox="0 0 100 8" className="h-2.5 w-full" preserveAspectRatio="none" aria-hidden>
                <rect x="0" y="0" width="100" height="8" className="fill-paper-200" />
                {v != null && <rect x="0" y="0" width={v * 100} height="8" className={v >= 0.6 ? "fill-brand-600" : v <= 0.4 ? "fill-clay-500" : "fill-ink-400"} />}
                <line x1="50" x2="50" y1="0" y2="8" className="stroke-ink-950" strokeWidth="0.6" />
              </svg>
              <span className="text-right font-mono">{num(v)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-500">La línea marca 0,5 (azar). Debajo de 0,5 el factor apunta al revés: más valor en los lotes que no se anegaron.</p>
    </div>
  );
}

function PanelPesos({ pesos, titulo }: { pesos: PesosSugeridos; titulo: string }) {
  return (
    <div className={`${tarjeta} p-4`}>
      <p className="text-sm font-medium text-ink-950">{titulo}</p>
      <p className="mt-1 text-xs text-ink-600">{pesos.nota}{pesos.casos ? ` Casos: ${pesos.casos}.` : ""}</p>
      <table className="mt-3 w-full max-w-xl text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-600">
          <tr><th className="py-1">Factor</th><th className="py-1">Actual</th><th className="py-1">Sugerido</th></tr>
        </thead>
        <tbody>
          {pesos.factores.map((f, i) => (
            <tr key={f}><td className="py-1">{ETIQUETA_FACTOR[f] ?? f}</td><td className="py-1 font-mono">{num(pesos.actuales[i])}</td><td className="py-1 font-mono">{num(pesos.sugeridos[i])}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-ink-700">
        AUC con los pesos actuales: <span className="font-mono">{num(pesos.aucActualMismosLotes)}</span> · con los sugeridos, medido en el partido que no participó del ajuste: <span className="font-mono">{num(pesos.aucSugeridoFueraDeMuestra)}</span>
      </p>
    </div>
  );
}

function Mensual({ m, otra }: { m: NonNullable<ResumenCalibracion["riesgoMensual"]>; otra: ResumenCalibracion["riesgoMensual"] | null }) {
  return (
    <section className="space-y-4">
      <TituloSeccion
        titulo="Evaluación mensual: ¿anticipa el agua que viene?"
        descripcion={`El score el 1° de cada mes contra lo que vio el satélite en los 60 días siguientes: ${m.casos} casos lote-mes (${m.casosAnegados} con agua). "Anticipación" mira solo los casos en que el lote todavía no tenía agua al evaluar.`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta titulo="AUC mensual" valor={num(m.auc)} estado={m.auc == null ? "neutro" : m.auc >= 0.7 ? "bien" : m.auc <= 0.6 ? "mal" : "neutro"}
          detalle={<>IC90 {m.aucIntervalo90 ? `${num(m.aucIntervalo90[0])}–${num(m.aucIntervalo90[1])}` : "—"}<Delta actual={m.auc} otra={otra?.auc} puntos={false} /></>} />
        <Tarjeta titulo="AUC de anticipación" valor={num(m.aucAnticipacion)} estado={m.aucAnticipacion == null ? "neutro" : m.aucAnticipacion >= 0.7 ? "bien" : m.aucAnticipacion <= 0.6 ? "mal" : "neutro"}
          detalle={<>{m.casosAnticipacion} casos sin agua al evaluar.<Delta actual={m.aucAnticipacion} otra={otra?.aucAnticipacion} puntos={false} /></>} />
        <Tarjeta titulo="Pares bien ordenados, por mes" valor={pct(m.paresBienOrdenadosPorMes)} estado={m.paresBienOrdenadosPorMes == null ? "neutro" : m.paresBienOrdenadosPorMes >= 0.7 ? "bien" : "mal"}
          detalle={<>Lotes comparados el mismo día; meta ≥ 70 %.<Delta actual={m.paresBienOrdenadosPorMes} otra={otra?.paresBienOrdenadosPorMes} /></>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <BarrasFactores titulo="AUC por factor, evaluación mensual" valores={m.aucPorFactor} />
        <div className={`${tarjeta} p-4`}>
          <p className="mb-3 text-sm font-medium text-ink-950">Mes por mes</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-600">
              <tr><th className="py-1">Evaluado el</th><th className="py-1">Casos</th><th className="py-1">Con agua después</th><th className="py-1">AUC</th></tr>
            </thead>
            <tbody>
              {m.porMes.map((x) => (
                <tr key={x.fecha}><td className="py-1">{new Date(`${x.fecha}T12:00:00`).toLocaleDateString("es-AR")}</td><td className="py-1 font-mono">{x.casos}</td><td className="py-1 font-mono">{x.anegados}</td><td className="py-1 font-mono">{num(x.auc)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {m.pesos && <PanelPesos pesos={m.pesos} titulo="Pesos sugeridos por la evaluación mensual (no aplicados)" />}
    </section>
  );
}

function TablaLotes({ resultados }: { resultados: ResultadoLoteCalibracion[] }) {
  const filas = [...resultados].sort((a, b) => (b.riesgo?.score ?? -1) - (a.riesgo?.score ?? -1));
  return (
    <section>
      <TituloSeccion titulo="Lote por lote" descripcion="Ordenados por score. La columna de simulación compara el CSI medio del modelo con el de la persistencia en los pares de fotos de ese lote." />
      <div className="overflow-x-auto rounded-xl border border-paper-300">
        <table className="w-full text-sm">
          <thead className="bg-paper-100 text-left text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-3 py-2">Lote</th><th className="px-3 py-2">Suelo</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">Agua máx.</th>
              <th className="px-3 py-2">Días con agua</th><th className="px-3 py-2">Simulación (modelo / persist.)</th>
              <th className="px-3 py-2">Duración real vs estimada</th><th className="px-3 py-2">% pérdida (obs. / sim.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-200">
            {filas.map((r) => {
              const sims = (r.simulaciones ?? []).filter((s) => s.csiModelo != null && s.csiPersistencia != null);
              const media = (k: "csiModelo" | "csiPersistencia") => (sims.length ? sims.reduce((a, s) => a + (s[k] ?? 0), 0) / sims.length : null);
              const d = r.duracion;
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.nombre ?? r.id}</td>
                  {r.error ? (
                    <td colSpan={7} className="px-3 py-2 text-xs text-ink-500 [overflow-wrap:anywhere]">Sin evaluar: {r.error.split(" for url")[0].slice(0, 160)}</td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-xs">{r.riesgo?.suelo ? `${r.riesgo.suelo.procedencia === "INTA" ? "INTA" : r.riesgo.suelo.procedencia.toLowerCase()} · grupo ${r.riesgo.suelo.grupoDominante}` : "—"}</td>
                      <td className="px-3 py-2 font-mono">{num(r.riesgo?.score)}</td>
                      <td className={`px-3 py-2 font-mono ${r.observado?.huboAnegamiento ? "text-brand-700" : ""}`}>{r.observado?.maxPct ?? 0}%</td>
                      <td className="px-3 py-2 font-mono">{r.observado?.diasConAgua ?? 0}</td>
                      <td className="px-3 py-2 font-mono">{sims.length ? `${num(media("csiModelo"))} / ${num(media("csiPersistencia"))}` : "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {d ? `${d.observadaMin}–${d.observadaMax ?? "+"} d vs ${d.estimada ? `${d.estimada.diasMin}–${d.estimada.diasMax} d` : "—"}` : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">{r.perdida ? `${num(r.perdida.conAguaObservada, 1)} / ${num(r.perdida.conAguaSimulada, 1)}` : "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
