"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { InfoModal } from "@/components/InfoModal";
import type { DuracionAnegamiento, RegimenAnegamiento } from "@/lib/types";

/**
 * Cuánto va a durar el anegamiento, como franja de días.
 *
 * Es el segundo dolor que la encuesta a productores dejaba sin atender: el sistema ya decía qué
 * sectores se anegan y cuánta plata hay en juego, pero no cuánto tiempo va a estar el agua arriba
 * — que es lo que decide si hay que sacar la hacienda del campo o alcanza con moverla de potrero,
 * y si el lote se pierde o se resiembra.
 *
 * Va arriba del informe económico y no adentro: la plata en riesgo queda congelada en el momento
 * en que se generó el informe, y la duración se recalcula con la lluvia de los últimos 30 días.
 */

/** El régimen no es una etiqueta decorativa: dice de dónde salió el número y en qué unidad pensar. */
const COLOR_REGIMEN: Record<RegimenAnegamiento, string> = {
  LOCAL: "text-risk-bajo bg-risk-bajo-bg",
  TRANSICION: "text-clay-600 bg-clay-500/10",
  FREATICO_REGIONAL: "text-risk-alto bg-risk-alto-bg",
  SIN_DRENAJE: "text-risk-alto bg-risk-alto-bg",
  SIN_ANEGAMIENTO: "text-ink-600 bg-paper-200",
};

const ETIQUETA_REGIMEN: Record<RegimenAnegamiento, string> = {
  LOCAL: "Evento de este campo",
  TRANSICION: "La región ya está cargada",
  FREATICO_REGIONAL: "Anegamiento regional",
  SIN_DRENAJE: "El campo no está drenando",
  SIN_ANEGAMIENTO: "Sin anegamiento",
};

export function PanelDuracionAnegamiento({ establecimientoId }: { establecimientoId: string }) {
  const { data: duracion, isLoading } = useQuery({
    queryKey: ["duracion-anegamiento", establecimientoId],
    queryFn: () => api.get<DuracionAnegamiento | null>(`/establecimientos/${establecimientoId}/anegamiento/duracion`),
    retry: false,
  });

  // 204 sin cuerpo: no hay ningún lote con agua en la ventana del evento. No se muestra un cero,
  // se muestra nada — decir "0 días de anegamiento" sugeriría que se midió algo.
  if (isLoading || !duracion || !duracion.hayAnegamiento) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <div className="flex items-center gap-1.5">
        <p className="text-sm uppercase tracking-wide text-brand-600">Durante el evento</p>
        <InfoModal titulo="Cómo se estima la duración">
          <p>
            Se combinan dos señales que miden cosas distintas. La primera es la recesión del agua en el lote: la
            simulación hidrológica deja una lámina en superficie, y esa lámina baja por lo que infiltra y lo que se
            evapotranspira, menos lo que sigue lloviendo.
          </p>
          <p>
            La segunda es el régimen de la Cuenca del Salado. Un trabajo sobre la cuenca baja del Salado midió que la
            superficie anegada regional se mantiene cerca del 6% con 72mm acumulados en 30 días, y que los problemas
            severos empiezan por encima de los 150mm, cuando llega al 68%. Ahí el agua del campo no tiene a dónde ir
            porque la napa está en superficie, y los episodios de otoño e invierno duraron unos cinco meses en promedio.
          </p>
          <p>
            Por eso la señal regional no promedia con la del lote: actúa como piso. Y por eso la respuesta es una franja
            ancha y no un número: decir &quot;37 días&quot; sería fingir una precisión que ni la simulación ni la
            literatura de la cuenca tienen.
          </p>
        </InfoModal>
      </div>
      <h2 className="font-display text-lg font-medium text-ink-950">Cuánto va a durar el agua</h2>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-2xl font-medium text-ink-950">{duracion.resumen.split(".")[0]}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_REGIMEN[duracion.regimen]}`}>
          {ETIQUETA_REGIMEN[duracion.regimen]}
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">{duracion.resumen.split(".").slice(1).join(".").trim()}</p>

      <ul className="mt-4 space-y-2 border-t border-paper-300 pt-3">
        {duracion.senales.map((senal) => (
          <li key={senal.nombre} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink-900">{senal.nombre}</span>
              <span className="font-mono text-xs tabular-nums text-ink-600">
                {senal.aporteDias != null ? `${Math.round(senal.aporteDias)} días` : "no concluyente"}
              </span>
            </div>
            <p className="text-ink-600">{senal.detalle}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{senal.fuente}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
