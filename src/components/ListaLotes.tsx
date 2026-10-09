"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Icono } from "@/components/Icono";
import { RiesgoChip } from "@/components/RiesgoChip";
import { revealVariants } from "@/lib/motion";
import type { Lote } from "@/lib/types";

interface Props {
  establecimientoId: string;
  lotes: Lote[];
  scorePorLote: Record<string, number>;
}

const ETIQUETA_USO: Record<string, string> = {
  AGRICULTURA: "Agricultura",
  PASTURA: "Pastura",
  POTRERO: "Potrero",
  MONTE: "Monte",
  OTRO: "Otro uso",
};

/**
 * Cada fila abre el lote en su pestaña de riesgo. El atajo "Cargar cultivo" va directo al mapa
 * del lote con el dibujo ya iniciado: es la tarea mas frecuente despues de dibujar el lote.
 */
export function ListaLotes({ establecimientoId, lotes, scorePorLote }: Props) {
  if (lotes.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-paper-300 p-6 text-center text-sm text-ink-600">
        Todavía no hay lotes. Usá el botón de dibujo sobre el mapa para trazar el primero.
      </p>
    );

  return (
    <ul className="divide-y divide-paper-200 rounded-xl border border-paper-300 bg-paper-50">
      {lotes.map((lote, i) => {
        const hrefDetalle = `/establecimientos/${establecimientoId}/lotes/${lote.id}`;
        const antecedentes = lote.antecedentesAnegamientoUltimos10Anios ?? 0;
        return (
          <motion.li key={lote.id} initial="hidden" animate="visible" custom={i} variants={revealVariants}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <Link href={hrefDetalle} className="group min-w-0 flex-1">
                <p className="font-medium text-ink-950 group-hover:text-brand-700">{lote.nombre}</p>
                <p className="text-sm text-ink-600">
                  {ETIQUETA_USO[lote.tipoUso] ?? lote.tipoUso} ·{" "}
                  {antecedentes === 0 ? "sin anegamientos en 10 años" : `se anegó ${antecedentes} de los últimos 10 años`}
                </p>
              </Link>
              {scorePorLote[lote.id] !== undefined ? (
                <RiesgoChip score={scorePorLote[lote.id]} />
              ) : (
                <span className="text-xs text-ink-500">Sin evaluar</span>
              )}
              <Link
                href={`${hrefDetalle}/mapa?dibujar=cultivo`}
                className="text-sm text-brand-700 hover:underline hover:underline-offset-[3px]"
              >
                Cargar cultivo
              </Link>
              <Link href={hrefDetalle} aria-label={`Abrir ${lote.nombre}`} className="text-ink-400 hover:text-brand-700">
                <Icono nombre="derecha" className="h-4 w-4" />
              </Link>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
