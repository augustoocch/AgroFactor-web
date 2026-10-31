"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { GraficoLamina } from "@/components/landing/GraficoLamina";
import { Recorrido } from "@/components/landing/Recorrido";
import { lecturaNivel, nivelAgua, CICLO_S } from "@/components/landing/modelo-hero";
import { useAuth } from "@/lib/auth-context";
import { easeOutExpo } from "@/lib/motion";
import { boton } from "@/lib/estilos";

// three.js solo se descarga en el cliente y despues del primer paint: el hero se lee sin esperar la GPU.
const TerrenoHero = dynamic(() => import("@/components/landing/TerrenoHero"), { ssr: false });
const Barras3D = dynamic(() => import("@/components/landing/Barras3D"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-paper-200/60" />,
});

const COMPOSICION = [
  { etiqueta: "Hacienda", pct: 58, usd: 106_700, color: "var(--color-clay-500)" },
  { etiqueta: "Cultivos", pct: 31, usd: 57_000, color: "var(--color-brand-500)" },
  { etiqueta: "Instalaciones", pct: 11, usd: 20_300, color: "var(--color-ink-400)" },
];

const FUENTES = [
  { nombre: "Sentinel-2", que: "agua en superficie" },
  { nombre: "ERA5", que: "humedad 28–100 cm" },
  { nombre: "INTA 1:50.000", que: "suelos" },
  { nombre: "JRC Global Surface Water", que: "historia de anegamiento" },
  { nombre: "Open-Meteo", que: "pronóstico" },
  { nombre: "MAGyP", que: "márgenes regionales" },
];

export function Landing() {
  return (
    <div className="flex flex-1 flex-col bg-paper-100">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Recorrido />
        <SeccionLotes />
        <SeccionLamina />
        <SeccionEconomia />
        <SeccionFuentes />
        <CierreCta />
      </main>
      <Pie />
    </div>
  );
}

/* ---------------------------------------------------------------- nav */

function CtaSesion({ variante }: { variante: "claro" | "oscuro" }) {
  const { sesion, cargando } = useAuth();
  const clase =
    variante === "oscuro"
      ? "inline-flex items-center gap-1.5 rounded-full bg-clay-500 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-clay-400"
      : boton.primario;
  if (cargando) return <span className={`${clase} invisible`}>Entrar</span>;
  return sesion ? (
    <Link href="/establecimientos" className={clase}>
      Ir a mis campos <Flecha />
    </Link>
  ) : (
    <Link href="/register" className={clase}>
      Crear cuenta <Flecha />
    </Link>
  );
}

