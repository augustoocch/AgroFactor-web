"use client";

import { contours } from "d3-contour";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivoMarcador } from "@/components/EscenaSimulacion";
import { dimensionesDe } from "@/components/terreno3d";
import type { Coordenada, PasoSimulacion, Terreno } from "@/lib/types";

/** Lamina (mm) desde la que se dibuja agua: la misma que la escena 3D. */
const LAMINA_VISIBLE_MM = 1;
const NIVELES_CANDIDATOS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const MAX_NIVELES = 6;
// Secuencial de un solo tono, claro a oscuro: los mismos extremos que el agua del 3D.
const AGUA_CLARA = [0xcf, 0xe4, 0xf2];
const AGUA_OSCURA = [0x1d, 0x4d, 0x73];
// Unidades del viewBox por unidad de escena (ver `dimensionesDe`): el lado mayor mide 1000.
const UNIDADES = 100;

function colorNivel(i: number, total: number): string {
  const t = total <= 1 ? 1 : i / (total - 1);
  const [r, g, b] = AGUA_CLARA.map((c, k) => Math.round(c + (AGUA_OSCURA[k] - c) * t));
  return `rgb(${r} ${g} ${b})`;
}

/** Umbrales "redondos" en mm, fijos para toda la corrida: si cambiaran hora a hora, el mismo azul
 * significaria cosas distintas en cada cuadro y la animacion no se podria leer. */
function nivelesDe(pasos: PasoSimulacion[]): number[] {
  const maximo = Math.max(...pasos.map((p) => p.laminaMaximaMm), 0);
  const posibles = NIVELES_CANDIDATOS.filter((n) => n >= LAMINA_VISIBLE_MM && n < maximo);
  if (posibles.length <= MAX_NIVELES) return posibles;
  // Se conservan los extremos y se ralean los del medio.
  const paso = (posibles.length - 1) / (MAX_NIVELES - 1);
  return Array.from({ length: MAX_NIVELES }, (_, i) => posibles[Math.round(i * paso)]);
}

interface Props {
  terreno: Terreno;
  pasos: PasoSimulacion[];
  indicePaso: number;
  reproduciendo: boolean;
  /** Cuanto dura cada hora en la reproduccion: la interpolacion la recorre entera. */
  msPorPaso: number;
  mascaraLote: boolean[][] | null;
  lotes?: { id: string; nombre: string; anillo: Coordenada[] }[];
  loteSeleccionadoId?: string | null;
  onSeleccionarLote?: (id: string | null) => void;
  activos?: ActivoMarcador[];
  activoSeleccionadoId?: string | null;
  onSeleccionarActivo?: (id: string | null) => void;
}

/**
 * La simulacion vista desde arriba, sobre una base plana con la forma real del lote: isobandas de
 * lamina de agua que crecen y se corren de a poco entre hora y hora.
 *
 * Entre dos horas simuladas se interpola la lamina celda por celda. No es un dato nuevo del modelo,
 * es la transicion entre dos que si lo son: sirve para seguir con el ojo hacia donde avanza el agua,
 * que con saltos de una hora entera se pierde.
 */
