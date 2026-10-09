"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { ListaActivos } from "@/components/ListaActivos";
import { ListaCultivos } from "@/components/ListaCultivos";
import { PanelZonasSuelo } from "@/components/PanelZonasSuelo";
import { api, clasificarError } from "@/lib/api";
import { boton } from "@/lib/estilos";
import { guardarGeometriaPendiente } from "@/lib/geometria-pendiente";
import { useReubicarActivo } from "@/lib/hooks";
import { rutaDe } from "@/lib/navegacion";
import { useToast } from "@/lib/toast-context";
import type { Activo, Coordenada, CultivoImplantado, Lote, ZonaSuelo } from "@/lib/types";

const MapaLote = dynamic(() => import("@/components/MapaLote").then((m) => m.MapaLote), {
  ssr: false,
  loading: () => <div className="h-[55vh] w-full animate-pulse rounded-xl bg-paper-200" />,
});

type Pestana = "cultivos" | "activos" | "suelo";

/**
 * Pestaña de carga del lote: el mapa del lote y, debajo, lo que tiene adentro. Las tres listas
 * (cultivos, activos, suelo) van en pestañas y no apiladas: se trabaja con una a la vez, y la que
 * corresponde se abre sola cuando se dibuja algo en el mapa.
 */
export default function LoteMapaPage({ params }: PageProps<"/establecimientos/[id]/lotes/[loteId]/mapa">) {
  const { id, loteId } = use(params);
  const autoDibujar = useSearchParams().get("dibujar") === "cultivo";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [pestana, setPestana] = useState<Pestana>("cultivos");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  // El sector de suelo se dibuja en el mapa y se completa en un modal sin cambiar de pantalla:
  // son cuatro numeros, y mandar al usuario a otra ruta le costaria el contexto del mapa.
  const [anilloSueloPendiente, setAnilloSueloPendiente] = useState<Coordenada[] | null>(null);
  const [dibujandoSuelo, setDibujandoSuelo] = useState(false);

  const base = `${rutaDe(id, "lotes")}/${loteId}`;

  const { data: lote } = useQuery({
    queryKey: ["lote", loteId],
    queryFn: () => api.get<Lote>(`/lotes/${loteId}`),
  });
  const { data: cultivos = [] } = useQuery({
    queryKey: ["cultivos", loteId],
    queryFn: () => api.get<CultivoImplantado[]>(`/lotes/${loteId}/cultivos`),
  });
  const { data: activos = [] } = useQuery({
    queryKey: ["activos", "lote", loteId],
    queryFn: () => api.get<Activo[]>(`/lotes/${loteId}/activos`),
  });
  // El panel de suelo pide la misma clave: react-query sirve una sola consulta para los dos.
  const { data: zonasSuelo = [] } = useQuery({
    queryKey: ["zonas-suelo", loteId],
    queryFn: () => api.get<ZonaSuelo[]>(`/lotes/${loteId}/zonas-suelo`),
  });

  const reubicarActivo = useReubicarActivo(id);

  const borrarLote = useMutation({
    mutationFn: () => api.delete(`/lotes/${loteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes", id] });
      notificar("exito", "Lote eliminado");
      router.push(rutaDe(id, "lotes"));
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  if (!lote) return <div className="h-[55vh] animate-pulse rounded-xl bg-paper-200" />;

  const pestanas: { clave: Pestana; etiqueta: string; cantidad: number }[] = [
    { clave: "cultivos", etiqueta: "Cultivos", cantidad: cultivos.length },
    { clave: "activos", etiqueta: "Activos", cantidad: activos.length },
    { clave: "suelo", etiqueta: "Suelo", cantidad: zonasSuelo.length },
  ];

  return (
    <div>
      <p className="mb-3 text-sm text-ink-600">
        Con los botones del mapa se dibuja una zona sembrada, se ubica un activo o se marca un sector de suelo. Los
        activos movibles se reubican arrastrándolos.
      </p>

      <MapaLote
        lote={lote}
        cultivos={cultivos}
        activos={activos}
        onZonaDibujada={(anillo) => {
          // La geometria viaja por sessionStorage y no por la URL: un anillo de veinte vertices
          // deja una direccion ilegible y se rompe al recargar.
          guardarGeometriaPendiente({ anillo });
          router.push(`${base}/cultivos/nuevo`);
        }}
        onActivoUbicado={(punto) => {
          guardarGeometriaPendiente({ punto });
          router.push(`${base}/activos/nuevo`);
        }}
        onEditarCultivo={(cultivo) => router.push(`${base}/cultivos/${cultivo.id}`)}
        onEditarActivo={(activo) => router.push(`${base}/activos/${activo.id}`)}
        onActivoMovido={(activo, coordenada) => reubicarActivo.mutate({ activo, coordenada })}
        autoDibujar={autoDibujar}
        zonasSuelo={zonasSuelo}
        autoDibujarSuelo={dibujandoSuelo}
        onZonaSueloDibujada={(anillo) => {
          setDibujandoSuelo(false);
          setAnilloSueloPendiente(anillo);
          setPestana("suelo");
        }}
        // El dibujo queda en pantalla y editable: el usuario corrige los vertices que se pasaron
        // en vez de volver a trazar todo desde cero.
        onRechazo={(motivo) => notificar("error-validacion", motivo)}
      />

      <section className="mt-10">
        <div role="tablist" aria-label="Contenido del lote" className="mb-5 inline-flex rounded-full border border-paper-300 bg-paper-50 p-1">
          {pestanas.map((p) => (
            <button
              key={p.clave}
              role="tab"
              aria-selected={pestana === p.clave}
              onClick={() => setPestana(p.clave)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                pestana === p.clave ? "bg-brand-700 text-paper-50" : "text-ink-700 hover:text-brand-700"
              }`}
            >
              {p.etiqueta}
              <span className={`ml-1.5 font-mono text-xs ${pestana === p.clave ? "text-brand-200" : "text-ink-500"}`}>
                {p.cantidad}
              </span>
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {pestana === "cultivos" && (
            <ListaCultivos loteId={loteId} cultivos={cultivos} onEditar={(c) => router.push(`${base}/cultivos/${c.id}`)} />
          )}
          {pestana === "activos" && (
            <ListaActivos loteId={loteId} activos={activos} onEditar={(a) => router.push(`${base}/activos/${a.id}`)} />
          )}
          {pestana === "suelo" && (
            <PanelZonasSuelo
              loteId={loteId}
              anilloPendiente={anilloSueloPendiente}
              onAnilloConsumido={() => setAnilloSueloPendiente(null)}
              onPedirDibujo={() => {
                setDibujandoSuelo(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </div>
      </section>

      <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-paper-300 pt-5">
        <p className="text-sm text-ink-600">Borrar el lote borra también sus cultivos, activos y evaluaciones.</p>
        <button onClick={() => setConfirmandoBorrado(true)} className={boton.peligro}>
          Borrar lote
        </button>
      </div>

      <ConfirmarBorrado
        abierto={confirmandoBorrado}
        titulo={`Borrar "${lote.nombre}"`}
        queSeBorra={`Se borran también ${cultivos.length} zona(s) de cultivo, ${activos.length} activo(s) y las evaluaciones de riesgo del lote.`}
        borrando={borrarLote.isPending}
        onConfirmar={() => borrarLote.mutate()}
        onCerrar={() => setConfirmandoBorrado(false)}
      />
    </div>
  );
}
