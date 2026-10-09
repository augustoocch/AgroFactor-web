"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { easeOutExpo } from "@/lib/motion";

/**
 * Panel del lado de autenticacion. Muestra el producto antes de entrar, con la misma jerarquia que
 * tiene el producto: primero el ANEGAMIENTO (que se anega, cuanto y por cuanto tiempo), despues el
 * RIESGO ECONOMICO, y recien al final QUE PROTEGER. Por eso el tratamiento baja en cada nivel: un
 * mapa del lote, una cifra, y una lista de texto sin tarjetas.
 *
 * Los valores son ilustrativos y lo dice en pantalla. Las acciones salen de la Encuesta B: la
 * hacienda se mueve a las lomas (asesor 12), las reservas se trasladan porque son movibles, y el
 * camino de acceso no se "refuerza": su prioridad es la ventana para sacar lo demas antes del corte.
 */
const COMPOSICION = [
  { etiqueta: "Hacienda", pct: 58, color: "var(--color-clay-400)" },
  { etiqueta: "Cultivos", pct: 31, color: "var(--color-brand-200)" },
  { etiqueta: "Instalaciones", pct: 11, color: "var(--color-paper-300)" },
];

const PROTEGER = [
  { que: "Rodeo del potrero norte", como: "mover a las lomas" },
  { que: "Reservas forrajeras", como: "trasladar a sector alto" },
  { que: "Camino de acceso", como: "sacar todo antes del corte" },
];