export function SimulacionPlana({
  terreno,
  pasos,
  indicePaso,
  reproduciendo,
  msPorPaso,
  mascaraLote,
  lotes,
  loteSeleccionadoId,
  onSeleccionarLote,
  activos,
  activoSeleccionadoId,
  onSeleccionarActivo,
}: Props) {
  const { filas, columnas, bounds } = terreno;
  const dimensiones = useMemo(() => dimensionesDe(bounds, 1000), [bounds]);
  const ancho = dimensiones.ancho * UNIDADES;
  const alto = dimensiones.fondo * UNIDADES;
  const niveles = useMemo(() => nivelesDe(pasos), [pasos]);

  // Avance (0-1) dentro de la hora actual. Se reinicia con cada hora nueva, asi la interpolacion
  // queda atada a la misma linea de tiempo que el 3D y el deslizador.
  const [avance, setAvance] = useState(0);
  const inicioPaso = useRef(0);
  // Hora nueva: el avance vuelve a 0 en el mismo render. Si esperara al efecto, un cuadro mostraria
  // la hora nueva con el avance de la anterior (casi 1) y el agua saltaria una hora de mas.
  const [pasoAnimado, setPasoAnimado] = useState(indicePaso);
  if (pasoAnimado !== indicePaso) {
    setPasoAnimado(indicePaso);
    setAvance(0);
  }
  useEffect(() => {
    inicioPaso.current = performance.now();
    if (!reproduciendo) return;
    let cuadro = 0;
    const animar = (ahora: number) => {
      setAvance(Math.min((ahora - inicioPaso.current) / msPorPaso, 1));
      cuadro = requestAnimationFrame(animar);
    };
    cuadro = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(cuadro);
  }, [indicePaso, reproduciendo, msPorPaso]);
  const t = reproduciendo ? avance : 0;

  const actual = pasos[Math.min(indicePaso, pasos.length - 1)];
  // La ultima hora no interpola hacia la primera: la reproduccion vuelve a empezar de cero.
  const siguiente = indicePaso < pasos.length - 1 ? pasos[indicePaso + 1] : actual;

  const lamina = useMemo(() => {
    const valores = new Float64Array(filas * columnas);
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        const a = actual.laminaGrid[f]?.[c] ?? 0;
        const b = siguiente.laminaGrid[f]?.[c] ?? 0;
        valores[f * columnas + c] = a + (b - a) * t;
      }
    }
    return valores;
  }, [actual, siguiente, t, filas, columnas]);

  // Grilla -> viewBox. d3-contour trata cada valor como un pixel: el centro de la celda (c, f) cae
  // en (c + 0.5, f + 0.5). La fila 0 es el SUR, asi que se invierte para dejar el norte arriba.
  const aX = (cx: number) => (Math.min(Math.max(cx - 0.5, 0), columnas - 1) / Math.max(columnas - 1, 1)) * ancho;
  const aY = (cy: number) => (1 - Math.min(Math.max(cy - 0.5, 0), filas - 1) / Math.max(filas - 1, 1)) * alto;

  const bandas = useMemo(() => {
    if (niveles.length === 0 || filas < 2 || columnas < 2) return [];
    const generador = contours().size([columnas, filas]).thresholds(niveles);
    return generador(Array.from(lamina)).map((multi, i) => ({
      nivel: multi.value,
      color: colorNivel(i, niveles.length),
      d: multi.coordinates
        .map((poligono) =>
          poligono.map((anillo) => `M${anillo.map(([x, y]) => `${aX(x).toFixed(1)},${aY(y).toFixed(1)}`).join("L")}Z`).join(""),
        )
        .join(""),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aX/aY dependen solo de los deps listados
  }, [lamina, niveles, filas, columnas, ancho, alto]);

  const proyectar = (c: Coordenada) => {
    if (!bounds) return [0, 0];
    const fLon = (c.lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin || 1);
    const fLat = (c.lat - bounds.latMin) / (bounds.latMax - bounds.latMin || 1);
    return [fLon * ancho, (1 - fLat) * alto];
  };
  const caminoLote = (anillo: Coordenada[]) =>
    `M${anillo.map((c) => proyectar(c).map((v) => v.toFixed(1)).join(",")).join("L")}Z`;
  const lotesDibujables = bounds ? (lotes ?? []).filter((l) => l.anillo.length >= 3) : [];
  const recortar = lotesDibujables.length > 0;

  // Hover: lamina de la celda bajo el puntero, con el valor interpolado que se esta viendo.
  const svg = useRef<SVGSVGElement>(null);
  const [puntero, setPuntero] = useState<{ x: number; y: number; fila: number; columna: number } | null>(null);
  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const matriz = svg.current?.getScreenCTM();
    if (!matriz) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matriz.inverse());
    if (p.x < vista.x || p.y < vista.y || p.x > vista.x + vista.w || p.y > vista.y + vista.h) return setPuntero(null);
    const caja = svg.current!.getBoundingClientRect();
    setPuntero({
      x: e.clientX - caja.left,
      y: e.clientY - caja.top,
      columna: Math.round((p.x / ancho) * (columnas - 1)),
      fila: Math.round((1 - p.y / alto) * (filas - 1)),
    });
  };
  const laminaPuntero = puntero ? lamina[puntero.fila * columnas + puntero.columna] : null;
  const punteroEnLote = puntero ? (mascaraLote?.[puntero.fila]?.[puntero.columna] ?? true) : false;

  // Encuadre: los lotes con un 25 % de alrededor, no el dominio entero. El margen de analisis es
  // grande (el agua baja de los vecinos) y encuadrado completo dejaba el lote chico en el medio.
  const vista = useMemo(() => {
    const puntos = lotesDibujables.flatMap((l) => l.anillo.map(proyectar));
    if (puntos.length === 0) return { x: 0, y: 0, w: ancho, h: alto };
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);
    const holgura = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.25;
    const x = Math.max(Math.min(...xs) - holgura, 0);
    const y = Math.max(Math.min(...ys) - holgura, 0);
    return { x, y, w: Math.min(Math.max(...xs) + holgura, ancho) - x, h: Math.min(Math.max(...ys) + holgura, alto) - y };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proyectar depende de bounds/ancho/alto
  }, [lotes, bounds, ancho, alto]);

  // Barra de escala: el largo redondo mas cercano a un quinto del ancho visible.
  const metrosPorUnidadSvg = dimensiones.metrosPorUnidad / UNIDADES;
  const objetivoBarra = (vista.w * metrosPorUnidadSvg) / 5;
  const metrosBarra = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].reduce((mejor, m) =>
    Math.abs(m - objetivoBarra) < Math.abs(mejor - objetivoBarra) ? m : mejor,
  );
  const largoBarra = metrosBarra / metrosPorUnidadSvg;
  const margen = Math.max(vista.w, vista.h) * 0.05;
  const trazo = Math.max(vista.w, vista.h) / 400;

  return (
    <div className="relative flex h-full w-full flex-col bg-paper-100">
      <div className="relative min-h-0 flex-1 px-6 pb-2 pt-14">
        <svg
          ref={svg}
          viewBox={`${vista.x - margen} ${vista.y - margen} ${vista.w + margen * 2} ${vista.h + margen * 2}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Lámina de agua sobre el lote, hora ${actual.hora}`}
          onPointerMove={alMover}
          onPointerLeave={() => setPuntero(null)}
        >
          <defs>
            <clipPath id="recorte-lotes">
              {lotesDibujables.map((l) => (
                <path key={l.id} d={caminoLote(l.anillo)} />
              ))}
            </clipPath>
          </defs>

          {/* Dominio simulado: el campo y su alrededor, de contexto. */}
          {/* Fuera del encuadre no se dibuja nada: el recorte evita que el contexto se desborde. */}
          <clipPath id="recorte-vista">
            <rect x={vista.x} y={vista.y} width={vista.w} height={vista.h} />
          </clipPath>
          <g clipPath="url(#recorte-vista)">
          <rect x={0} y={0} width={ancho} height={alto} fill="var(--color-paper-200)" />
          {recortar && (
            <g opacity={0.35}>
              {bandas.map((b) => (
                <path key={`ctx-${b.nivel}`} d={b.d} fill={b.color} />
              ))}
            </g>
          )}

          {/* La base plana: la forma real de cada lote. */}
          {lotesDibujables.map((l) => (
            <path key={`base-${l.id}`} d={caminoLote(l.anillo)} fill="var(--color-paper-50)" />
          ))}
          <g clipPath={recortar ? "url(#recorte-lotes)" : undefined}>
            {bandas.map((b) => (
              <path key={b.nivel} d={b.d} fill={b.color} />
            ))}
          </g>
          </g>
          {lotesDibujables.map((l) => {
            const seleccionado = loteSeleccionadoId === l.id;
            return (
              <path
                key={`borde-${l.id}`}
                d={caminoLote(l.anillo)}
                fill="transparent"
                stroke={seleccionado ? "var(--color-clay-500)" : "var(--color-ink-700)"}
                strokeWidth={trazo * (seleccionado ? 2.4 : 1.4)}
                strokeLinejoin="round"
                className="cursor-pointer"
                onClick={() => onSeleccionarLote?.(seleccionado ? null : l.id)}
              >
                <title>{l.nombre}</title>
              </path>
            );
          })}

          {(activos ?? []).map((a) => {
            const x = (a.fColumna / Math.max(columnas - 1, 1)) * ancho;
            const y = (1 - a.fFila / Math.max(filas - 1, 1)) * alto;
            const color = a.inundadoAhora
              ? "var(--color-risk-alto)"
              : a.seInundaEnEscenario
                ? "var(--color-risk-medio)"
                : "var(--color-risk-bajo)";
            const seleccionado = activoSeleccionadoId === a.id;
            return (
              <g
                key={a.id}
                className="cursor-pointer"
                onClick={() => onSeleccionarActivo?.(seleccionado ? null : a.id)}
              >
                <circle cx={x} cy={y} r={trazo * 9} fill="transparent" />
                <circle
                  cx={x}
                  cy={y}
                  r={trazo * (seleccionado ? 5 : 3.5)}
                  fill={color}
                  stroke="var(--color-paper-50)"
                  strokeWidth={trazo}
                />
                <text
                  x={x + trazo * 6}
                  y={y + trazo * 2}
                  fontSize={trazo * 9}
                  className="fill-ink-800"
                  paintOrder="stroke"
                  stroke="var(--color-paper-50)"
                  strokeWidth={trazo * 2}
                >
                  {a.nombre}
                </text>
              </g>
            );
          })}

          {/* Norte y escala: sin mapa de fondo son la unica referencia de orientacion y tamano. */}
          <g transform={`translate(${vista.x + vista.w + margen * 0.5}, ${vista.y + margen * 0.6})`}>
            <path
              d={`M0,${-margen * 0.9} L${margen * 0.3},0 L0,${-margen * 0.25} L${-margen * 0.3},0 Z`}
              fill="var(--color-ink-700)"
            />
            <text y={margen * 0.75} textAnchor="middle" fontSize={margen * 0.6} className="fill-ink-700">
              N
            </text>
          </g>
          <g transform={`translate(${vista.x}, ${vista.y + vista.h + margen * 0.55})`}>
            <line x1={0} x2={largoBarra} y1={0} y2={0} stroke="var(--color-ink-700)" strokeWidth={trazo * 1.5} />
            <line x1={0} x2={0} y1={-margen * 0.15} y2={margen * 0.15} stroke="var(--color-ink-700)" strokeWidth={trazo * 1.5} />
            <line x1={largoBarra} x2={largoBarra} y1={-margen * 0.15} y2={margen * 0.15} stroke="var(--color-ink-700)" strokeWidth={trazo * 1.5} />
            <text x={largoBarra + margen * 0.2} y={margen * 0.15} fontSize={margen * 0.42} className="fill-ink-600">
              {metrosBarra >= 1000 ? `${metrosBarra / 1000} km` : `${metrosBarra} m`}
            </text>
          </g>
        </svg>

        {puntero && laminaPuntero !== null && (
          <div
            className="pointer-events-none absolute z-10 w-max rounded-lg border border-paper-300 bg-paper-50 px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: puntero.x + 14, top: puntero.y - 10 }}
          >
            <p className="font-medium text-ink-950">
              {laminaPuntero >= LAMINA_VISIBLE_MM
                ? `${laminaPuntero.toLocaleString("es-AR", { maximumFractionDigits: 0 })} mm de agua`
                : "Sin agua acumulada"}
            </p>
            <p className="text-ink-600">{punteroEnLote ? "Dentro del campo" : "Alrededores (contexto)"}</p>
          </div>
        )}
      </div>

      {niveles.length > 0 ? (
        // pr-44: el boton "¿Que estoy viendo?" de la escena vive en la esquina inferior derecha.
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-3 pl-6 pr-44 text-[11px] text-ink-600">
          <span className="font-medium text-ink-700">Lámina de agua</span>
          {niveles.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: colorNivel(i, niveles.length) }} />
              {i < niveles.length - 1 ? `${n}–${niveles[i + 1]} mm` : `más de ${n} mm`}
            </span>
          ))}
        </div>
      ) : (
        <p className="px-6 pb-3 text-[11px] text-ink-600">En este escenario no se acumula agua visible.</p>
      )}
    </div>
  );
}
