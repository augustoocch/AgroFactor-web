"use client";

import { useEffect, useState } from "react";
import { COLOR_AGUA } from "@/components/MapaReproduccion";
import type { EscenaReproduccion, Reproduccion2025 } from "@/lib/types";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COLOR_LLUVIA = "var(--color-ink-400)";
const GRILLA = "var(--color-paper-300)";

const ALTO_AGUA = 170;
const ALTO_LLUVIA = 92;
const SEPARACION = 34;
const MARGEN = { izq: 40, der: 12, arriba: 18, abajo: 22 };

export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1].toLowerCase()}`;
}

function diaDelAnio(iso: string, anio: number): number {
  return (Date.UTC(...(iso.split("-").map(Number) as [number, number, number])) - Date.UTC(anio, 0, 1)) / 86_400_000;
}

// Callback ref y no useRef: el contenedor se desmonta al pasar a tabla y vuelve como un nodo nuevo.
// Con un efecto de una sola vez el observer seguia mirando el nodo viejo (ancho 0 -> 320 fijo).
function useAncho<T extends HTMLElement>() {
  const [nodo, ref] = useState<T | null>(null);
  const [ancho, setAncho] = useState(720);
  useEffect(() => {
    if (!nodo) return;
    const obs = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 0) setAncho(Math.max(320, e.contentRect.width));
    });
    obs.observe(nodo);
    return () => obs.disconnect();
  }, [nodo]);
  return { ref, ancho };
}

function techo(valor: number, pasos: number[]): number {
  return pasos.find((p) => p >= valor) ?? Math.ceil(valor / 100) * 100;
}

interface Hover {
  x: number;
  y: number;
  titulo: string;
  lineas: string[];
}

/**
 * El año 2025 del campo en dos paneles alineados sobre el mismo eje de tiempo: arriba, que parte
 * de los lotes se vio bajo agua en cada pasada despejada del satelite; abajo, cuanto llovio cada
 * semana.
 *
 * Dos paneles y no un grafico con dos ejes: son dos medidas distintas (% de superficie y mm), y
 * con dos escalas en el mismo lienzo el cruce de las curvas depende de como se eligio cada escala,
 * no de los datos. Alineados en el tiempo se ve igual la secuencia que importa -llueve, y semanas
 * despues el agua sigue ahi-.
 *
 * Cada punto es una pasada real con el campo despejado; entre dos puntos no hay dato (el satelite no
 * vio o estaba nublado), por eso la linea los une pero la seleccion solo cae en puntos.
 */
export function SerieAnegamiento2025({
  datos,
  seleccionada,
  onSeleccionar,
}: {
  datos: Reproduccion2025;
  seleccionada: string;
  onSeleccionar: (fecha: string) => void;
}) {
  const { ref, ancho } = useAncho<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const [comoTabla, setComoTabla] = useState(false);

  const anio = datos.anio;
  const diasAnio = diaDelAnio(`${anio}-12-31`, anio) + 1;
  const plotAncho = ancho - MARGEN.izq - MARGEN.der;
  const x = (iso: string) => MARGEN.izq + (diaDelAnio(iso, anio) / diasAnio) * plotAncho;

  const maxAgua = techo(Math.max(...datos.serie.map((s) => s.anegadoPct), datos.metodo.umbralAnegadoPct + 1), [10, 20, 25, 40, 50, 75, 100]);
  const yAgua = (pct: number) => MARGEN.arriba + ALTO_AGUA - (pct / maxAgua) * ALTO_AGUA;

  const semanas = datos.lluvia.semanal;
  const maxLluvia = techo(Math.max(10, ...semanas.map((s) => s.mm)), [25, 50, 75, 100, 150, 200, 300]);
  const topLluvia = MARGEN.arriba + ALTO_AGUA + SEPARACION;
  const yLluvia = (mm: number) => topLluvia + ALTO_LLUVIA - (mm / maxLluvia) * ALTO_LLUVIA;
  const anchoSemana = (7 / diasAnio) * plotAncho;
  const anchoBarra = Math.max(2, Math.min(24, anchoSemana - 2));

  const altoTotal = topLluvia + ALTO_LLUVIA + MARGEN.abajo;
  const critica = datos.resumen.fechaMax;
  const puntos = datos.serie.map((s) => [x(s.fecha), yAgua(s.anegadoPct)] as const);
  const linea = puntos.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const base = yAgua(0);
  const area = puntos.length ? `${linea} L${puntos[puntos.length - 1][0].toFixed(1)},${base} L${puntos[0][0].toFixed(1)},${base} Z` : "";
  const sel = datos.serie.find((s) => s.fecha === seleccionada);

  const tooltipEscena = (s: EscenaReproduccion, px: number, py: number) =>
    setHover({
      x: px,
      y: py,
      titulo: `${fechaCorta(s.fecha)} · ${s.anegadoPct.toLocaleString("es-AR")} % con agua`,
      lineas: [
        `${s.anegadoHa.toLocaleString("es-AR")} ha de los lotes`,
        s.lluvia30DiasPreviosMm != null ? `${s.lluvia30DiasPreviosMm.toLocaleString("es-AR")} mm en los 30 días previos` : "",
        `Cielo despejado sobre los lotes: ${s.despejadoPct} %`,
      ].filter(Boolean),
    });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-ink-600">
          {datos.serie.length} pasadas con el campo despejado, de {datos.resumen.pasadasTotales} en el año. Tocá un punto para ver esa semana.
        </p>
        <button
          onClick={() => setComoTabla((v) => !v)}
          className="text-xs font-medium text-brand-700 underline decoration-brand-200 underline-offset-[3px] hover:decoration-brand-600"
        >
          {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </div>

      {comoTabla ? (
        <TablaSerie datos={datos} seleccionada={seleccionada} onSeleccionar={onSeleccionar} />
      ) : (
        <div ref={ref} className="relative w-full select-none" onMouseLeave={() => setHover(null)}>
          <svg width={ancho} height={altoTotal} role="img" aria-label={`Agua sobre los lotes y lluvia semanal en ${anio}`}>
            {/* Panel de agua */}
            <text x={MARGEN.izq} y={11} className="fill-ink-700 text-[11px] font-medium">
              Superficie de los lotes con agua (%)
            </text>
            {[0, maxAgua / 2, maxAgua].map((v) => (
              <g key={`ga${v}`}>
                <line x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={yAgua(v)} y2={yAgua(v)} stroke={GRILLA} strokeWidth={1} />
                <text x={MARGEN.izq - 6} y={yAgua(v) + 3.5} textAnchor="end" className="fill-ink-500 font-tabular text-[10px]">
                  {v.toLocaleString("es-AR")}
                </text>
              </g>
            ))}
            {/* Umbral: debajo de esto no se afirma que el lote se anego. */}
            <line
              x1={MARGEN.izq}
              x2={ancho - MARGEN.der}
              y1={yAgua(datos.metodo.umbralAnegadoPct)}
              y2={yAgua(datos.metodo.umbralAnegadoPct)}
              stroke="var(--color-ink-300)"
              strokeWidth={1}
            />
            <text x={ancho - MARGEN.der} y={yAgua(datos.metodo.umbralAnegadoPct) - 4} textAnchor="end" className="fill-ink-500 text-[10px]">
              umbral {datos.metodo.umbralAnegadoPct} %
            </text>

            {sel && (
              <line x1={x(sel.fecha)} x2={x(sel.fecha)} y1={MARGEN.arriba} y2={topLluvia + ALTO_LLUVIA} stroke="var(--color-ink-600)" strokeWidth={1} />
            )}

            <path d={area} fill={COLOR_AGUA} opacity={0.1} />
            <path d={linea} fill="none" stroke={COLOR_AGUA} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {datos.serie.map((s, i) => {
              const [px, py] = puntos[i];
              const activa = s.fecha === seleccionada;
              return (
                <g
                  key={s.fecha}
                  role="button"
                  tabIndex={0}
                  aria-label={`${fechaCorta(s.fecha)}: ${s.anegadoPct} % con agua`}
                  aria-pressed={activa}
                  className="cursor-pointer outline-none"
                  onClick={() => onSeleccionar(s.fecha)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSeleccionar(s.fecha);
                    }
                  }}
                  onMouseEnter={() => tooltipEscena(s, px, py)}
                  onFocus={() => tooltipEscena(s, px, py)}
                  onBlur={() => setHover(null)}
                >
                  <circle cx={px} cy={py} r={12} fill="transparent" />
                  <circle
                    cx={px}
                    cy={py}
                    r={activa ? 6.5 : 4.5}
                    fill={COLOR_AGUA}
                    stroke="var(--color-paper-50)"
                    strokeWidth={2}
                  />
                </g>
              );
            })}
            {/* Etiqueta selectiva: solo el pico, que es la semana critica. */}
            {(() => {
              const i = datos.serie.findIndex((s) => s.fecha === critica);
              if (i < 0) return null;
              const [px, py] = puntos[i];
              const alDerecha = px < ancho - 150;
              return (
                <text
                  x={px + (alDerecha ? 10 : -10)}
                  y={Math.max(py - 8, MARGEN.arriba + 8)}
                  textAnchor={alDerecha ? "start" : "end"}
                  className="fill-ink-800 text-[11px] font-medium"
                >
                  Pico: {datos.serie[i].anegadoPct.toLocaleString("es-AR")} % · {fechaCorta(critica)}
                </text>
              );
            })()}

            {/* Panel de lluvia */}
            <text x={MARGEN.izq} y={topLluvia - 8} className="fill-ink-700 text-[11px] font-medium">
              Lluvia por semana (mm)
            </text>
            {[0, maxLluvia].map((v) => (
              <g key={`gl${v}`}>
                <line x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={yLluvia(v)} y2={yLluvia(v)} stroke={GRILLA} strokeWidth={1} />
                <text x={MARGEN.izq - 6} y={yLluvia(v) + 3.5} textAnchor="end" className="fill-ink-500 font-tabular text-[10px]">
                  {v}
                </text>
              </g>
            ))}
            {semanas.map((s) => {
              const cx = x(s.desde) + anchoSemana / 2;
              const alto = yLluvia(0) - yLluvia(s.mm);
              if (alto <= 0) return null;
              const r = Math.min(4, anchoBarra / 2, alto);
              const x0 = cx - anchoBarra / 2;
              const y0 = yLluvia(s.mm);
              return (
                <g
                  key={s.desde}
                  onMouseEnter={() =>
                    setHover({
                      x: cx,
                      y: y0,
                      titulo: `Semana del ${fechaCorta(s.desde)} al ${fechaCorta(s.hasta)}`,
                      lineas: [`${s.mm.toLocaleString("es-AR")} mm de lluvia`],
                    })
                  }
                >
                  <rect x={x0 - 2} y={topLluvia} width={anchoBarra + 4} height={ALTO_LLUVIA} fill="transparent" />
                  {/* Punta redondeada, base recta sobre el eje. */}
                  <path
                    d={`M${x0},${yLluvia(0)} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + anchoBarra - r} Q${x0 + anchoBarra},${y0} ${x0 + anchoBarra},${y0 + r} V${yLluvia(0)} Z`}
                    fill={COLOR_LLUVIA}
                  />
                </g>
              );
            })}

            {MESES.map((m, i) => {
              const iso = `${anio}-${String(i + 1).padStart(2, "0")}-01`;
              return (
                <text key={m} x={x(iso) + 2} y={altoTotal - 6} className="fill-ink-500 text-[10px]">
                  {m}
                </text>
              );
            })}
          </svg>

          {hover && (
            <div
              className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-xs shadow-md"
              style={{
                left: Math.min(Math.max(hover.x - 110, 0), ancho - 240),
                top: Math.max(hover.y - 16, 0),
                transform: "translateY(-100%)",
              }}
            >
              <p className="font-medium text-ink-950">{hover.titulo}</p>
              {hover.lineas.map((l) => (
                <p key={l} className="text-ink-600">
                  {l}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TablaSerie({
  datos,
  seleccionada,
  onSeleccionar,
}: {
  datos: Reproduccion2025;
  seleccionada: string;
  onSeleccionar: (fecha: string) => void;
}) {
  return (
    <div className="max-h-[320px] overflow-auto rounded-xl border border-paper-300">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-paper-100 text-ink-600">
          <tr>
            <th className="px-3 py-2 font-medium">Fecha de la imagen</th>
            <th className="px-3 py-2 text-right font-medium">Lotes con agua</th>
            <th className="px-3 py-2 text-right font-medium">Hectáreas</th>
            <th className="px-3 py-2 text-right font-medium">Lluvia 30 días previos</th>
            <th className="px-3 py-2 text-right font-medium">Cielo despejado</th>
          </tr>
        </thead>
        <tbody className="font-tabular">
          {datos.serie.map((s) => (
            <tr
              key={s.fecha}
              onClick={() => onSeleccionar(s.fecha)}
              className={`cursor-pointer border-t border-paper-200 hover:bg-paper-100 ${s.fecha === seleccionada ? "bg-brand-100" : ""}`}
            >
              <td className="px-3 py-1.5 text-ink-800">{fechaCorta(s.fecha)}</td>
              <td className="px-3 py-1.5 text-right text-ink-950">{s.anegadoPct.toLocaleString("es-AR")} %</td>
              <td className="px-3 py-1.5 text-right text-ink-700">{s.anegadoHa.toLocaleString("es-AR")}</td>
              <td className="px-3 py-1.5 text-right text-ink-700">
                {s.lluvia30DiasPreviosMm != null ? `${s.lluvia30DiasPreviosMm.toLocaleString("es-AR")} mm` : "—"}
              </td>
              <td className="px-3 py-1.5 text-right text-ink-700">{s.despejadoPct} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
