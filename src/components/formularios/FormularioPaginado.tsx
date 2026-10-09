"use client";

import { Icono } from "@/components/Icono";
import Link from "next/link";
import { motion } from "framer-motion";
import { easeOutExpo } from "@/lib/motion";

export interface Paso {
  titulo: string;
  descripcion: string;
  /** Un paso obligatorio no deja guardar hasta estar completo. */
  obligatorio?: boolean;
  completo?: boolean;
  contenido: React.ReactNode;
}

/**
 * Armazon de formulario largo, paginado por pasos.
 *
 * Reemplaza a los modales: una ficha de peritaje tiene una docena larga de campos y en un modal
 * se sale de la pantalla, con el boton de guardar fuera de vista. Paginado, cada paso entra
 * entero y el usuario ve en todo momento cuanto falta.
 *
 * Guardar esta disponible en cuanto los pasos obligatorios estan completos, desde cualquier
 * pagina: el resto de la ficha es opcional a proposito y no puede quedar como un peaje.
 */
export function FormularioPaginado({
  titulo,
  subtitulo,
  volverA,
  pasos,
  pasoActivo,
  onPaso,
  onGuardar,
  guardando,
  etiquetaGuardar,
}: {
  titulo: string;
  subtitulo: string;
  volverA: string;
  pasos: Paso[];
  pasoActivo: number;
  onPaso: (indice: number) => void;
  onGuardar: () => void;
  guardando: boolean;
  etiquetaGuardar: string;
}) {
  const puedeGuardar = pasos.every((p) => !p.obligatorio || p.completo);
  const paso = pasos[pasoActivo];
  const esUltimo = pasoActivo === pasos.length - 1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link
          href={volverA}
          className="inline-flex items-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-brand-700"
        >
          <Icono nombre="izquierda" className="h-4 w-4" /> Volver al lote
        </Link>
        <h1 className="mt-2 font-display text-xl font-medium text-ink-950">{titulo}</h1>
        <p className="text-sm text-ink-600">{subtitulo}</p>
      </div>

      {/* Los pasos se pueden saltear: el orden es una sugerencia, no una barrera. */}
      <ol className="flex flex-wrap gap-1.5">
        {pasos.map((p, i) => {
          const activo = i === pasoActivo;
          const faltante = p.obligatorio && !p.completo;
          return (
            <li key={p.titulo}>
              <button
                type="button"
                onClick={() => onPaso(i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activo
                    ? "border-brand-500 bg-brand-100 text-brand-700"
                    : "border-paper-300 text-ink-600 hover:border-brand-500 hover:text-brand-700"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    faltante ? "bg-clay-500 text-paper-50" : p.completo ? "bg-risk-bajo text-paper-50" : "bg-paper-300 text-ink-700"
                  }`}
                >
                  {p.completo && !faltante ? <Icono nombre="check" className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {p.titulo}
              </button>
            </li>
          );
        })}
      </ol>

      <motion.div
        key={pasoActivo}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: easeOutExpo }}
        className="space-y-4 rounded-2xl border border-paper-300 bg-paper-50 p-5"
      >
        <div>
          <h2 className="font-display text-base font-medium text-ink-950">{paso.titulo}</h2>
          <p className="text-xs text-ink-600">{paso.descripcion}</p>
        </div>
        {paso.contenido}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={volverA} className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700">
          Cancelar
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPaso(pasoActivo - 1)}
            disabled={pasoActivo === 0}
            className="rounded-full border border-paper-300 px-4 py-2 text-sm text-ink-700 disabled:opacity-40"
          >
            Anterior
          </button>
          {!esUltimo && (
            <button
              type="button"
              onClick={() => onPaso(pasoActivo + 1)}
              className="rounded-full border border-brand-500 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              Siguiente
            </button>
          )}
          <button
            type="button"
            onClick={onGuardar}
            disabled={!puedeGuardar || guardando}
            title={puedeGuardar ? undefined : "Faltan datos obligatorios en el primer paso"}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : etiquetaGuardar}
          </button>
        </div>
      </div>
    </div>
  );
}
