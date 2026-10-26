"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmarAccion } from "@/components/ConfirmarAccion";
import { IdCopiable } from "@/components/IdCopiable";
import { api, clasificarError } from "@/lib/api";
import { boton } from "@/lib/estilos";
import { fechaCorta, puede } from "@/lib/permisos";
import { useToast } from "@/lib/toast-context";
import type { Acceso, AccesosEstablecimiento, EstadoAcceso, InvitacionCreada, MiAcceso, RolAcceso } from "@/lib/types";

const ETIQUETA_ESTADO: Record<EstadoAcceso, string> = {
  PENDIENTE: "Invitación pendiente",
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido mientras el campo está cedido",
  RECHAZADO: "Rechazó la invitación",
  REVOCADO: "Revocado",
  FINALIZADO: "Finalizado",
  VENCIDA: "Invitación vencida",
};

const VIGENTES: EstadoAcceso[] = ["PENDIENTE", "ACTIVO", "SUSPENDIDO"];

/**
 * Quien mas ve el establecimiento, y la puerta para sumar gente. Reemplaza al "codigo del
 * establecimiento" que el productor copiaba: ese id abria el campo a cualquier asesor o
 * administrador del sistema, para siempre y sin forma de revocarlo.
 *
 * - Asesor: lo invita el titular (propietario, o el administrador mientras dure el arriendo).
 * - Ceder a un administrador: solo el propietario. Al aceptar, el propietario y sus asesores
 *   dejan de ver el campo hasta que la cesion termine.
 */
