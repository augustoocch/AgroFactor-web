"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { revealVariants } from "@/lib/motion";
import { RiesgoChip } from "@/components/RiesgoChip";
import type { Lote } from "@/lib/types";

interface Props {
  establecimientoId: string;
  lotes: Lote[];
  scorePorLote: Record<string, number>;
}

/** Cada fila lleva al detalle del lote (mapa grande, zonas de cultivo, clima) — ver /lotes/[loteId]. */
export function ListaLotes({ establecimientoId, lotes, scorePorLote }: Props) {
  if (lotes.length === 0)
    return (
      <p className="rounded-xl border border-dashed border-paper-300 p-5 text-center text-sm text-ink-600">
        Todavia no hay lotes dibujados.
      </p>
    );

  return (
    <ul className="space-y-2">
      {lotes.map((lote, i) => {
        const hrefDetalle = `/establecimientos/${establecimientoId}/lotes/${lote.id}`;
        return (
          <motion.li
            key={lote.id}
            initial="hidden"
            animate="visible"
            custom={i}
            variants={revealVariants}
            className="rounded-xl border border-paper-300 bg-paper-50 transition-colors hover:border-brand-500"
          >
            <div className="flex items-center justify-between gap-3 p-3.5">
              <Link href={hrefDetalle} className="min-w-0 flex-1">
                <p className="font-medium text-ink-950">{lote.nombre}</p>
                <p className="text-xs text-ink-600">
                  {lote.tipoUso.toLowerCase()} · antecedentes: {lote.antecedentesAnegamientoUltimos10Anios ?? 0}/10 anios
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {scorePorLote[lote.id] !== undefined && <RiesgoChip score={scorePorLote[lote.id]} />}
                <Link
                  href={`${hrefDetalle}?dibujar=cultivo`}
                  className="rounded-full border border-paper-300 px-2.5 py-1 text-xs font-medium text-brand-700 hover:border-brand-500 hover:bg-brand-100"
                  title="Dibujar una zona de cultivo dentro de este lote"
                >
                  + Cultivo
                </Link>
                <Link href={hrefDetalle} className="text-xs text-ink-600 hover:text-brand-700">
                  Ver detalle →
                </Link>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