function Nav() {
  const [solido, setSolido] = useState(false);
  const { sesion } = useAuth();
  useEffect(() => {
    const f = () => setSolido(window.scrollY > window.innerHeight * 0.75);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,color] duration-500 ${
        solido ? "border-b border-paper-300 bg-paper-50/90 text-ink-950 backdrop-blur" : "border-b border-transparent text-paper-50"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6" aria-label="Principal">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-paper-50">
            <BrandMark className="h-6 w-6" />
          </span>
          <span className="font-display text-lg font-medium">AgroFactor</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <a href="#como-funciona" className="hidden opacity-80 transition-opacity hover:opacity-100 md:inline">
            Cómo funciona
          </a>
          <a href="#lotes" className="hidden opacity-80 transition-opacity hover:opacity-100 md:inline">
            Por lote
          </a>
          <a href="#economia" className="hidden opacity-80 transition-opacity hover:opacity-100 md:inline">
            Impacto
          </a>
          {!sesion && (
            <Link href="/login" className="opacity-80 transition-opacity hover:opacity-100">
              Entrar
            </Link>
          )}
          <CtaSesion variante={solido ? "claro" : "oscuro"} />
        </div>
      </nav>
    </header>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const sinMovimiento = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yTexto = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacidad = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const pctRef = useRef<HTMLSpanElement>(null);
  const laminaRef = useRef<HTMLSpanElement>(null);
  const barraRef = useRef<HTMLSpanElement>(null);
  const inicial = lecturaNivel(nivelAgua(CICLO_S * 0.3));

  // El HUD se escribe directo al DOM: el 3D avisa ~8 veces por segundo y no vale un re-render.
  const onNivel = useCallback((n: number) => {
    const l = lecturaNivel(n);
    if (pctRef.current) pctRef.current.textContent = `${l.pct}%`;
    if (laminaRef.current) laminaRef.current.textContent = `${l.laminaCm} cm`;
    if (barraRef.current) barraRef.current.style.transform = `scaleX(${Math.min(l.pct / 50, 1)})`;
  }, []);

  const entrada = (delay: number) => ({
    initial: { opacity: 0, y: sinMovimiento ? 0 : 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: easeOutExpo },
  });

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] overflow-hidden bg-brand-950 text-paper-50">
      <motion.div
        className="absolute inset-0 -z-10"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: easeOutExpo }}
      >
        <TerrenoHero onNivel={onNivel} />
      </motion.div>
      {/* Velo para que el texto lea sobre el terreno sin tapar el bajo, que esta a la derecha. */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--color-brand-950)_8%,transparent_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(0deg,var(--color-brand-950),transparent)]" />

      <motion.div
        style={sinMovimiento ? undefined : { y: yTexto, opacity: opacidad }}
        className="mx-auto grid min-h-[100svh] max-w-6xl grid-cols-12 items-end gap-6 px-6 pb-16 pt-28 lg:items-center lg:pb-24"
      >
        <div className="col-span-12 md:col-span-8 lg:col-span-7">
          <motion.p {...entrada(0.1)} className="text-[11px] font-medium uppercase tracking-[0.14em] text-clay-400">
            Riesgo de anegamiento · Cuenca del Salado
          </motion.p>
          <motion.h1
            {...entrada(0.2)}
            className="mt-5 font-display text-[clamp(2.5rem,1.6rem+4vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.02em]"
          >
            Sabé qué lote se anega <em className="font-normal italic text-brand-200">antes</em> de que llueva.
          </motion.h1>
          <motion.p {...entrada(0.35)} className="mt-6 max-w-lg text-base leading-relaxed text-paper-200/80">
            AgroFactor cruza relieve, suelo, humedad y pronóstico para cada lote de tu campo. Te dice dónde se junta el
            agua, cuánto está en juego y qué mover primero.
          </motion.p>
          <motion.div {...entrada(0.5)} className="mt-9 flex flex-wrap items-center gap-4">
            <CtaSesion variante="oscuro" />
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm text-paper-50 transition-colors hover:border-white/60"
            >
              Ver cómo funciona
            </a>
          </motion.div>
        </div>

        {/* HUD sincronizado con el agua del 3D */}
        <motion.aside
          {...entrada(0.8)}
          className="col-span-12 justify-self-start rounded-lg border border-white/15 bg-brand-950/70 p-4 backdrop-blur-sm sm:w-72 md:col-span-4 md:justify-self-end lg:col-span-4 lg:self-end"
          aria-label="Lectura del escenario de ejemplo"
        >
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-brand-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clay-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-clay-400" />
            </span>
            Escenario en vivo
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-paper-200/70">Campo con agua</dt>
              <dd className="font-display text-2xl tabular-nums">
                <span ref={pctRef}>{inicial.pct}%</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-paper-200/70">Lámina en el bajo</dt>
              <dd className="font-display text-2xl tabular-nums">
                <span ref={laminaRef}>{inicial.laminaCm} cm</span>
              </dd>
            </div>
          </dl>
          <span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/10">
            <span
              ref={barraRef}
              className="block h-full origin-left rounded-full bg-brand-500 transition-transform duration-150"
              style={{ transform: `scaleX(${inicial.pct / 50})` }}
            />
          </span>
          <p className="mt-2 text-[11px] text-paper-200/50">Terreno y valores de ejemplo</p>
        </motion.aside>
      </motion.div>
    </section>
  );
}

/* ---------------------------------------------------------------- lotes 3D */

