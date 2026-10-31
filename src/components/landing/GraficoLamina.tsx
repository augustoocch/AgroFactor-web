"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { easeOutExpo } from "@/lib/motion";

/**
 * Lluvia diaria (barras) contra lamina de agua en el bajo (linea). Muestra lo que un pluviometro
 * no dice: el agua sigue subiendo dias despues de que paro de llover, y tarda semanas en bajar.
 * Serie de ejemplo, generada con la misma forma que devuelve el motor (pico desfasado, cola larga).
 */
const DIAS = 21;
const LLUVIA = [0, 4, 0, 12, 38, 61, 22, 3, 0, 0, 6, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0];

function serieLamina(): number[] {
  const out: number[] = [];
  let lamina = 0;
  for (let d = 0; d < DIAS; d++) {
    // Escorrentia que llega con un dia de retraso, menos infiltracion + evaporacion proporcional.
    const aporte = (LLUVIA[d - 1] ?? 0) * 1.9 + (LLUVIA[d] ?? 0) * 0.6;
    lamina = Math.max(0, lamina + aporte - lamina * 0.07 - 2);
    out.push(Math.round(lamina));
  }
  return out;
}

const LAMINA = serieLamina();

const W = 640;
const H = 260;
const M = { t: 18, r: 44, b: 30, l: 36 };
const UMBRAL_MM = 120;

export function GraficoLamina() {
  const ref = useRef<SVGSVGElement>(null);
  const enVista = useInView(ref, { once: true, amount: 0.4 });
  const sinMovimiento = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const lamina = LAMINA;

  const maxL = Math.max(...lamina, UMBRAL_MM) * 1.1;
  const maxP = 80;
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const x = (d: number) => M.l + (d + 0.5) * (iw / DIAS);
  const yL = (v: number) => M.t + ih - (v / maxL) * ih;
  const yP = (v: number) => M.t + (v / maxP) * ih * 0.55;

  const linea = lamina.map((v, d) => `${d === 0 ? "M" : "L"}${x(d).toFixed(1)},${yL(v).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(DIAS - 1)},${M.t + ih} L${x(0)},${M.t + ih} Z`;
  const diaPico = lamina.indexOf(Math.max(...lamina));
  const anim = enVista && !sinMovimiento;

  return (
    <figure className="w-full">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Lluvia diaria y lamina de agua en el bajo durante ${DIAS} dias. La lamina alcanza su pico el dia ${diaPico + 1}, dos dias despues de la lluvia maxima.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const d = Math.round((px - M.l) / (iw / DIAS) - 0.5);
          setHover(d >= 0 && d < DIAS ? d : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="lamina-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lluvia: barras colgando desde arriba, como cae */}
        {LLUVIA.map((p, d) => (
          <motion.rect
            key={d}
            x={x(d) - 6}
            y={M.t}
            width={12}
            rx={2}
            fill="var(--color-brand-500)"
            initial={{ height: 0 }}
            animate={{ height: enVista ? yP(p) - M.t : 0 }}
            transition={{ duration: sinMovimiento ? 0 : 0.5, delay: anim ? d * 0.025 : 0, ease: easeOutExpo }}
            opacity={hover === null || hover === d ? 0.55 : 0.25}
          />
        ))}

        {/* Umbral: desde aca el lote se considera anegado */}
        <line x1={M.l} x2={W - M.r} y1={yL(UMBRAL_MM)} y2={yL(UMBRAL_MM)} stroke="var(--color-clay-500)" strokeDasharray="4 4" />
        <text x={W - M.r + 6} y={yL(UMBRAL_MM) + 4} fontSize="11" fill="var(--color-clay-600)">
          umbral
        </text>

        <motion.path
          d={area}
          fill="url(#lamina-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: enVista ? 1 : 0 }}
          transition={{ duration: 0.8, delay: anim ? 0.9 : 0 }}
        />
        <motion.path
          d={linea}
          fill="none"
          stroke="var(--color-brand-700)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          initial={{ pathLength: sinMovimiento ? 1 : 0 }}
          animate={{ pathLength: enVista ? 1 : 0 }}
          transition={{ duration: sinMovimiento ? 0 : 1.8, delay: 0.3, ease: easeOutExpo }}
        />

        {/* Eje x: dias */}
        <line x1={M.l} x2={W - M.r} y1={M.t + ih} y2={M.t + ih} stroke="var(--color-paper-300)" />
        {[0, 5, 10, 15, 20].map((d) => (
          <text key={d} x={x(d)} y={H - 10} fontSize="11" textAnchor="middle" fill="var(--color-ink-500)">
            día {d + 1}
          </text>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke="var(--color-ink-400)" strokeWidth="1" />
            <circle cx={x(hover)} cy={yL(lamina[hover])} r="4.5" fill="var(--color-paper-50)" stroke="var(--color-brand-700)" strokeWidth="2" />
            <g transform={`translate(${Math.min(x(hover) + 10, W - 150)}, ${M.t + ih * 0.5})`}>
              <rect width="136" height="46" rx="6" fill="var(--color-ink-950)" />
              <text x="10" y="18" fontSize="11" fill="var(--color-brand-200)">
                Día {hover + 1} · lluvia {LLUVIA[hover]} mm
              </text>
              <text x="10" y="35" fontSize="12" fill="var(--color-paper-50)" fontWeight="500">
                Lámina {lamina[hover]} mm
              </text>
            </g>
          </g>
        )}
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-brand-500/55" /> Lluvia diaria
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand-700" /> Lámina en el bajo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-clay-500" /> Umbral de anegamiento
        </span>
        <span className="ml-auto text-ink-500">Serie de ejemplo</span>
      </figcaption>
    </figure>
  );
}
