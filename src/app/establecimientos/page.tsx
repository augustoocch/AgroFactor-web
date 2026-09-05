"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { revealVariants } from "@/lib/motion";
import type { Establecimiento } from "@/lib/types";

const ETIQUETA_PERFIL: Record<string, string> = {
  AGRICOLA: "Agricola",
  GANADERO: "Ganadero",
  TAMBO: "Tambo",
  MIXTO: "Mixto",
};

/** Los ID son UUID generados por el backend (@GeneratedValue UUID). */
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EstablecimientosPage() {
  const { sesion } = useAuth();
  const router = useRouter();
  const [idBusqueda, setIdBusqueda] = useState("");
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Un ID pegado a medias o con espacios es el error mas probable, y se detecta aca sin
  // gastar un viaje al servidor que igual iba a volver 404.
  function buscar() {
    const limpio = idBusqueda.trim();
    if (!limpio) {
      setErrorBusqueda("Pega el ID que te compartio el productor.");
      return;
    }
    if (!FORMATO_UUID.test(limpio)) {
      setErrorBusqueda("Ese no es un ID valido. Tiene 36 caracteres con guiones, como 3f2a9c10-4b7e-4d81-9a3c-6e5f0b1d2c34.");
      return;
    }
    setErrorBusqueda(null);
    router.push(`/establecimientos/${limpio}`);
  }

  const { data: establecimientos, isLoading } = useQuery({
    queryKey: ["establecimientos"],
    queryFn: () => api.get<Establecimiento[]>("/establecimientos"),
  });

  const esRolDeCartera = sesion?.rol === "ASESOR" || sesion?.rol === "ADMINISTRADOR";

  return (
    <div className="space-y-10">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={revealVariants}
        className="flex flex-wrap items-end justify-between gap-4 border-b border-paper-300 pb-6"
      >
        <div>
          <p className="text-sm uppercase tracking-wide text-brand-600">
            {sesion?.rol === "PRODUCTOR" ? "Tu campo" : "Cartera"}
          </p>
          <h1 className="font-display text-2xl font-medium text-ink-950">
            {sesion?.rol === "PRODUCTOR" ? "Mi establecimiento" : "Mis establecimientos"}
          </h1>
        </div>
        <Link
          href="/establecimientos/nuevo"
          className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600"
        >
          + Nuevo establecimiento
        </Link>
      </motion.div>

      {esRolDeCartera && (
        <motion.div
          initial="hidden"
          animate="visible"
          custom={1}
          variants={revealVariants}
          className="rounded-2xl border border-brand-200 bg-brand-100/40 p-5"
        >
          <p className="text-sm text-ink-800">
            Como <strong>{sesion?.rol === "ASESOR" ? "asesor" : "administrador"}</strong> podes acceder a
            cualquier establecimiento por su ID — por ejemplo, el que te comparta el productor.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={idBusqueda}
              onChange={(e) => {
                setIdBusqueda(e.target.value);
                if (errorBusqueda) setErrorBusqueda(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="ID del establecimiento"
              aria-invalid={errorBusqueda ? true : undefined}
              className={`flex-1 rounded-lg border bg-paper-50 px-3 py-2 font-mono text-sm text-ink-950 outline-none focus:border-brand-500 ${
                errorBusqueda ? "border-risk-alto" : "border-paper-300"
              }`}
            />
            <button
              onClick={buscar}
              className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
            >
              Acceder
            </button>
          </div>
          {errorBusqueda && <p className="mt-2 text-xs text-risk-alto">{errorBusqueda}</p>}
        </motion.div>
      )}

      {isLoading && <p className="text-sm text-ink-600">Cargando...</p>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {establecimientos?.map((e, i) => (
          <motion.li key={e.id} initial="hidden" animate="visible" custom={i + 2} variants={revealVariants}>
            <Link
              href={`/establecimientos/${e.id}`}
              className="group block rounded-2xl border border-paper-300 bg-paper-50 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-[0_8px_24px_-12px_var(--color-brand-500)]"
            >
              <div className="flex items-start justify-between">
                <p className="font-display text-lg font-medium text-ink-950">{e.nombre}</p>
                <span className="rounded-full bg-clay-100 px-2.5 py-0.5 text-xs font-medium text-clay-600">
                  {ETIQUETA_PERFIL[e.perfilProductivo]}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-600">
                {e.partido}, {e.provincia} · tenencia {e.tipoTenencia.toLowerCase()}
              </p>
              <p className="mt-4 text-sm font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                Ver plan de accion →
              </p>
            </Link>
          </motion.li>
        ))}
      </ul>

      {establecimientos?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-paper-300 p-8 text-center text-sm text-ink-600">
          Todavia no cargaste ningun establecimiento.
        </p>
      )}
    </div>
  );
}
