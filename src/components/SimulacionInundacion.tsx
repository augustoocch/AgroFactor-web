"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { EscenaSimulacion, VISTAS } from "@/components/EscenaSimulacion";
import { InfoModal } from "@/components/InfoModal";
import type { Coordenada, SimulacionInundacion as Simulacion } from "@/lib/types";

export interface ParametrosSimulacion {
  modo: "real" | "sintetico";
  escenarioLluviaMm: number;
  horas: number;
  vientoKmh: number;
  direccionVientoDeg: number;
  lluvia5DiasMm: number;
  humedadSueloM3m3: number;
}

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
  onChange,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  unidad: string;
  ayuda?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-ink-800">{etiqueta}</label>
        <span className="font-mono text-xs text-brand-700">
          {valor}
          {unidad}
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
  /** Anillos de los lotes simulados: se dibujan como contorno real sobre el terreno. */
  contornos?: Coordenada[][];
  parametros: ParametrosSimulacion;
  recalculando: boolean;
  onCambiar: (p: ParametrosSimulacion) => void;
  onRestablecer: () => void;
}

export function SimulacionInundacion({
  simulacion,
  contornos,
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
  // La exageracion vertical es solo visual (no toca el calculo), por eso vive aca y no en los
  // parametros que se mandan al backend.
  const [exageracion, setExageracion] = useState(12);

  const pasos = simulacion.pasos;
  const parametrosHidro = simulacion.parametros;

  // Cuando llega una simulacion nueva, la linea de tiempo vuelve a la hora 1. Se ajusta durante
  // el render (patron recomendado por React) en vez de con un efecto que dispare otro render.
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
                contornos={contornos}
                exageracion={exageracion}
              />
            </Canvas>

            <div className="absolute left-3 top-3 rounded-xl bg-paper-50/90 px-3 py-2 shadow-sm backdrop-blur">
              <p className="font-mono text-xs text-ink-950">Hora {paso.hora} de {pasos.length}</p>
              <p className="font-mono text-[11px] text-ink-600">Lluvia {paso.lluviaMmH.toFixed(1)} mm/h</p>
              <p className="font-mono text-[11px] text-ink-600">
                Anegado {paso.superficieAnegadaPct.toFixed(0)}% · max {(paso.laminaMaximaMm / 10).toFixed(1)} cm
              </p>
            </div>

            {/* El terreno nunca se desmonta al recalcular: solo se atenua y aparece el spinner,
                asi la pagina no salta ni pierde la posicion de la camara. */}
            {recalculando && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper-50/45 backdrop-blur-[1px]">
                <div className="flex items-center gap-2.5 rounded-full bg-paper-50 px-4 py-2 shadow-lg">
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-paper-300 border-t-brand-700" />
                  <span className="text-xs font-medium text-ink-800">Recalculando balance hidrico...</span>
                </div>
              </div>
            )}

            {/* Referencia: sin esto las flechas y los tonos de azul son decoracion sin significado. */}
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
          </div>

          {/* --- Linea de tiempo --- */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-paper-300 bg-paper-50 px-3 py-2">
            <button
              onClick={() => setReproduciendo((r) => !r)}
              className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-paper-50 hover:bg-brand-600"
            >
              {reproduciendo ? "Pausar" : "Reproducir"}
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
              ayuda="Se reparte en el tiempo con forma de tormenta real (hietograma SCS Tipo II)."
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
              ayuda="Define la condición de humedad antecedente del método SCS-CN."
              onChange={(v) => onCambiar({ ...parametros, lluvia5DiasMm: v })}
            />
            <Deslizador
              etiqueta="Humedad del suelo"
              valor={parametros.humedadSueloM3m3}
              min={0.05}
              max={0.45}
              paso={0.01}
              unidad=" m³/m³"
              ayuda="Cuanto del perfil ya esta ocupado antes de la primera gota (saturacion ~0.45)."
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
              ayuda="Afecta la evapotranspiracion (FAO-56) y arrastra la lamina superficial."
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

      {/* --- Resultados del balance hidrico --- */}
      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-medium text-ink-950">Balance hídrico del evento</h3>
          <InfoModal titulo="Cómo se calcula la simulación">
            <p>
              Cada hora se resuelve un balance de agua celda por celda sobre el modelo de elevación real (SRTM 30m):
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <strong>Número de Curva (SCS-CN, USDA-NRCS)</strong>: cuánta lluvia se transforma en escorrentía según
                el uso del suelo y el grupo hidrológico (D en la Pampa Deprimida), corregido por la lluvia real de los
                últimos 5 días.
              </li>
              <li>
                <strong>Infiltración</strong>: tasa tipo Horton gobernada por el agua que el perfil ya tiene, acotada
                por el almacenamiento potencial S del método CN.
              </li>
              <li>
                <strong>Evapotranspiración FAO-56 Penman-Monteith</strong>: con temperatura, humedad, viento a 2m y
                radiación solar reales.
              </li>
              <li>
                <strong>Escurrimiento con Manning</strong>: v = (1/n)·h^(2/3)·S^(1/2), con la pendiente sacada del DEM
                y reparto hacia las celdas de menor carga hidráulica.
              </li>
            </ul>
            <p className="text-xs text-ink-600">
              Es un modelo 2D simplificado de onda de difusión, no un solver de Saint-Venant: sirve para comparar
              comportamiento (dónde se junta el agua, cuánto tarda, cuánto infiltra), no para diseñar obra hidráulica.
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
          {/* La contracara del anterior, y el dato que antes no existia: el agua que anega un
              campo muchas veces no cayo sobre el, bajo de al lado. Cero significa que el entorno
              es plano y no aporta, que es informacion util y no una capa vacia. */}
          <Metrica
            etiqueta="Entra desde afuera"
            valor={`${parametrosHidro.aporteExternoMm.toFixed(0)} mm`}
            detalle={
              parametrosHidro.aporteExternoMm > 0
                ? `${((parametrosHidro.aporteExternoMm / Math.max(parametrosHidro.lluviaTotalMm, 1)) * 100).toFixed(0)}% de lo que llovio, desde los alrededores`
                : "El terreno de alrededor no drena hacia el campo"
            }
          />
          <Metrica
            etiqueta="Numero de Curva"
            valor={`${parametrosHidro.curvaNumeroAjustada.toFixed(0)}`}
            detalle={`Base ${parametrosHidro.curvaNumeroBase.toFixed(0)} · humedad antecedente ${parametrosHidro.condicionHumedadAntecedente}`}
          />
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

        {parametrosHidro.advertencia && (
          <p className="mt-2 rounded-xl border border-clay-500/40 bg-clay-100 p-3 text-xs leading-snug text-clay-600">
            {parametrosHidro.advertencia}
          </p>
        )}
      </div>
    </div>
  );
}