export function PanelAccesos({ establecimientoId, miAcceso }: { establecimientoId: string; miAcceso: MiAcceso }) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [linkCreado, setLinkCreado] = useState<InvitacionCreada | null>(null);
  const [aRevocar, setARevocar] = useState<Acceso | null>(null);

  const { data } = useQuery({
    queryKey: ["accesos", establecimientoId],
    queryFn: () => api.get<AccesosEstablecimiento>(`/establecimientos/${establecimientoId}/accesos`),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["accesos", establecimientoId] });
  const alFallar = (e: unknown) => {
    const { tipo, mensaje } = clasificarError(e);
    notificar(tipo, mensaje);
  };
  const alCrear = (creada: InvitacionCreada) => {
    setLinkCreado(creada);
    refrescar();
    notificar("exito", creada.emailEnviado ? `Invitación enviada a ${creada.acceso.email}` : "Invitación creada: el email no salió, compartí el link");
  };

  const reenviar = useMutation({
    mutationFn: (accesoId: string) => api.post<InvitacionCreada>(`/accesos/${accesoId}/reenviar`),
    onSuccess: alCrear,
    onError: alFallar,
  });
  const revocar = useMutation({
    mutationFn: (accesoId: string) => api.delete(`/accesos/${accesoId}`),
    onSuccess: () => {
      setARevocar(null);
      refrescar();
      queryClient.invalidateQueries({ queryKey: ["establecimientos"] });
      notificar("exito", "Acceso revocado");
    },
    onError: alFallar,
  });

  const accesos = data?.accesos ?? [];
  const vigentes = accesos.filter((a) => VIGENTES.includes(a.estado));
  const historicos = accesos.filter((a) => !VIGENTES.includes(a.estado));
  const cesionEnJuego = vigentes.some((a) => a.rol === "ADMINISTRADOR");

  return (
    <div className="space-y-6">
      {data && (
        <ul className="divide-y divide-paper-300 rounded-xl border border-paper-300 bg-paper-50">
          <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="text-ink-950">{data.propietario}</span>
            <span className="text-xs text-ink-600">Propietario</span>
          </li>
          {vigentes.map((a) => (
            <FilaAcceso
              key={a.id}
              acceso={a}
              onReenviar={a.estado === "PENDIENTE" ? () => reenviar.mutate(a.id) : undefined}
              onRevocar={() => setARevocar(a)}
            />
          ))}
        </ul>
      )}

      {linkCreado && (
        <div className="space-y-2 rounded-lg bg-brand-100/50 p-4 text-sm text-ink-800">
          <p>
            {linkCreado.emailEnviado
              ? `Le mandamos el link a ${linkCreado.acceso.email}. Si no le llega, compartíselo por WhatsApp:`
              : `No pudimos mandar el email a ${linkCreado.acceso.email}. Compartile este link:`}
          </p>
          <IdCopiable valor={linkCreado.link} textoBoton="Copiar link" descripcion="Copiar el link de la invitación" />
          <p className="text-xs text-ink-600">Vence en 7 días. Solo sirve con una cuenta de ese email.</p>
        </div>
      )}

      {puede(miAcceso, "gestionarAsesores") && (
        <FormularioInvitacion
          establecimientoId={establecimientoId}
          rol="ASESOR"
          titulo="Invitar a un asesor técnico"
          ayuda="Ingeniero agrónomo o analista: ve y carga lo mismo que vos, pero no gestiona accesos ni borra el establecimiento."
          onCreada={alCrear}
          onError={alFallar}
        />
      )}

      {puede(miAcceso, "ceder") && !cesionEnJuego && (
        <FormularioInvitacion
          establecimientoId={establecimientoId}
          rol="ADMINISTRADOR"
          titulo="Ceder por arriendo"
          ayuda="Quien arrienda pasa a ser el titular: decide, carga y suma a sus asesores. Mientras dure, vos y tus asesores dejan de ver el campo (solo podés terminar la cesión). Si arrendás solo una parte, cargala como otro establecimiento."
          onCreada={alCrear}
          onError={alFallar}
        />
      )}

      {historicos.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-600">Accesos anteriores ({historicos.length})</summary>
          <ul className="mt-2 space-y-1 text-ink-600">
            {historicos.map((a) => (
              <li key={a.id}>
                {a.nombre ?? a.email} · {a.rol === "ADMINISTRADOR" ? "cesión" : "asesor"} · {ETIQUETA_ESTADO[a.estado].toLowerCase()}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmarAccion
        abierto={aRevocar !== null}
        titulo={aRevocar?.rol === "ADMINISTRADOR" && aRevocar.estado === "ACTIVO" ? "Terminar la cesión" : "Revocar acceso"}
        detalle={
          aRevocar?.rol === "ADMINISTRADOR" && aRevocar.estado === "ACTIVO"
            ? `${aRevocar.nombre ?? aRevocar.email} y sus asesores pierden el acceso, y el campo vuelve al propietario.`
            : `${aRevocar?.nombre ?? aRevocar?.email ?? ""} deja de ver el establecimiento. Podés volver a invitarlo cuando quieras.`
        }
        textoConfirmar="Confirmar"
        enCurso={revocar.isPending}
        onConfirmar={() => aRevocar && revocar.mutate(aRevocar.id)}
        onCerrar={() => setARevocar(null)}
      />
    </div>
  );
}

function FilaAcceso({ acceso: a, onReenviar, onRevocar }: { acceso: Acceso; onReenviar?: () => void; onRevocar: () => void }) {
  const esCesion = a.rol === "ADMINISTRADOR";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate text-ink-950">{a.nombre ? `${a.nombre} · ${a.email}` : a.email}</p>
        <p className="text-xs text-ink-600">
          {esCesion ? "Administrador (arriendo)" : "Asesor técnico"} · {ETIQUETA_ESTADO[a.estado]}
          {esCesion && a.fechaFinCesion && ` · hasta el ${fechaCorta(a.fechaFinCesion)}`}
        </p>
      </div>
      <div className="flex gap-2">
        {onReenviar && (
          <button onClick={onReenviar} className={boton.sutil}>
            Reenviar
          </button>
        )}
        <button onClick={onRevocar} className={boton.peligro}>
          {esCesion && a.estado === "ACTIVO" ? "Terminar cesión" : "Revocar"}
        </button>
      </div>
    </li>
  );
}

function FormularioInvitacion({
  establecimientoId,
  rol,
  titulo,
  ayuda,
  onCreada,
  onError,
}: {
  establecimientoId: string;
  rol: RolAcceso;
  titulo: string;
  ayuda: string;
  onCreada: (creada: InvitacionCreada) => void;
  onError: (e: unknown) => void;
}) {
  const [email, setEmail] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const invitar = useMutation({
    mutationFn: () =>
      api.post<InvitacionCreada>(`/establecimientos/${establecimientoId}/accesos`, {
        email: email.trim(),
        rol,
        fechaFinCesion: rol === "ADMINISTRADOR" && fechaFin ? fechaFin : null,
      }),
    onSuccess: (creada) => {
      setEmail("");
      setFechaFin("");
      onCreada(creada);
    },
    onError,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        invitar.mutate();
      }}
      className="space-y-3 rounded-xl border border-paper-300 p-4"
    >
      <div>
        <p className="text-sm font-medium text-ink-950">{titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{ayuda}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          aria-label={`Email para ${titulo.toLowerCase()}`}
          className="min-w-0 flex-1 rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        {rol === "ADMINISTRADOR" && (
          <label className="flex items-center gap-2 text-xs text-ink-600">
            Hasta
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none focus:border-brand-500"
            />
          </label>
        )}
        <button type="submit" disabled={invitar.isPending} className={boton.secundario}>
          {rol === "ADMINISTRADOR" ? "Ceder" : "Invitar"}
        </button>
      </div>
      {rol === "ADMINISTRADOR" && (
        <p className="text-xs text-ink-600">Sin fecha, la cesión dura hasta que alguno de los dos la termine.</p>
      )}
    </form>
  );
}
