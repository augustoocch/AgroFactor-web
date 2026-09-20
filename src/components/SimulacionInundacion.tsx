"use client";

import { useQuery } from "@tanstack/react-query";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { EscenaSimulacion, VISTAS, type ActivoMarcador } from "@/components/EscenaSimulacion";
import { InfoModal } from "@/components/InfoModal";
import { api, obtenerImagenUrl } from "@/lib/api";
import type {
  Activo,
  ActivoFoto,
  Lote,
  SimulacionInundacion as Simulacion,
  TerrenoBounds,
  TipoActivo,
} from "@/lib/types";

const TIPO_ACTIVO_LABEL: Record<TipoActivo, string> = {
  HACIENDA: "Hacienda",
  MAQUINARIA: "Maquinaria",
  INSTALACION: "Instalacion",
  RESERVA_FORRAJERA: "Reserva forrajera",
  CAMINO_ACCESO: "Camino / acceso",
};

/** Miniatura de la primera foto del activo, si tiene. Se trae como blob autenticado (igual que en PanelFotosActivo), no <img src> directo. */
function FotoActivo({ activoId, className }: { activoId: string; className: string }) {
  const { data: fotos } = useQuery({
    queryKey: ["activo-fotos", activoId],
    queryFn: () => api.get<ActivoFoto[]>(`/activos/${activoId}/fotos`),
  });
  const primera = fotos?.[0];
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!primera) return;
    let cancelado = false;
    let objectUrl: string | null = null;
    obtenerImagenUrl(`/activos/${activoId}/fotos/${primera.id}/archivo`).then((u) => {
      if (cancelado) {
        URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
    });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activoId, primera]);

  if (!primera || !url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- viene de un blob autenticado, no de una URL publica optimizable
  return <img src={url} alt="" className={className} />;
}

/** Proyecta cada activo sobre la grilla del dominio simulado y calcula a que hora, si alguna, el agua lo alcanza. */
function proyectarActivos(
  activos: Activo[],
  bounds: TerrenoBounds,
  filas: number,
  columnas: number,
  pasos: Simulacion["pasos"],
): ActivoMarcador[] {
  const dLat = bounds.latMax - bounds.latMin || 1;
  const dLon = bounds.lonMax - bounds.lonMin || 1;

  return activos
    .filter((a) => a.ubicacion)
    .map((activo) => {
      const { lat, lon } = activo.ubicacion!;
      const fLat = Math.min(Math.max((lat - bounds.latMin) / dLat, 0), 1);
      const fLon = Math.min(Math.max((lon - bounds.lonMin) / dLon, 0), 1);
      const fila = Math.round(fLat * (filas - 1));
      const columna = Math.round(fLon * (columnas - 1));
      // Sin dato de altura se asume a ras de suelo: cualquier lamina visible ya lo alcanza.
      const umbralMm = (activo.alturaSobreSueloCm ?? 0) * 10;

      let horaInundacion: number | null = null;
      for (const paso of pasos) {
        const lamina = paso.laminaGrid[fila]?.[columna] ?? 0;
        if (lamina >= Math.max(umbralMm, 1)) {
          horaInundacion = paso.hora;
          break;
        }
      }

      return {
        id: activo.id,
        nombre: activo.nombre,
        tipo: activo.tipo,
        movilidad: activo.movilidad,
        valorEstimadoUsd: activo.valorEstimado,
        fFila: fLat * (filas - 1),
        fColumna: fLon * (columnas - 1),
        inundadoAhora: false,
        seInundaEnEscenario: horaInundacion !== null,
        horaInundacion,
      } satisfies ActivoMarcador;
    });
}

export interface ParametrosSimulacion {
  modo: "real" | "sintetico";
  escenarioLluviaMm: number;
  horas: number;
  vientoKmh: number;
  direccionVientoDeg: number;
  lluvia5DiasMm: number;
  humedadSueloM3m3: number;
}

// Humedad a la que el perfil ya no admite mas agua. Es el mismo tope que usa el calculo, y sirve
// para mostrar la humedad como "que tan lleno esta el suelo" en vez de en m3/m3.
const HUMEDAD_SATURACION_M3M3 = 0.45;

