"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { IdCopiable } from "@/components/IdCopiable";
import { PanelDatosFiscales } from "@/components/PanelDatosFiscales";
import { api, clasificarError } from "@/lib/api";
import { boton } from "@/lib/estilos";
import { useToast } from "@/lib/toast-context";
import type { Activo, Establecimiento, Lote } from "@/lib/types";

const ETIQUETA_TENENCIA: Record<string, string> = {
  PROPIO: "Propio",
  ARRENDADO: "Arrendado",
  MIXTO: "Mixto (propio y arrendado)",
};

const ETIQUETA_PERFIL: Record<string, string> = {
  AGRICOLA: "Agrícola",
  GANADERO: "Ganadero",
  TAMBO: "Tambo",
  MIXTO: "Mixto",
};

/**
 * Lo administrativo del establecimiento, junto y aparte de lo operativo. Antes estaba repartido
 * en tres lugares sin relacion: el ID en el encabezado de todas las pantallas (ruido para el
 * productor, que lo usa una vez), el CUIT/RENSPA arriba de "Reportes", y el boton de borrar al pie
 * del mapa del Resumen, a un click de un gesto destructivo en la pantalla mas visitada.
 */
export default function AjustesPage({ params }: PageProps<"/establecimientos/[id]/ajustes">) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const { data: establecimiento } = useQuery({
    queryKey: ["establecimiento", id],
    queryFn: () => api.get<Establecimiento>(`/establecimientos/${id}`),
  });
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", id],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${id}/lotes`),
  });
  const { data: activos = [] } = useQuery({
    queryKey: ["activos", id],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${id}/activos`),
  });

  const borrar = useMutation({
    mutationFn: () => api.delete(`/establecimientos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["establecimientos"] });
      notificar("exito", "Establecimiento eliminado");
      router.push("/establecimientos");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  if (!establecimiento) return null;

  return (
    <div>
      <EncabezadoPantalla
        segmento="ajustes"
        titulo="Datos y acceso"
        descripcion="Los datos que identifican al establecimiento y quién más puede verlo."
      />

      <div className="divide-y divide-paper-300">
        <Bloque titulo="El establecimiento">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Dato etiqueta="Nombre" valor={establecimiento.nombre} />
            <Dato etiqueta="Ubicación" valor={`${establecimiento.partido}, ${establecimiento.provincia}`} />
            <Dato etiqueta="Tenencia" valor={ETIQUETA_TENENCIA[establecimiento.tipoTenencia]} />
            <Dato etiqueta="Perfil productivo" valor={ETIQUETA_PERFIL[establecimiento.perfilProductivo]} />
          </dl>
        </Bloque>

        <Bloque
          titulo="Identificación fiscal"
          descripcion="Van en el encabezado del informe de emergencia agropecuaria. Sin estos datos, el informe no identifica al productor ni al predio."
        >
          <PanelDatosFiscales establecimientoId={id} />
        </Bloque>

        <Bloque
          titulo="Acceso de tu asesor"
          descripcion="Para que un asesor técnico o un administrador vea este establecimiento, compartile este código. Lo pega en su pantalla de establecimientos."
        >
          <IdCopiable valor={establecimiento.id} />
        </Bloque>

        <Bloque
          titulo="Borrar el establecimiento"
          descripcion="Se borran sus lotes, cultivos, activos, evaluaciones, planes e informes. No se puede deshacer."
        >
          <button onClick={() => setConfirmandoBorrado(true)} className={boton.peligro}>
            Borrar establecimiento
          </button>
        </Bloque>
      </div>

      <ConfirmarBorrado
        abierto={confirmandoBorrado}
        titulo={`Borrar "${establecimiento.nombre}"`}
        queSeBorra={`Se borran sus ${lotes.length} lote(s) con sus cultivos, ${activos.length} activo(s), las evaluaciones de riesgo, los planes de acción y los informes generados.`}
        confirmacionEscrita={establecimiento.nombre}
        borrando={borrar.isPending}
        onConfirmar={() => borrar.mutate()}
        onCerrar={() => setConfirmandoBorrado(false)}
      />
    </div>
  );
}

/** Bloque de ajustes: el titulo y su porque a la izquierda, el control a la derecha. */
function Bloque({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 py-8 first:pt-0 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-4">
        <h2 className="font-display text-lg font-medium text-ink-950">{titulo}</h2>
        {descripcion && <p className="mt-1 text-sm leading-relaxed text-ink-600">{descripcion}</p>}
      </div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-600">{etiqueta}</dt>
      <dd className="mt-0.5 text-ink-950">{valor}</dd>
    </div>
  );
}