function SeccionLotes() {
  return (
    <section id="lotes" className="border-t border-paper-300 bg-paper-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 lg:grid-cols-12 lg:py-32">
        <Revelar className="lg:col-span-4 lg:pt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-clay-600">A escala de lote</p>
          <h2 className="mt-4 font-display text-[length:var(--text-2xl)] font-medium leading-[1.1]">
            El partido no se inunda parejo. Tu campo tampoco.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink-700">
            Cada columna es un lote, ubicado donde está. La altura es el porcentaje que queda bajo agua en el escenario.
            Los del bajo se disparan; los de la loma casi no se mueven.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              ["var(--color-risk-alto)", "Alto", "40% o más con agua"],
              ["var(--color-risk-medio)", "Medio", "18 a 40%"],
              ["var(--color-risk-bajo)", "Bajo", "menos de 18%"],
            ].map(([c, n, d]) => (
              <li key={n} className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
                <span className="w-14 font-medium text-ink-900">{n}</span>
                <span className="text-ink-600">{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ink-500">Pasá el cursor por una columna para ver el lote. Arrastrá para girar.</p>
        </Revelar>
        <Revelar retraso={0.15} className="relative h-[380px] sm:h-[460px] lg:col-span-8 lg:-mr-10 lg:h-[540px]">
          <Barras3D />
        </Revelar>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- lamina */

function SeccionLamina() {
  return (
    <section className="bg-paper-100">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-12 lg:items-end">
        <Revelar className="lg:col-span-7 lg:order-2">
          <div className="rounded-xl border border-paper-300 bg-paper-50 p-5 sm:p-7">
            <GraficoLamina />
          </div>
        </Revelar>
        <Revelar retraso={0.1} className="lg:col-span-5 lg:order-1 lg:pb-10">
          <h2 className="font-display text-[length:var(--text-2xl)] font-medium leading-[1.12]">
            La lluvia fuerte fue el día&nbsp;6.
            <br />
            <span className="text-brand-700">El agua siguió subiendo.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-700">
            El pluviómetro mide lo que cae. Lo que importa es lo que llega al bajo desde todo el campo y cuánto tarda en
            irse. Por eso la simulación sigue al agua hora a hora, y te avisa con días de margen para sacar la hacienda.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-paper-300 pt-6">
            <Cifra valor={2} sufijo=" días" etiqueta="de desfase entre lluvia máxima y pico de agua" />
            <Cifra valor={15} sufijo=" días" etiqueta="sobre el umbral en este ejemplo" />
          </dl>
        </Revelar>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- economia */

function SeccionEconomia() {
  const ref = useRef<HTMLDivElement>(null);
  const enVista = useInView(ref, { once: true, amount: 0.5 });
  const sinMovimiento = useReducedMotion();

  return (
    <section id="economia" className="relative overflow-hidden bg-brand-950 text-paper-50">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12">
          <Revelar className="lg:col-span-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-clay-400">Impacto económico</p>
            <h2 className="mt-4 font-display text-[length:var(--text-3xl)] font-medium leading-[1.08]">
              Del mapa a una cifra que se puede defender.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-paper-200/75">
              Precios de mercado del día, márgenes MAGyP por región y criterio FAO de daño neto. Sale en el informe para la
              declaración de emergencia agropecuaria (Ley 26.509).
            </p>
          </Revelar>

          <div ref={ref} className="lg:col-span-6 lg:col-start-7">
            <p className="font-display text-[clamp(2.75rem,2rem+3.5vw,4.5rem)] font-medium leading-none tabular-nums">
              USD <Contador hasta={184_000} activo={enVista} />
            </p>
            <p className="mt-2 text-sm text-paper-200/70">en riesgo en el escenario de ejemplo</p>

            <div className="mt-8 flex h-3 gap-1 overflow-hidden rounded-full">
              {COMPOSICION.map((c, i) => (
                <motion.span
                  key={c.etiqueta}
                  className="h-full rounded-full"
                  style={{ backgroundColor: c.color }}
                  initial={{ flexGrow: 0.0001 }}
                  animate={{ flexGrow: enVista ? c.pct : 0.0001 }}
                  transition={{ duration: sinMovimiento ? 0 : 1.1, delay: 0.3 + i * 0.12, ease: easeOutExpo }}
                />
              ))}
            </div>
            <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
              {COMPOSICION.map((c, i) => (
                <motion.li
                  key={c.etiqueta}
                  className="flex items-baseline justify-between py-3 text-sm"
                  initial={{ opacity: 0, x: sinMovimiento ? 0 : -10 }}
                  animate={enVista ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.5 + i * 0.1, ease: easeOutExpo }}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.etiqueta}
                  </span>
                  <span className="font-mono tabular-nums text-paper-200/80">
                    USD {c.usd.toLocaleString("es-AR")} · {c.pct}%
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- fuentes */

function SeccionFuentes() {
  return (
    <section className="border-b border-paper-300 bg-paper-100">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-xs text-ink-500">Datos abiertos y validados contra los cortes CARBAP 2025</p>
        <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {FUENTES.map((f, i) => (
            <Revelar as="li" key={f.nombre} retraso={i * 0.05}>
              <p className="font-display text-base text-ink-900">{f.nombre}</p>
              <p className="text-xs text-ink-500">{f.que}</p>
            </Revelar>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- cierre */

function CierreCta() {
  const { sesion } = useAuth();
  return (
    <section className="relative overflow-hidden bg-paper-50">
      <OndasFondo />
      <div className="relative mx-auto max-w-6xl px-6 py-28 lg:py-36">
        <Revelar className="max-w-2xl">
          <h2 className="font-display text-[length:var(--text-3xl)] font-medium leading-[1.08]">
            Dibujá tu campo una vez. <span className="text-clay-600">Mirá el próximo temporal con tiempo.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink-700">
            Cargás los lotes desde el mapa o por coordenadas, sumás hacienda e instalaciones, y AgroFactor revisa el
            pronóstico por vos.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <CtaSesion variante="claro" />
            {!sesion && (
              <Link href="/login" className={boton.sutil}>
                Ya tengo cuenta
              </Link>
            )}
          </div>
        </Revelar>
      </div>
    </section>
  );
}

/** Curvas de nivel del isotipo, en grande, desplazandose despacio: la marca como paisaje. */
function OndasFondo() {
  const sinMovimiento = useReducedMotion();
  return (
    <svg
      className="pointer-events-none absolute -right-20 bottom-0 h-full w-[55%] min-w-[420px] opacity-40"
      viewBox="0 0 600 400"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <motion.path
          key={i}
          d={`M-40 ${120 + i * 32} c80 -40 140 -40 220 0 s140 40 220 0 s140 -40 240 -10`}
          fill="none"
          stroke={i > 5 ? "var(--color-clay-400)" : "var(--color-brand-200)"}
          strokeWidth="1.5"
          animate={sinMovimiento ? undefined : { x: [0, -30, 0] }}
          transition={{ duration: 12 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

function Pie() {
  return (
    <footer className="bg-ink-950 text-paper-200/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs">
        <span className="flex items-center gap-2">
          <BrandMark className="h-5 w-5" />
          <span className="font-display text-sm text-paper-50">AgroFactor</span>
        </span>
        <span>Trabajo Final Integrador · UADE · Cuenca del Salado, Buenos Aires</span>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- utilidades */

function Revelar({
  children,
  className,
  retraso = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  retraso?: number;
  as?: "div" | "li";
}) {
  const sinMovimiento = useReducedMotion();
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: sinMovimiento ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay: retraso, ease: easeOutExpo }}
    >
      {children}
    </Comp>
  );
}

function Contador({ hasta, activo }: { hasta: number; activo: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const sinMovimiento = useReducedMotion();
  useEffect(() => {
    if (!activo || !ref.current) return;
    if (sinMovimiento) {
      ref.current.textContent = hasta.toLocaleString("es-AR");
      return;
    }
    const c = animate(0, hasta, {
      duration: 1.6,
      ease: easeOutExpo,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString("es-AR");
      },
    });
    return () => c.stop();
  }, [activo, hasta, sinMovimiento]);
  return <span ref={ref}>0</span>;
}

function Cifra({ valor, sufijo, etiqueta }: { valor: number; sufijo: string; etiqueta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const enVista = useInView(ref, { once: true, amount: 0.6 });
  return (
    <div ref={ref} className="flex flex-col-reverse justify-end">
      <dt className="mt-1 text-xs leading-snug text-ink-600">{etiqueta}</dt>
      <dd className="font-display text-3xl tabular-nums text-ink-950">
        <Contador hasta={valor} activo={enVista} />
        {sufijo}
      </dd>
    </div>
  );
}

function Flecha() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
