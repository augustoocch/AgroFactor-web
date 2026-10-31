"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";

/**
 * "Como funciona", atado al scroll: un corte de perfil del campo queda fijo mientras el texto
 * avanza, y el scroll ES la lluvia. Primero caen gotas, despues el agua se junta en el bajo,
 * y al final aparecen los marcadores de que proteger. El usuario controla el ritmo.
 */
const PASOS = [
  {
    n: "01",
    titulo: "Leemos el campo y el cielo",
    texto:
      "Relieve, suelo INTA 1:50.000, humedad profunda ERA5 y el pronóstico de los próximos días, para cada lote y no para el partido.",
  },
  {
    n: "02",
    titulo: "Simulamos dónde se junta el agua",
    texto:
      "El agua escurre por la pendiente real y se acumula en los bajos. Sabés qué parte del lote se anega, con qué lámina y por cuántos días.",
  },
  {
    n: "03",
    titulo: "Priorizamos qué proteger",
    texto:
      "Hacienda, reservas, cultivos e instalaciones ordenados por valor en riesgo y por si se pueden mover a tiempo. Un plan, no un mapa para interpretar.",
  },
];

// Perfil del terreno: loma a la derecha, bajo a la izquierda.
const PERFIL = "M0 150 C60 196 120 214 190 206 C260 198 300 150 360 132 C420 114 470 92 520 84 L520 260 L0 260 Z";

export function Recorrido() {
  const ref = useRef<HTMLDivElement>(null);
  const sinMovimiento = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.6", "end end"] });
  const [paso, setPaso] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => setPaso(v < 0.33 ? 0 : v < 0.66 ? 1 : 2));

  const lluvia = useTransform(scrollYProgress, [0, 0.12, 0.45, 0.6], [0, 1, 1, 0]);
  const nivel = useTransform(scrollYProgress, [0.2, 0.62], [222, 168]);
  const marcadores = useTransform(scrollYProgress, [0.66, 0.8], [0, 1]);
  const nivelFijo = sinMovimiento ? 168 : nivel;

  return (
    <section ref={ref} id="como-funciona" className="relative bg-paper-100 lg:h-[300vh]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:sticky lg:top-0 lg:h-screen lg:grid-cols-12 lg:items-center lg:pb-0 lg:pt-16">
        <div className="lg:col-span-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-clay-600">Cómo funciona</p>
          <ol className="mt-6 space-y-6">
            {PASOS.map((p, i) => (
              <li key={p.n} className="relative pl-12">
                <span
                  className={`absolute left-0 top-0.5 font-mono text-sm transition-colors duration-500 ${
                    i === paso ? "text-clay-600" : "text-ink-300"
                  }`}
                >
                  {p.n}
                </span>
                <span
                  className={`absolute left-7 top-1 h-[calc(100%-4px)] w-px origin-top bg-clay-500 transition-transform duration-700 ease-[var(--ease-out-expo)] ${
                    i === paso ? "scale-y-100" : "scale-y-0"
                  }`}
                />
                <h3
                  className={`font-display text-lg leading-snug transition-colors duration-500 lg:text-xl ${
                    i === paso ? "text-ink-950" : "text-ink-400"
                  }`}
                >
                  {p.titulo}
                </h3>
                <p
                  className={`mt-1.5 max-w-md text-sm leading-relaxed transition-all duration-500 ${
                    i === paso ? "text-ink-700 opacity-100" : "text-ink-500 opacity-60 lg:opacity-40"
                  }`}
                >
                  {p.texto}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:col-span-7">
          <svg viewBox="0 0 520 260" className="w-full" role="img" aria-label="Corte de perfil de un campo: la lluvia cae, el agua se junta en el bajo y se marcan los activos a proteger">
            <defs>
              <clipPath id="recorrido-perfil">
                <path d={PERFIL} />
              </clipPath>
              <linearGradient id="recorrido-tierra" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7d7144" />
                <stop offset="100%" stopColor="#4a3524" />
              </linearGradient>
            </defs>

            {/* Lluvia */}
            <motion.g style={{ opacity: sinMovimiento ? 0 : lluvia }} stroke="var(--color-brand-500)" strokeWidth="1.5" strokeLinecap="round">
              {Array.from({ length: 38 }, (_, i) => {
                const x = (i * 53) % 520;
                const y = ((i * 31) % 90) + 6;
                return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 12} className="recorrido-gota" style={{ animationDelay: `${(i % 7) * 0.13}s` }} />;
              })}
            </motion.g>

            {/* Agua: un rectangulo cuyo borde superior es el nivel, recortado por el terreno invertido */}
            <mask id="recorrido-sobre-terreno">
              <rect width="520" height="260" fill="white" />
              <path d={PERFIL} fill="black" />
            </mask>
            <motion.rect
              x="0"
              width="520"
              height="260"
              y={nivelFijo}
              fill="var(--color-brand-500)"
              fillOpacity="0.75"
              mask="url(#recorrido-sobre-terreno)"
            />

            <path d={PERFIL} fill="url(#recorrido-tierra)" />
            <path d="M0 150 C60 196 120 214 190 206 C260 198 300 150 360 132 C420 114 470 92 520 84" fill="none" stroke="#3f5e35" strokeWidth="5" />

            {/* Horizontes de suelo */}
            <g clipPath="url(#recorrido-perfil)" stroke="rgb(255 255 255 / 0.12)" fill="none">
              <path d="M0 190 C80 232 160 244 230 236 S380 170 520 130" />
              <path d="M0 226 C90 252 170 258 240 254 S400 214 520 186" />
            </g>

            {/* Que proteger */}
            <motion.g style={{ opacity: sinMovimiento ? 1 : marcadores }}>
              <g transform="translate(108 186)">
                <circle r="6" fill="var(--color-risk-alto)" />
                <circle r="13" fill="none" stroke="var(--color-risk-alto)" strokeOpacity="0.5" />
                <line x1="0" y1="-14" x2="0" y2="-44" stroke="var(--color-ink-700)" strokeWidth="1" />
                <text x="6" y="-48" fontSize="12" fill="var(--color-ink-950)" fontWeight="500" stroke="var(--color-paper-100)" strokeWidth="4" paintOrder="stroke">
                  1 · Rodeo: mover a la loma
                </text>
              </g>
              <g transform="translate(300 152)">
                <circle r="5" fill="var(--color-risk-medio)" />
                <line x1="0" y1="-8" x2="0" y2="-38" stroke="var(--color-ink-700)" strokeWidth="1" />
                <text x="6" y="-42" fontSize="12" fill="var(--color-ink-950)" stroke="var(--color-paper-100)" strokeWidth="4" paintOrder="stroke">
                  2 · Rollos: trasladar
                </text>
              </g>
              <g transform="translate(470 90)">
                <circle r="5" fill="var(--color-risk-bajo)" />
                <text x="-8" y="-12" fontSize="12" textAnchor="end" fill="var(--color-ink-700)">
                  Zona segura
                </text>
              </g>
            </motion.g>
          </svg>
        </div>
      </div>
    </section>
  );
}
