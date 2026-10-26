"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { boton, tarjeta } from "@/lib/estilos";
import { fechaCorta } from "@/lib/permisos";
import type { EstadoAcceso, Invitacion } from "@/lib/types";

const YA_NO_VIGENTE: Partial<Record<EstadoAcceso, string>> = {
  ACTIVO: "Esta invitación ya fue aceptada.",
  RECHAZADO: "Esta invitación fue rechazada.",
  REVOCADO: "Quien te invitó la revocó.",
  FINALIZADO: "El acceso ya terminó.",
  VENCIDA: "La invitación venció. Pedile a quien te invitó que te la reenvíe.",
};

/**
 * Destino del link que llega por email. Se puede abrir sin cuenta: muestra que campo es y quien
 * invita, y manda a ingresar o registrarse volviendo aca. Aceptar exige estar logueado con el
 * mismo email invitado (el link prueba que se recibio el email; el registro no lo verifica).
 */
export default function InvitacionPage({ params }: PageProps<"/invitaciones/[token]">) {
  const { token } = use(params);
  const { sesion, cargando } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: invitacion, error, isLoading } = useQuery({
    queryKey: ["invitacion", token],
    queryFn: () => api.get<Invitacion>(`/invitaciones/${token}`),
    retry: false,
  });

  const aceptar = useMutation({
    mutationFn: () => api.post<{ establecimientoId: string }>(`/invitaciones/${token}/aceptar`),
    onSuccess: ({ establecimientoId }) => {
      queryClient.invalidateQueries({ queryKey: ["establecimientos"] });
      router.replace(`/establecimientos/${establecimientoId}`);
    },
  });
  const rechazar = useMutation({
    mutationFn: () => api.post(`/invitaciones/${token}/rechazar`),
    onSuccess: () => router.replace("/establecimientos"),
  });
  const errorAccion = aceptar.error ?? rechazar.error;

  const esCesion = invitacion?.rol === "ADMINISTRADOR";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-lg font-medium">AgroFactor</span>
        </div>

        {isLoading && <p className="text-sm text-ink-600">Cargando invitación…</p>}

        {error && (
          <div className={`${tarjeta} p-6`}>
            <p className="font-display text-lg font-medium text-ink-950">
              {error instanceof ApiError && error.status === 404 ? "Invitación inexistente" : "No se pudo cargar la invitación"}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              Revisá que el link esté completo. Si te reenviaron la invitación, solo sirve el último link.
            </p>
          </div>
        )}

        {invitacion && (
          <div className={`${tarjeta} space-y-5 p-6`}>
            <div>
              <p className="text-sm uppercase tracking-wide text-brand-600">
                {esCesion ? "Cesión por arriendo" : "Invitación como asesor técnico"}
              </p>
              <h1 className="mt-1 font-display text-2xl font-medium text-ink-950">{invitacion.establecimientoNombre}</h1>
              <p className="text-sm text-ink-600">{invitacion.partido}</p>
            </div>

            <p className="text-sm leading-relaxed text-ink-800">
              <strong>{invitacion.invitadoPor ?? "El titular"}</strong>{" "}
              {esCesion
                ? `te cede la gestión del establecimiento${invitacion.fechaFinCesion ? ` hasta el ${fechaCorta(invitacion.fechaFinCesion)}` : ""}. Mientras dure, vas a ser su único titular: el propietario no verá lo que cargues, y vas a poder sumar a tus propios asesores.`
                : "te suma como asesor: vas a ver lluvias, alertas, plan de acción y reportes del campo, y vas a poder cargar datos igual que el titular."}
            </p>
            <p className="text-xs text-ink-600">Enviada a {invitacion.emailInvitadoEnmascarado}.</p>

            {invitacion.estado !== "PENDIENTE" ? (
              <p className="rounded-lg bg-paper-100 px-3.5 py-2.5 text-sm text-ink-700">
                {YA_NO_VIGENTE[invitacion.estado] ?? "La invitación ya no está vigente."}
              </p>
            ) : cargando ? null : !sesion ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-700">Ingresá o creá tu cuenta con ese email para aceptar.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/login?invitacion=${token}`} className={boton.primario}>
                    Ingresar
                  </Link>
                  <Link href={`/register?invitacion=${token}`} className={boton.secundario}>
                    Crear cuenta
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-ink-600">Estás ingresado como {sesion.email}.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => aceptar.mutate()}
                    disabled={aceptar.isPending || rechazar.isPending}
                    className={boton.primario}
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => rechazar.mutate()}
                    disabled={aceptar.isPending || rechazar.isPending}
                    className={boton.sutil}
                  >
                    Rechazar
                  </button>
                </div>
                {errorAccion && (
                  <p className="text-sm text-risk-alto">
                    {errorAccion instanceof ApiError ? errorAccion.message : "No se pudo completar"}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
