"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { api, clasificarError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { boton } from "@/lib/estilos";
import { revealVariants } from "@/lib/motion";
import { fechaCorta } from "@/lib/permisos";
import { useToast } from "@/lib/toast-context";
import type { Establecimiento, MiAcceso } from "@/lib/types";

const ETIQUETA_PERFIL: Record<string, string> = {
  AGRICOLA: "Agricola",
  GANADERO: "Ganadero",
  TAMBO: "Tambo",
  MIXTO: "Mixto",
};

/**
 * La cartera agrupada por la relacion con cada campo, no por el perfil del usuario: una misma
 * persona puede ser dueña de uno, administrar otro que arrienda y asesorar un tercero.
 */
const GRUPOS: { acceso: MiAcceso; titulo: string; descripcion: string }[] = [
  { acceso: "PROPIETARIO", titulo: "Propios", descripcion: "Los cargaste vos. Decidís quién más los ve." },
  { acceso: "ADMINISTRADOR", titulo: "En arriendo", descripcion: "Su propietario te cedió la gestión mientras dure el arriendo." },
  { acceso: "ASESOR", titulo: "Asesorados", descripcion: "Su titular te invitó como asesor técnico." },
];

export default function EstablecimientosPage() {
  const { sesion } = useAuth();

  const { data: establecimientos, isLoading } = useQuery({
    queryKey: ["establecimientos"],
    queryFn: () => api.get<Establecimiento[]>("/establecimientos"),
  });

  const cedidos = establecimientos?.filter((e) => e.miAcceso === "PROPIETARIO_CEDIDO") ?? [];
  const vacio = establecimientos?.length === 0;
  const esProductor = sesion?.perfil === "PRODUCTOR";
  let orden = 1;

  return (
    <div className="space-y-10">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={revealVariants}
        className="flex flex-wrap items-end justify-between gap-4 border-b border-paper-300 pb-6"
      >
        <div>
          <p className="text-sm uppercase tracking-wide text-brand-600">{esProductor ? "Tu campo" : "Cartera"}</p>
          <h1 className="font-display text-2xl font-medium text-ink-950">Mis establecimientos</h1>
        </div>
        <Link
          href="/establecimientos/nuevo"
          className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600"
        >
          Nuevo establecimiento
        </Link>
      </motion.div>

      {isLoading && <p className="text-sm text-ink-600">Cargando...</p>}

      {vacio && <PrimerPaso perfil={sesion?.perfil} />}

      {GRUPOS.map(({ acceso, titulo, descripcion }) => {
        const delGrupo = establecimientos?.filter((e) => e.miAcceso === acceso) ?? [];
        if (delGrupo.length === 0) return null;
        return (
          <section key={acceso} className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-medium text-ink-950">{titulo}</h2>
              <p className="text-sm text-ink-600">{descripcion}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {delGrupo.map((e) => (
                <motion.li key={e.id} initial="hidden" animate="visible" custom={orden++} variants={revealVariants}>
                  <TarjetaEstablecimiento establecimiento={e} />
                </motion.li>
              ))}
            </ul>
          </section>
        );
      })}

      {cedidos.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-medium text-ink-950">Cedidos</h2>
            <p className="text-sm text-ink-600">
              Los arrendaste y cediste su gestión: mientras dure, los datos son de quien lo trabaja y no los ves.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {cedidos.map((e) => (
              <li key={e.id}>
                <TarjetaCedida establecimiento={e} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TarjetaEstablecimiento({ establecimiento: e }: { establecimiento: Establecimiento }) {
  return (
    <Link
      href={`/establecimientos/${e.id}`}
      className="group block rounded-xl border border-paper-300 bg-paper-50 p-5 transition-colors hover:border-brand-500"
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
      {e.miAcceso === "ADMINISTRADOR" && e.cesion?.hasta && (
        <p className="mt-1 text-xs text-ink-600">Cesión hasta el {fechaCorta(e.cesion.hasta)}</p>
      )}
      <p className="mt-4 text-sm font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Abrir el panorama
      </p>
    </Link>
  );
}

/** El propietario de un campo cedido solo ve a quien y hasta cuando, y puede darlo por terminado. */
function TarjetaCedida({ establecimiento: e }: { establecimiento: Establecimiento }) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const finalizar = useMutation({
    mutationFn: () => api.post(`/establecimientos/${e.id}/cesion/finalizar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["establecimientos"] });
      notificar("exito", `Recuperaste la gestión de ${e.nombre}`);
    },
    onError: (err) => {
      const { tipo, mensaje } = clasificarError(err);
      notificar(tipo, mensaje);
    },
  });

  return (
    <div className="rounded-xl border border-dashed border-paper-300 bg-paper-50/60 p-5">
      <p className="font-display text-lg font-medium text-ink-800">{e.nombre}</p>
      <p className="mt-1.5 text-sm text-ink-600">
        {e.partido}, {e.provincia}
      </p>
      {e.cesion && (
        <p className="mt-3 text-sm text-ink-800">
          Cedido a <strong>{e.cesion.administradorNombre}</strong> ({e.cesion.administradorEmail})
          {e.cesion.hasta ? ` hasta el ${fechaCorta(e.cesion.hasta)}` : ", sin fecha de fin"}.
        </p>
      )}
      <button onClick={() => setConfirmando(true)} className={`${boton.sutil} mt-4`}>
        Terminar la cesión
      </button>
      <ConfirmarAccion
        abierto={confirmando}
        titulo={`Terminar la cesión de "${e.nombre}"`}
        detalle={`${e.cesion?.administradorNombre ?? "El administrador"} y sus asesores pierden el acceso, y tus asesores lo recuperan. Lo que cargó durante el arriendo queda en el establecimiento.`}
        textoConfirmar="Terminar la cesión"
        enCurso={finalizar.isPending}
        onConfirmar={() => finalizar.mutate(undefined, { onSettled: () => setConfirmando(false) })}
        onCerrar={() => setConfirmando(false)}
      />
    </div>
  );
}

/** Primer paso segun el perfil: el productor carga su campo; asesor y administrador esperan una invitacion. */
function PrimerPaso({ perfil }: { perfil: string | undefined }) {
  if (perfil === "ASESOR" || perfil === "ADMINISTRADOR") {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-100/40 p-6 text-sm text-ink-800">
        <p className="font-medium text-ink-950">Todavía nadie te compartió un establecimiento.</p>
        <p className="mt-1 leading-relaxed">
          {perfil === "ASESOR"
            ? "Pedile al productor que te invite como asesor desde “Datos y acceso” de su establecimiento."
            : "Cuando el propietario te ceda la gestión del campo que arrendás, te va a llegar un email con el link para aceptar."}{" "}
          Si también tenés campo propio, podés cargarlo con “Nuevo establecimiento”.
        </p>
      </div>
    );
  }
  return (
    <p className="rounded-xl border border-dashed border-paper-300 p-8 text-center text-sm text-ink-600">
      Todavía no cargaste ningún establecimiento.
    </p>
  );
}