export function AuthShowcase() {
  const sinMovimiento = useReducedMotion();
  const entrada = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: easeOutExpo },
  });

  return (
    <div className="relative hidden overflow-hidden bg-brand-950 px-12 py-12 text-paper-50 lg:flex lg:flex-col lg:justify-between">
      <motion.div {...entrada(0)} className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-paper-50">
          <BrandMark className="h-7 w-7" />
        </span>
        <span className="font-display text-xl font-medium">AgroFactor</span>
      </motion.div>

      <div className="relative my-10 max-w-xl">
        <motion.h2 {...entrada(0.08)} className="font-display text-[2rem] font-medium leading-[1.1] text-paper-50">
          Qué se anega, cuánto cuesta y qué proteger primero.
        </motion.h2>

        {/* 1. Anegamiento: la pieza principal, y la unica con imagen. */}
        <motion.figure {...entrada(0.18)} className="mt-9">
          <MapaLote animar={!sinMovimiento} />
          <figcaption className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-brand-200">Lote 4 · bajo del arroyo</p>
              <p className="mt-1 font-display text-2xl leading-tight text-paper-50">38% del lote con agua en 36 horas</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl leading-tight text-paper-50">20 a 45 días</p>
              <p className="text-xs text-brand-200">hasta que baje el agua</p>
            </div>
          </figcaption>
        </motion.figure>

        {/* 2. Riesgo economico: una cifra y de que esta hecha. */}
        <motion.div {...entrada(0.3)} className="mt-8 border-t border-white/10 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-display text-xl tabular-nums text-paper-50">USD 184.000 en riesgo</p>
            <p className="text-xs text-brand-200">a precio de mercado del día</p>
          </div>
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10">
            {COMPOSICION.map((c, i) => (
              <motion.span
                key={c.etiqueta}
                style={{ backgroundColor: c.color }}
                initial={{ width: 0 }}
                animate={{ width: `${c.pct}%` }}
                transition={{ duration: sinMovimiento ? 0 : 0.8, delay: 0.5 + i * 0.1, ease: easeOutExpo }}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-paper-200/80">
            {COMPOSICION.map((c) => (
              <li key={c.etiqueta} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.etiqueta} {c.pct}%
              </li>
            ))}
          </ul>
        </motion.div>

        {/* 3. Que proteger: consecuencia de lo anterior, en texto y sin caja. */}
        <motion.div {...entrada(0.42)} className="mt-8 border-t border-white/10 pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-brand-200">Qué proteger primero</p>
          <ol className="mt-2.5 space-y-1.5">
            {PROTEGER.map((p, i) => (
              <li key={p.que} className="flex items-baseline gap-3 text-sm">
                <span className="w-3 font-mono text-xs text-clay-400">{i + 1}</span>
                <span className="text-paper-50">{p.que}</span>
                <span className="text-paper-200/60">{p.como}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      </div>

      <motion.p {...entrada(0.55)} className="relative text-xs text-paper-200/60">
        Cuenca del Salado · estimación a escala de lote · valores de ejemplo
      </motion.p>
    </div>
  );
}

/**
 * Un campo visto desde arriba: lotes, curvas de nivel y el agua juntandose en el bajo. El agua
 * sube una vez al entrar (no en loop): muestra la idea de "donde se junta primero" sin distraer
 * mientras el usuario escribe su contraseña.
 */
function MapaLote({ animar }: { animar: boolean }) {
  return (
    <svg viewBox="0 0 480 220" className="w-full" role="img" aria-label="Ejemplo de un lote con agua acumulada en su sector más bajo">
      <defs>
        <clipPath id="showcase-campo">
          <path d="M14 22 L466 10 L472 206 L8 214 Z" />
        </clipPath>
        <clipPath id="showcase-nivel">
          <motion.rect
            x="0"
            width="480"
            height="220"
            initial={{ y: animar ? 220 : 0 }}
            animate={{ y: 0 }}
            transition={{ duration: 1.6, delay: 0.6, ease: easeOutExpo }}
          />
        </clipPath>
      </defs>

      <g clipPath="url(#showcase-campo)">
        <rect width="480" height="220" fill="rgb(255 255 255 / 0.03)" />

        {/* Curvas de nivel: bajan hacia el sudoeste, donde esta el bajo. */}
        <g fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="1">
          <path d="M-10 40 C80 30 150 70 240 58 S400 20 490 44" />
          <path d="M-10 78 C70 70 140 108 230 96 S390 62 490 86" />
          <path d="M-10 116 C60 112 120 146 210 136 S370 108 490 128" />
          <path d="M-10 152 C50 150 100 178 180 172 S340 150 490 168" />
        </g>

        {/* Agua: dos bandas, la mas profunda en el centro del bajo. */}
        <g clipPath="url(#showcase-nivel)">
          <path
            d="M20 120 C70 104 130 118 176 140 C214 158 232 188 214 214 L8 214 Z"
            fill="var(--color-brand-500)"
            fillOpacity="0.55"
          />
          <path
            d="M20 158 C60 146 110 152 146 170 C170 182 178 200 170 214 L8 214 Z"
            fill="var(--color-brand-200)"
            fillOpacity="0.5"
          />
        </g>

        {/* Division en lotes */}
        <g stroke="rgb(255 255 255 / 0.28)" strokeWidth="1" strokeDasharray="3 4">
          <path d="M244 10 L236 214" />
          <path d="M10 118 L244 110" />
          <path d="M240 96 L472 90" />
        </g>
      </g>

      <path d="M14 22 L466 10 L472 206 L8 214 Z" fill="none" stroke="rgb(255 255 255 / 0.45)" strokeWidth="1.25" />

      {/* Marca del lote comprometido */}
      <g>
        <circle cx="110" cy="166" r="4" fill="var(--color-clay-400)" />
        <circle cx="110" cy="166" r="9" fill="none" stroke="var(--color-clay-400)" strokeOpacity="0.5" />
        <text x="124" y="162" fill="var(--color-paper-50)" fontSize="11" fontFamily="var(--font-sans)">
          Lote 4
        </text>
      </g>
      <text x="300" y="56" fill="rgb(255 255 255 / 0.4)" fontSize="10" fontFamily="var(--font-sans)">
        Lote 2 · loma
      </text>
    </svg>
  );
}
