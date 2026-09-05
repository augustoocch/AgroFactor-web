"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api";

/**
 * "No existe" y "esta cargando" son estados distintos y hasta ahora se confundian: el unico
 * gate era `data`, asi que un 404 dejaba el "Cargando..." puesto para siempre. Este componente
 * es el estado terminal explicito. Toma el lenguaje visual de [id]/error.tsx, que ya existia
 * con la forma correcta pero era inalcanzable (React Query no lanza durante el render, guarda
 * el error en el estado de la query).
 */
export function EstadoNoEncontrado({ error, onReintentar }: { error: unknown; onReintentar?: () => void }) {
  const status = error instanceof ApiError ? error.status : null;

  // El 403 no es un error del usuario y merece otro texto: el ID esta bien, el acceso no.
  const { titulo, detalle } =
    status === 404
      ? {
          titulo: "No encontramos ese establecimiento",
          detalle:
            "Revisa que el ID este completo y sin espacios. Es el identificador que el productor copia desde su establecimiento.",
        }
      : status === 403
        ? {
            titulo: "No tenes acceso a este establecimiento",
            detalle: "El ID existe, pero tu usuario no puede verlo. Pediselo a quien lo administra.",
          }
        : {
            titulo: "No se pudo cargar el establecimiento",
            detalle:
              error instanceof Error && error.message
                ? error.message
                : "Puede ser una interrupcion momentanea de la conexion.",
          };

  // Un 4xx no se arregla reintentando; solo ofrecemos reintentar cuando puede servir de algo.
  const puedeReintentar = onReintentar && (status === null || status >= 500);

  return (
    <div className="rounded-2xl border border-risk-alto bg-risk-alto-bg p-8 text-center">
      <p className="font-display text-lg font-medium text-risk-alto">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-700">{detalle}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          href="/establecimientos"
          className="rounded-full border border-paper-300 bg-paper-50 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          ← Todos los establecimientos
        </Link>
        {puedeReintentar && (
          <button
            onClick={onReintentar}
            className="rounded-full bg-risk-alto px-4 py-2 text-sm font-medium text-paper-50"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
