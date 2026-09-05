"use client";

import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { easeOutExpo } from "@/lib/motion";

/**
 * Ejemplos de accionables grounded en la Encuesta B: la hacienda se mueve a las lomas (asesor 12:
 * "resguardarlos en corrales, zonas mas altas del campo"), las reservas se trasladan porque son
 * fisicamente movibles, y el camino de acceso NO se "refuerza" contra la inundacion -su prioridad
 * es la ventana de tiempo para sacar otros activos antes de que quede intransitable (asi lo uso el
 * unico productor con respuesta completa: prioridad 1 fue accesos y caminos).
 */
const ACCIONES = [
  { rango: "01", texto: "Rodeo potrero norte", detalle: "impacto alto · mover a las lomas" },
  { rango: "02", texto: "Reservas forrajeras", detalle: "impacto medio · trasladar a sector alto" },
  { rango: "03", texto: "Camino de acceso", detalle: "impacto alto · sacar antes del corte" },
];

/** Panel visual del lado de autenticacion: no es decorativo generico, muestra el producto real (curvas de nivel + ranking de acciones) para que la marca se entienda antes de loguearse. */
export function AuthShowcase() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-950 px-12 py-14 text-paper-50 lg:flex lg:flex-col lg:justify-between">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 20% 30%, transparent 0, transparent 40px, var(--color-paper-50) 41px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOutExpo }}
        className="relative flex items-center gap-2.5"
      >
        <BrandMark className="h-8 w-8" />
        <span className="font-display text-xl font-medium">AgroRisk</span>
      </motion.div>

      <div className="relative space-y-8">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: easeOutExpo }}
          className="font-display text-3xl font-medium leading-[1.08] text-paper-50"
        >
          Qué se anega primero, qué proteger y con cuánto tiempo.
        </motion.p>

        <div className="space-y-2.5">
          {ACCIONES.map((a, i) => (
            <motion.div
              key={a.rango}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 + i * 0.08, ease: easeOutExpo }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
            >
              <span className="font-mono text-xs text-clay-400">{a.rango}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-paper-50">{a.texto}</p>
                <p className="text-xs text-paper-200/70">{a.detalle}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="relative text-xs text-paper-200/60"
      >
        Cuenca del Salado · estimación de riesgo a escala de lote
      </motion.p>
    </div>
  );
}