const PUNTOS_CARDINALES = [
  { deg: 0, etiqueta: "N" },
  { deg: 45, etiqueta: "NE" },
  { deg: 90, etiqueta: "E" },
  { deg: 135, etiqueta: "SE" },
  { deg: 180, etiqueta: "S" },
  { deg: 225, etiqueta: "SO" },
  { deg: 270, etiqueta: "O" },
  { deg: 315, etiqueta: "NO" },
];

function rosaDeLosVientos(deg: number): string {
  const indice = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return PUNTOS_CARDINALES[indice].etiqueta;
}

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  unidad,
  ayuda,
  formatearValor,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  unidad: string;
  ayuda?: string;
  /** Para los controles cuyo valor interno no se puede mostrar tal cual (ver la humedad del
      suelo, que se maneja en m3/m3 y en pantalla va como porcentaje del perfil ocupado). */
  formatearValor?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-ink-800">{etiqueta}</label>
        <span className="font-mono text-xs text-brand-700">
          {formatearValor ? formatearValor(valor) : `${valor}${unidad}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      {ayuda && <p className="text-[10px] leading-tight text-ink-600">{ayuda}</p>}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-paper-300 bg-paper-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-brand-600">{titulo}</p>
      {children}
    </div>
  );
}

function Metrica({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-paper-300 bg-paper-50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-600">{etiqueta}</p>
      <p className="font-mono text-lg font-medium text-ink-950">{valor}</p>
      {detalle && <p className="text-[10px] leading-tight text-ink-600">{detalle}</p>}
    </div>
  );
}

interface Props {
  simulacion: Simulacion;
  /** Lotes del alcance simulado: se dibujan como contorno real y se pueden tocar para enfocarlos. */
  lotes?: Lote[];
  /** Lote actualmente enfocado (o null si el alcance es "todo el predio"). */
  loteSeleccionadoId?: string | null;
  onSeleccionarLote?: (id: string | null) => void;
  /** Activos del alcance simulado, para mostrar cuales se mojan y a que hora. */
  activos?: Activo[];
  parametros: ParametrosSimulacion;
  recalculando: boolean;
  onCambiar: (p: ParametrosSimulacion) => void;
  onRestablecer: () => void;
}

export function SimulacionInundacion({
  simulacion,
  lotes,
  loteSeleccionadoId,
  onSeleccionarLote,
  activos,
  parametros,
  recalculando,
  onCambiar,
  onRestablecer,
}: Props) {
  const [indicePaso, setIndicePaso] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(true);
  const [vista, setVista] = useState(VISTAS[0]);
  const [mostrarFlechas, setMostrarFlechas] = useState(true);
  const [mostrarLluvia, setMostrarLluvia] = useState(true);
  const [activoSeleccionadoId, setActivoSeleccionadoId] = useState<string | null>(null);
  // Solo visual (no toca el calculo), por eso no viaja en los parametros que se mandan al backend.
  const [exageracion, setExageracion] = useState(12);

  const pasos = simulacion.pasos;
  const parametrosHidro = simulacion.parametros;

  const marcadoresActivos = useMemo(() => {
    if (!activos || !simulacion.terreno?.bounds || pasos.length === 0) return [];
    return proyectarActivos(
      activos,
      simulacion.terreno.bounds,
      simulacion.terreno.filas,
      simulacion.terreno.columnas,
      pasos,
    );
  }, [activos, simulacion.terreno, pasos]);

  // Simulacion nueva: la linea de tiempo vuelve a la hora 1 (ajustado durante el render, no con un efecto).
  const [pasosMostrados, setPasosMostrados] = useState(pasos);
  if (pasos !== pasosMostrados) {
    setPasosMostrados(pasos);
    setIndicePaso(0);
  }

  useEffect(() => {
    if (!reproduciendo || pasos.length === 0) return;
    const temporizador = setInterval(() => {
      setIndicePaso((i) => (i + 1) % pasos.length);
    }, 420);
    return () => clearInterval(temporizador);
  }, [reproduciendo, pasos.length]);

  if (!simulacion.disponible || !simulacion.terreno || !parametrosHidro || pasos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-paper-300 p-5 text-center text-sm text-ink-600">
        No se pudo generar la simulacion (el servicio de elevacion no respondio). Proba de nuevo o usa el modo de
        demostracion.
      </p>
    );
  }

  const paso = pasos[Math.min(indicePaso, pasos.length - 1)];

  const activosEnEstaHora = marcadoresActivos.map((a) => ({
    ...a,
    inundadoAhora: a.horaInundacion !== null && a.horaInundacion <= paso.hora,
  }));
  const activosEnRiesgo = activosEnEstaHora
    .filter((a) => a.seInundaEnEscenario)
    .sort((a, b) => (a.horaInundacion ?? 0) - (b.horaInundacion ?? 0));
  const valorExpuestoAhoraUsd = activosEnEstaHora
    .filter((a) => a.inundadoAhora)
    .reduce((acc, a) => acc + a.valorEstimadoUsd, 0);
  const valorTotalEnRiesgoUsd = activosEnRiesgo.reduce((acc, a) => acc + a.valorEstimadoUsd, 0);
  const valorTotalActivosUsd = activosEnEstaHora.reduce((acc, a) => acc + a.valorEstimadoUsd, 0);
  const activoSeleccionado = activosEnEstaHora.find((a) => a.id === activoSeleccionadoId) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        {/* --- Escena 3D --- */}
        <div className="space-y-2">
          <div className="relative h-[30rem] w-full overflow-hidden rounded-2xl border border-paper-300 bg-gradient-to-b from-[#dbe7f0] to-[#f0ece3]">
            <Canvas camera={{ position: VISTAS[0].posicion, fov: 42 }} shadows>
              <EscenaSimulacion
                terreno={simulacion.terreno}
                paso={paso}
                vientoKmh={parametrosHidro.vientoKmh}
                direccionVientoDeg={parametrosHidro.direccionVientoDeg}
                vista={vista}
                mostrarFlechas={mostrarFlechas}
                mostrarLluvia={mostrarLluvia}
                anchoLoteM={parametrosHidro.celdaM * Math.max(simulacion.terreno.columnas - 1, 1)}
                lotes={lotes?.map((l) => ({ id: l.id, nombre: l.nombre, anillo: l.anillo }))}
                loteSeleccionadoId={loteSeleccionadoId}
                onSeleccionarLote={onSeleccionarLote}
                exageracion={exageracion}
                activos={activosEnEstaHora}
                activoSeleccionadoId={activoSeleccionadoId}
                onSeleccionarActivo={setActivoSeleccionadoId}
              />
            </Canvas>

            <div className="absolute left-3 top-3 rounded-xl bg-paper-50/90 px-3 py-2 shadow-sm backdrop-blur">
              <p className="font-mono text-xs text-ink-950">Hora {paso.hora} de {pasos.length}</p>
              <p className="font-mono text-[11px] text-ink-600">Lluvia {paso.lluviaMmH.toFixed(1)} mm/h</p>
              <p className="font-mono text-[11px] text-ink-600">
                Anegado {paso.superficieAnegadaPct.toFixed(0)}% · max {(paso.laminaMaximaMm / 10).toFixed(1)} cm
              </p>
              {marcadoresActivos.length > 0 && (
                <p className="mt-1 border-t border-paper-300 pt-1 font-mono text-[11px] font-medium text-clay-600">
                  Valor bajo agua: USD {valorExpuestoAhoraUsd.toLocaleString("es-AR")}
                </p>
              )}
            </div>

            {recalculando && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper-50/45 backdrop-blur-[1px]">
                <div className="flex items-center gap-2.5 rounded-full bg-paper-50 px-4 py-2 shadow-lg">
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-paper-300 border-t-brand-700" />
                  <span className="text-xs font-medium text-ink-800">Recalculando balance hidrico...</span>
                </div>
              </div>
            )}

            {/* HTML normal, no <Html> de drei: asi no compite en z-index con ningun modal de la pagina. */}
            {activoSeleccionado && (
              <div className="absolute left-3 top-1/2 z-20 w-60 -translate-y-1/2 rounded-xl border border-paper-300 bg-paper-50 p-3 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-950">{activoSeleccionado.nombre}</p>
                    <p className="text-xs text-ink-600">
                      {TIPO_ACTIVO_LABEL[activoSeleccionado.tipo]} · USD{" "}
                      {activoSeleccionado.valorEstimadoUsd.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <button
                    onClick={() => setActivoSeleccionadoId(null)}
                    aria-label="Cerrar ficha"
                    className="shrink-0 rounded-full p-1 text-ink-600 hover:bg-paper-200"
                  >
                    ×
                  </button>
                </div>
                <FotoActivo activoId={activoSeleccionado.id} className="mt-2 h-28 w-full rounded-lg object-cover" />
                <p
                  className="mt-2 rounded-full px-2 py-1 text-center text-[11px] font-medium"
                  style={{
                    color: activoSeleccionado.inundadoAhora
                      ? "var(--color-risk-alto)"
                      : activoSeleccionado.seInundaEnEscenario
                        ? "var(--color-risk-medio)"
                        : "var(--color-risk-bajo)",
                    backgroundColor: activoSeleccionado.inundadoAhora
                      ? "var(--color-risk-alto-bg)"
                      : activoSeleccionado.seInundaEnEscenario
                        ? "var(--color-risk-medio-bg)"
                        : "var(--color-risk-bajo-bg)",
                  }}
                >
                  {activoSeleccionado.inundadoAhora
                    ? "Bajo agua a esta hora"
                    : activoSeleccionado.seInundaEnEscenario
                      ? `Se moja a la hora ${activoSeleccionado.horaInundacion}`
                      : "A salvo en este escenario"}
                </p>
              </div>
            )}

            {mostrarFlechas && (
              <div className="absolute bottom-3 left-3 rounded-xl bg-paper-50/90 px-3 py-2 shadow-sm backdrop-blur">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-600">Escurrimiento</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-[#9fd4ef] to-[#1b6ea8]" />
                  <span className="text-[10px] text-ink-600">lento a rapido</span>
                </div>
                <p className="mt-1 text-[10px] leading-tight text-ink-600">
                  Las flechas avanzan hacia donde va el agua.
                </p>
              </div>
            )}

            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              {VISTAS.map((v) => (
                <button
                  key={v.nombre}
                  onClick={() => setVista(v)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ${
                    vista.nombre === v.nombre ? "bg-brand-700 text-paper-50" : "bg-paper-50/90 text-ink-700"
                  }`}
                >
                  {v.nombre}
                </button>
              ))}
            </div>

            <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
              <InfoModal titulo="Cómo leer esta escena" etiqueta="¿Qué estoy viendo?">
                <ul className="list-disc space-y-2 pl-4">
                  <li>
                    <strong>Línea punteada clara</strong>: el límite real del lote. El terreno de alrededor se simula
                    igual, porque el agua que lo anega muchas veces baja de una loma vecina.
                  </li>
                  <li>
                    <strong>Degradé de la lámina de agua</strong>: celeste donde hay poca agua, azul oscuro donde se
                    acumula más.
                  </li>
                  <li>
                    <strong>Flechas</strong>: hacia dónde escurre el agua ahora mismo. Celeste es lento, azul intenso
                    es rápido.
                  </li>
                  <li>
                    <strong>Mástiles con baliza</strong>: activos del campo (hacienda, maquinaria, instalaciones).
                    Verde = a salvo en este escenario, ámbar = se moja más adelante en la línea de tiempo, rojo = ya
                    está bajo agua a esta hora. Tocá uno para ver su ficha.
                  </li>
                  <li>
                    <strong>Cielo y lluvia</strong>: se oscurecen y espesan con la intensidad real de la hora que se
                    está mostrando en la línea de tiempo, no con el total del evento.
                  </li>
                </ul>
              </InfoModal>
              <p className="rounded-full bg-paper-50/90 px-2.5 py-1 text-[10px] text-ink-600 shadow-sm backdrop-blur">
                Arrastrá para girar · rueda para zoom
              </p>
            </div>
          </div>

          {/* --- Linea de tiempo --- */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-paper-300 bg-paper-50 px-3 py-2">
            <button
              onClick={() => setReproduciendo((r) => !r)}
              className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-paper-50 hover:bg-brand-600"
            >
              {reproduciendo ? "Pausar" : "Reproducir"}
            </button>
            <button
              onClick={() => {
                setReproduciendo(false);
                const indicePico = pasos.findIndex((p) => p.hora === parametrosHidro.horaPicoAnegamiento);
                setIndicePaso(indicePico >= 0 ? indicePico : pasos.length - 1);
              }}
              className="rounded-full border border-clay-500 px-3 py-1.5 text-xs font-medium text-clay-600 hover:bg-clay-100"
            >
              Ir a la hora pico
            </button>
            <input
              type="range"
              min={0}
              max={pasos.length - 1}
              value={indicePaso}
              onChange={(e) => {
                setReproduciendo(false);
                setIndicePaso(Number(e.target.value));
              }}
              className="min-w-[10rem] flex-1 accent-brand-600"
            />
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <input type="checkbox" checked={mostrarLluvia} onChange={(e) => setMostrarLluvia(e.target.checked)} />
              Lluvia
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <input type="checkbox" checked={mostrarFlechas} onChange={(e) => setMostrarFlechas(e.target.checked)} />
              Escurrimiento
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              Relieve ×{exageracion}
              <input
                type="range"
                min={1}
                max={40}
                value={exageracion}
                onChange={(e) => setExageracion(Number(e.target.value))}
                className="w-20 accent-clay-500"
              />
            </label>
          </div>
        </div>

        {/* --- Controles --- */}
        <div className="space-y-3 rounded-2xl border border-paper-300 bg-paper-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-ink-950">Variables del escenario</h3>
              <p className="text-[10px] leading-tight text-ink-600">
                Se recalcula solo al soltar cada control.
              </p>
            </div>
            <button
              onClick={onRestablecer}
              className="rounded-full border border-paper-300 bg-paper-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:border-brand-500"
            >
              Datos reales
            </button>
          </div>

          <div className="flex gap-1.5">
            {(["real", "sintetico"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onCambiar({ ...parametros, modo: m })}
                className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-medium ${
                  parametros.modo === m ? "bg-brand-700 text-paper-50" : "border border-paper-300 text-ink-700"
                }`}
              >
                {m === "real" ? "Terreno real" : "Demo con pendiente"}
              </button>
            ))}
          </div>

          <Grupo titulo="Evento de lluvia">
            <Deslizador
              etiqueta="Lluvia total"
              valor={parametros.escenarioLluviaMm}
              min={0}
              max={300}
              paso={5}
              unidad=" mm"
              ayuda="No cae pareja: se reparte a lo largo del evento como lo hace una tormenta de verdad."
              onChange={(v) => onCambiar({ ...parametros, escenarioLluviaMm: v })}
            />
            <Deslizador
              etiqueta="Duración"
              valor={parametros.horas}
              min={6}
              max={72}
              paso={6}
              unidad=" h"
              onChange={(v) => onCambiar({ ...parametros, horas: v })}
            />
          </Grupo>

          <Grupo titulo="Estado previo del suelo">
            <Deslizador
              etiqueta="Lluvia previa (5 días)"
              valor={parametros.lluvia5DiasMm}
              min={0}
              max={150}
              paso={5}
              unidad=" mm"
              ayuda="Cuanto llovio antes del evento. Sobre un suelo ya mojado, la misma lluvia deja mas agua arriba."
              onChange={(v) => onCambiar({ ...parametros, lluvia5DiasMm: v })}
            />
            <Deslizador
              etiqueta="Humedad del suelo"
              valor={parametros.humedadSueloM3m3}
              min={0.05}
              max={0.45}
              paso={0.01}
              unidad=""
              formatearValor={(v) => `${Math.round((v / HUMEDAD_SATURACION_M3M3) * 100)}% lleno`}
              ayuda="Cuanta agua tiene el suelo antes de la primera gota. Al 100 % ya no le entra una gota mas."
              onChange={(v) => onCambiar({ ...parametros, humedadSueloM3m3: v })}
            />
          </Grupo>

          <Grupo titulo="Viento">
            <Deslizador
              etiqueta="Velocidad"
              valor={parametros.vientoKmh}
              min={0}
              max={80}
              paso={1}
              unidad=" km/h"
              ayuda="Seca mas rapido el suelo y empuja el agua que queda en superficie."
              onChange={(v) => onCambiar({ ...parametros, vientoKmh: v })}
            />
            <Deslizador
              etiqueta={`Direccion (${rosaDeLosVientos(parametros.direccionVientoDeg)})`}
              valor={parametros.direccionVientoDeg}
              min={0}
              max={350}
              paso={10}
              unidad="°"
              onChange={(v) => onCambiar({ ...parametros, direccionVientoDeg: v })}
            />
          </Grupo>
        </div>
      </div>

      {/* --- Activos expuestos --- */}
      {marcadoresActivos.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-paper-300 bg-paper-100 p-4">
          <div>
            <h3 className="text-sm font-medium text-ink-950">Activos expuestos en este escenario</h3>
            <p className="text-[11px] leading-tight text-ink-600">
              Cruza la posición de cada activo con la lámina de agua hora por hora. Tocá un ítem para ubicarlo en la
              escena, o un marcador en la escena para ver su ficha.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <Metrica
              etiqueta="Valor bajo agua ahora"
              valor={`USD ${valorExpuestoAhoraUsd.toLocaleString("es-AR")}`}
              detalle={`De un total simulado de USD ${valorTotalActivosUsd.toLocaleString("es-AR")}`}
            />
            <Metrica
              etiqueta="Valor en riesgo en el escenario"
              valor={`USD ${valorTotalEnRiesgoUsd.toLocaleString("es-AR")}`}
              detalle={`${activosEnRiesgo.length} de ${marcadoresActivos.length} activos se mojan en algún momento`}
            />
            <Metrica
              etiqueta="Movibles sin reubicar"
              valor={String(activosEnRiesgo.filter((a) => a.movilidad === "MOVIBLE" && !a.inundadoAhora).length)}
              detalle="Todavía a tiempo de mover, según la hora actual de la reproducción"
            />
          </div>

          {activosEnRiesgo.length === 0 ? (
            <p className="rounded-xl border border-dashed border-paper-300 p-3 text-center text-xs text-ink-600">
              Ningún activo con ubicación cargada se moja en este escenario.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {activosEnRiesgo.map((activo) => (
                <li key={activo.id}>
                  <button
                    onClick={() =>
                      setActivoSeleccionadoId((actual) => (actual === activo.id ? null : activo.id))
                    }
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                      activoSeleccionadoId === activo.id
                        ? "border-brand-500 bg-brand-100"
                        : "border-paper-300 bg-paper-50 hover:border-brand-500/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FotoActivo activoId={activo.id} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      <div>
                        <p className="text-sm font-medium text-ink-900">{activo.nombre}</p>
                        <p className="text-xs text-ink-600">
                          {TIPO_ACTIVO_LABEL[activo.tipo]} · {activo.movilidad === "MOVIBLE" ? "movible" : "fijo"} · USD{" "}
                          {activo.valorEstimadoUsd.toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 font-mono text-xs font-medium ${
                        activo.inundadoAhora
                          ? "bg-[var(--color-risk-alto-bg)] text-[var(--color-risk-alto)]"
                          : "bg-[var(--color-risk-medio-bg)] text-[var(--color-risk-medio)]"
                      }`}
                    >
                      {activo.inundadoAhora ? "Bajo agua ahora" : `Se moja a la hora ${activo.horaInundacion}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* --- Resultados del balance hidrico --- */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-medium text-ink-950">Balance hídrico del evento</h3>
          <InfoModal titulo="Qué hace esta simulación">
            <p>
              Reparte la lluvia hora por hora sobre la altura real del terreno: una parte se infiltra, otra se
              evapora y el resto corre hacia los puntos más bajos, arrastrada por la pendiente y el viento.
            </p>
            <p>
              Sirve para ver dónde se junta el agua, cuánto tarda en juntarse y cuánto tarda en irse. No alcanza
              para dimensionar una obra hidráulica.
            </p>
          </InfoModal>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica
            etiqueta="Lámina máxima"
            valor={`${(parametrosHidro.laminaMaximaMm / 10).toFixed(1)} cm`}
            detalle={`Pico a la hora ${parametrosHidro.horaPicoAnegamiento}`}
          />
          <Metrica
            etiqueta="Superficie anegada"
            valor={`${parametrosHidro.superficieAnegadaPct.toFixed(0)}%`}
            detalle="Celdas con mas de 1 cm de agua"
          />
          <Metrica
            etiqueta="Infiltracion"
            valor={`${parametrosHidro.infiltracionMediaMm.toFixed(0)} mm`}
            detalle={`De ${parametrosHidro.lluviaTotalMm.toFixed(0)} mm caidos`}
          />
          <Metrica
            etiqueta="Escurre fuera del lote"
            valor={`${parametrosHidro.escurrimientoFueraDelLoteMm.toFixed(0)} mm`}
            detalle={`Pendiente media ${parametrosHidro.pendienteMediaPct.toFixed(2)}%`}
          />
          {/* Cero aca significa "el entorno es plano y no aporta", no "sin datos". */}
          <Metrica
            etiqueta="Entra desde afuera"
            valor={`${parametrosHidro.aporteExternoMm.toFixed(0)} mm`}
            detalle={
              parametrosHidro.aporteExternoMm > 0
                ? `${((parametrosHidro.aporteExternoMm / Math.max(parametrosHidro.lluviaTotalMm, 1)) * 100).toFixed(0)}% de lo que llovio, desde los alrededores`
                : "El terreno de alrededor no drena hacia el campo"
            }
          />
          {/* El suelo si se muestra: cambia el resultado y el usuario lo puede corregir cargando
              su analisis. Se omite si la corrida no trajo datos de suelo. */}
          {parametrosHidro.grupoHidrologico && (
            <Metrica
              etiqueta="Suelo"
              valor={`Grupo ${parametrosHidro.grupoHidrologicoDual ?? parametrosHidro.grupoHidrologico}`}
              detalle={
                parametrosHidro.procedenciaSuelo === "SUPUESTO_REGIONAL"
                  ? "Supuesto regional: no se midio el suelo de este campo"
                  : `${parametrosHidro.claseTexturalSuelo ?? "textura resuelta"}${
                      parametrosHidro.coberturaSueloPct != null
                        ? ` · medido en el ${parametrosHidro.coberturaSueloPct.toFixed(0)}% del lote`
                        : ""
                    }`
              }
            />
          )}
          <Metrica
            etiqueta="Almacenamiento del suelo"
            valor={`${parametrosHidro.retencionPotencialMm.toFixed(0)} mm`}
            detalle={`Ya ocupado ${parametrosHidro.saturacionInicialPct.toFixed(0)}%`}
          />
          <Metrica
            etiqueta="Evapotranspiracion"
            valor={`${parametrosHidro.et0MmDia.toFixed(1)} mm/dia`}
            detalle={`Viento ${parametrosHidro.vientoKmh.toFixed(0)} km/h ${rosaDeLosVientos(parametrosHidro.direccionVientoDeg)}`}
          />
          <Metrica
            etiqueta="Desnivel del lote"
            valor={`${parametrosHidro.desnivelM.toFixed(1)} m`}
            detalle={`Celda de ${parametrosHidro.celdaM.toFixed(0)} m`}
          />
        </div>

        {parametrosHidro.procedenciaSuelo === "SUPUESTO_REGIONAL" && (
          <p className="mt-2 rounded-xl border border-dashed border-ink-400/40 p-3 text-xs leading-snug text-ink-600">
            El suelo de este campo no esta cargado, asi que la corrida asume grupo hidrologico D
            -el de los suelos sodicos dominantes de la Pampa Deprimida-. Si tu campo es mas
            arenoso, esta estimacion te sobreestima el agua que corre. Cargar la profundidad de
            napa de un sector es lo que mas cambia el resultado.
          </p>
        )}

        {parametrosHidro.grupoHidrologicoDual && (
          <p className="mt-2 rounded-xl border border-clay-500/40 bg-clay-100 p-3 text-xs leading-snug text-clay-600">
            Con la napa a {parametrosHidro.napaCm} cm, el suelo de este campo se comporta como
            grupo D aunque su textura sea {parametrosHidro.claseTexturalSuelo}: por debajo de los
            60 cm de freatica el perfil ya no tiene donde guardar el agua.
          </p>
        )}

        {parametrosHidro.advertencia && (
          <p className="mt-2 rounded-xl border border-clay-500/40 bg-clay-100 p-3 text-xs leading-snug text-clay-600">
            {parametrosHidro.advertencia}
          </p>
        )}
      </div>
    </div>
  );
}
