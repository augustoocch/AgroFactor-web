"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { InfoModal } from "@/components/InfoModal";
import { Tooltip } from "@/components/Tooltip";
import { ClimaEscena } from "@/components/ClimaEscena";
import type { CondicionClimatica, Pronostico, PronosticoDiario } from "@/lib/types";

// Mismos umbrales que usa el calculo de riesgo: no son decorativos. En pantalla no se nombran
// como "umbrales del score" sino por lo que significan, que es lo unico accionable para el usuario.
const UMBRAL_SATURACION_90D_MM = 300;
const UMBRAL_EVENTO_7D_MM = 100;

const ETIQUETA_CONDICION: Record<CondicionClimatica, string> = {
  SOL: "Sol",
  NUBLADO: "Nublado",
  LLUVIA: "Lluvia",
  TORMENTA: "Tormenta",
  NIEVE: "Nieve",
};

const COLOR_CONDICION: Record<CondicionClimatica, string> = {
  SOL: "var(--color-clay-500)",
  NUBLADO: "var(--color-ink-400)",
  LLUVIA: "var(--color-brand-600)",
  TORMENTA: "var(--color-risk-alto)",
  NIEVE: "var(--color-brand-200)",
};

function IconoCondicion({ condicion, tamano = 10 }: { condicion: CondicionClimatica; tamano?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: tamano, height: tamano, backgroundColor: COLOR_CONDICION[condicion] }}
    />
  );
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso + "T00:00:00");
  return fecha.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }).replace(".", "");
}

function BarraProgreso({ valor, umbral, color }: { valor: number; umbral: number; color: string }) {
  const porcentaje = Math.min((valor / umbral) * 100, 100);
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-50">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${porcentaje}%` }}
        transition={{ duration: 0.6, ease: easeOutExpo }}
      />
    </div>
  );
}

function TarjetaDia({ dia, i }: { dia: PronosticoDiario; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: i * 0.03, ease: easeOutExpo }}
      className="flex w-36 shrink-0 flex-col gap-2 rounded-xl border border-paper-300 bg-paper-50 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-800">{formatearFecha(dia.fecha)}</span>
        <IconoCondicion condicion={dia.condicion} />
      </div>
      <p className="text-xs text-ink-600">{ETIQUETA_CONDICION[dia.condicion]}</p>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-sm font-medium text-ink-950">{dia.tempMaxC?.toFixed(0) ?? "–"}°</span>
        <span className="font-mono text-xs text-ink-600">/ {dia.tempMinC?.toFixed(0) ?? "–"}°</span>
      </div>
      <div className="space-y-0.5 font-mono text-[11px] text-ink-600">
        <p>Lluvia {dia.precipitacionMm.toFixed(0)}mm ({dia.probabilidadLluviaPct?.toFixed(0) ?? "–"}%)</p>
        <p>Viento {dia.vientoMaxKmh?.toFixed(0) ?? "–"} km/h</p>
        <p>Humedad {dia.humedadMediaPct?.toFixed(0) ?? "–"}%</p>
      </div>
      {dia.impactos.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-paper-300 pt-1.5">
          {dia.impactos.map((impacto) => (
            <span key={impacto} className="rounded-md bg-clay-100 px-1.5 py-1 text-[10px] leading-tight text-clay-600">
              {impacto}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/** Precipitación, temperatura, humedad y viento reales (Open-Meteo), con la interpretación agronómica día a día. */
export function PanelClima({ loteReferenciaId }: { loteReferenciaId: string }) {
  const { data: pronostico, isLoading } = useQuery({
    queryKey: ["clima", loteReferenciaId],
    queryFn: () => api.get<Pronostico>(`/lotes/${loteReferenciaId}/clima/pronostico`),
    retry: false,
    staleTime: 1000 * 60 * 30,
  });

  const dias = pronostico?.dias ?? [];
  const proximos7 = dias.slice(0, 7);
  const sumaProximos7 = proximos7.reduce((acc, d) => acc + d.precipitacionMm, 0);
  const actual = pronostico?.actual;

  return (
    <div className="space-y-4">
      <div className="relative isolate overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-paper-50">
        {actual && <ClimaEscena condicion={actual.condicion} />}
        <div className="relative flex items-center gap-1.5">
          <p className="text-sm uppercase tracking-wide text-brand-200">El tiempo sobre el campo</p>
          <InfoModal titulo="Qué muestra este panel">
            <p>
              Lo que ya llovió sobre el campo en los últimos 90 días y lo que se espera para la semana que viene.
            </p>
            <p>
              Los avisos de cada día (deriva, helada, riesgo de enfermedad) marcan condiciones a tener en cuenta, no
              anuncian que vayan a pasar.
            </p>
          </InfoModal>
        </div>

        {isLoading && <p className="relative mt-2 text-sm text-brand-100">Consultando clima...</p>}

        {actual && (
          <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-display text-4xl font-medium">{actual.temperaturaC?.toFixed(0) ?? "–"}°C</p>
              <p className="text-sm text-brand-100">{ETIQUETA_CONDICION[actual.condicion]} ahora mismo</p>
            </div>
            <div className="flex gap-4 font-mono text-xs text-brand-100">
              <span>Humedad {actual.humedadPct?.toFixed(0) ?? "–"}%</span>
              <span>Viento {actual.vientoKmh?.toFixed(0) ?? "–"} km/h</span>
              <span>Nubosidad {actual.nubosidadPct?.toFixed(0) ?? "–"}%</span>
            </div>
          </div>
        )}
      </div>

      {dias.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-800">Próximos {dias.length} días</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {dias.map((dia, i) => (
              <TarjetaDia key={dia.fecha} dia={dia} i={i} />
            ))}
          </div>
        </div>
      )}

      {pronostico && (
        <div className="rounded-2xl border border-paper-300 bg-paper-50 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-600">Cuánta agua viene acumulando el campo</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-700">
                <Tooltip texto="Pasados los 300 mm, el suelo de la zona suele estar cerca de saturarse y absorbe mucho menos.">
                  <span>Últimos 90 días</span>
                </Tooltip>
                <span className="font-mono">{pronostico.precipitacionUltimos90DiasMm.toFixed(0)} / {UMBRAL_SATURACION_90D_MM} mm</span>
              </div>
              <BarraProgreso valor={pronostico.precipitacionUltimos90DiasMm} umbral={UMBRAL_SATURACION_90D_MM} color="var(--color-brand-600)" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-ink-700">
                <Tooltip texto="Pasados los 100 mm en una semana es una lluvia fuera de lo común, y el riesgo de los lotes sube.">
                  <span>Pronóstico próximos 7 días</span>
                </Tooltip>
                <span className="font-mono">{sumaProximos7.toFixed(0)} / {UMBRAL_EVENTO_7D_MM} mm</span>
              </div>
              <BarraProgreso
                valor={sumaProximos7}
                umbral={UMBRAL_EVENTO_7D_MM}
                color={sumaProximos7 >= UMBRAL_EVENTO_7D_MM ? "var(--color-risk-alto)" : "var(--color-clay-500)"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
