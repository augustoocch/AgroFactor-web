"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { InfoModal } from "@/components/InfoModal";
import { api } from "@/lib/api";
import type { DiaAnalizado, Lote, PronosticoDiaADia as Datos } from "@/lib/types";

const MapaIsobandas = dynamic(() => import("@/components/MapaIsobandas").then((m) => m.MapaIsobandas), {
  ssr: false,
});

const DIA_SEMANA = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

function etiquetaFecha(iso: string): { dia: string; fecha: string } {
  // Se parsea a mano: `new Date("2026-09-07")` se interpreta como UTC y en Argentina cae un dia antes.
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return { dia: DIA_SEMANA[fecha.getDay()], fecha: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}` };
}

/**
 * Estado del suelo en palabras. El metodo SCS-CN lo nombra I, II y III, pero esos numeros
 * romanos no le dicen nada a nadie que no conozca el metodo, y son justo el dato que explica
 * por que la misma lluvia un dia anega y otro no.
 */
const SUELO_EN_PALABRAS: Record<string, string> = {
  I: "seco",
  II: "normal",
  III: "saturado",
};

/**
 * Color segun la lamina que el modelo predice, no segun los mm que caen: 40 mm sobre suelo
 * saturado anegan y sobre suelo seco infiltran.
 */
function colorDeDia(dia: DiaAnalizado): string {
  if (dia.laminaMaximaMm >= 100) return "var(--color-risk-alto)";
  if (dia.laminaMaximaMm >= 30) return "var(--color-risk-medio)";
  if (dia.laminaMaximaMm > 0) return "var(--color-clay-500)";
  return "var(--color-ink-400)";
}

/** Cuanta agua quedaria en superficie, en la unidad en que se lee facil. */
function aguaDelDia(dia: DiaAnalizado): string {
  if (dia.laminaMaximaMm <= 0) return "no queda";
  if (dia.laminaMaximaMm < 10) return `${dia.laminaMaximaMm.toFixed(0)} mm`;
  return `${(dia.laminaMaximaMm / 10).toFixed(0)} cm`;
}

/**
 * Por que ese dia no tiene manchas en el mapa. Son dos causas distintas y confundirlas hace
 * pensar que la pantalla esta rota: o no llueve, o llueve pero el suelo se lo absorbe.
 */
function motivoSinBandas(dia: DiaAnalizado): string {
  if (dia.precipitacionMm <= 0) {
    return "No se espera lluvia este dia, asi que no hay agua que se acumule.";
  }
  return (
    `Se esperan ${dia.precipitacionMm.toFixed(1)} mm, pero el suelo llega ` +
    `${SUELO_EN_PALABRAS[dia.condicionHumedadAntecedente] ?? "sin saturar"} y los absorbe: no queda agua en superficie.`
  );
}

/** Fila etiquetada dentro del boton de un dia: sin la etiqueta el numero no se entiende. */
function Dato({ etiqueta, valor, resaltado }: { etiqueta: string; valor: string; resaltado?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1.5">
      <span className="text-[10px] text-ink-600">{etiqueta}</span>
      <span className="font-mono text-[11px]" style={resaltado ? { color: resaltado } : undefined}>
        {valor}
      </span>
    </div>
  );
}

function Celda({
  etiqueta,
  valor,
  unidad,
  ayuda,
}: {
  etiqueta: string;
  valor: string | number | null;
  unidad?: string;
  /** Explicacion opcional detras de un boton "i", para los valores que no se explican solos. */
  ayuda?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-paper-300 bg-paper-50 px-2.5 py-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-ink-600">{etiqueta}</span>
        {ayuda}
      </div>
      <p className="font-mono text-sm text-ink-950">
        {valor ?? "—"}
        {valor !== null && unidad ? <span className="text-[11px] text-ink-600">{unidad}</span> : null}
      </p>
    </div>
  );
}

interface Props {
  /** Uno u otro: define si el pronostico es de un lote o del predio entero. */
  loteId?: string;
  establecimientoId?: string;
  /** Poligonos a dibujar como referencia debajo de las isobandas. */
  lotes: Lote[];
  dias?: number;
}

export function PronosticoDiaADia({ loteId, establecimientoId, lotes, dias = 7 }: Props) {
  const [indice, setIndice] = useState(0);

  const ruta = loteId
    ? `/lotes/${loteId}/pronostico/dia-a-dia?dias=${dias}`
    : `/establecimientos/${establecimientoId}/meteorologia/dia-a-dia?dias=${dias}`;

  const { data, isPending, isError } = useQuery({
    queryKey: ["pronostico-dia-a-dia", loteId ?? establecimientoId, dias],
    queryFn: () => api.get<Datos>(ruta),
    // El pronostico se actualiza cada pocas horas y detras hay una corrida hidrologica por dia:
    // no tiene sentido recalcularlo al volver a la pantalla.
    staleTime: 30 * 60 * 1000,
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {Array.from({ length: dias }).map((_, i) => (
            <div key={i} className="h-[4.5rem] flex-1 animate-pulse rounded-xl bg-paper-200" />
          ))}
        </div>
        <div className="h-[46vh] w-full animate-pulse rounded-2xl bg-paper-200" />
      </div>
    );
  }

  if (isError || !data?.disponible) {
    return (
      <p className="rounded-2xl border border-dashed border-paper-300 p-6 text-center text-sm text-ink-600">
        {data?.motivoNoDisponible ?? "No se pudo calcular el pronostico dia a dia."}
      </p>
    );
  }

  const dia = data.dias[Math.min(indice, data.dias.length - 1)];

  return (
    <div className="space-y-3">
      {/* Cada valor va con su etiqueta. Antes decia "0.0 mm / 0% · I / sin agua": el numero
          romano no lo entendia nadie, y "sin agua" no aclaraba si faltaba el dato o si el
          resultado era que no se acumulaba. */}
      <p className="text-xs text-ink-600">
        Para cada dia: la lluvia esperada, con que humedad llega el suelo, y cuanta agua quedaria en superficie.
        Cuando no queda agua, el mapa no dibuja manchas.
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {data.dias.map((d, i) => {
          const { dia: nombre, fecha } = etiquetaFecha(d.fecha);
          const activo = i === indice;
          return (
            <button
              key={d.fecha}
              onClick={() => setIndice(i)}
              className={`space-y-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                activo ? "border-brand-500 bg-brand-100" : "border-paper-300 bg-paper-50 hover:border-brand-500"
              }`}
            >
              <p className="mb-1 text-[11px] font-medium text-ink-900">
                {nombre} {fecha}
              </p>
              <Dato
                etiqueta="Lluvia"
                valor={d.precipitacionMm > 0 ? `${d.precipitacionMm.toFixed(1)} mm` : "—"}
              />
              <Dato
                etiqueta="Probab."
                valor={d.probabilidadLluviaPct != null ? `${d.probabilidadLluviaPct.toFixed(0)}%` : "—"}
              />
              <Dato etiqueta="Suelo" valor={SUELO_EN_PALABRAS[d.condicionHumedadAntecedente] ?? "—"} />
              <Dato etiqueta="Agua" valor={aguaDelDia(d)} resaltado={colorDeDia(d)} />
            </button>
          );
        })}
      </div>

      <MapaIsobandas lotes={lotes} bandas={dia.bandas} unidad="mm" motivoSinBandas={motivoSinBandas(dia)} />

      {/* Detalle tecnico del dia elegido. Meteorologia arriba, estado del suelo e hidrologia
          abajo: es la cadena que explica por que ese dia da lo que da. */}
      <div className="space-y-2 rounded-2xl border border-paper-300 bg-paper-100 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-display text-sm font-medium text-ink-950">
            {etiquetaFecha(dia.fecha).dia} {etiquetaFecha(dia.fecha).fecha} · {dia.condicion.toLowerCase()}
          </h4>
          {data.celdaM && <span className="text-[10px] text-ink-600">celda de calculo {data.celdaM} m</span>}
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          <Celda etiqueta="Lluvia" valor={dia.precipitacionMm.toFixed(1)} unidad=" mm" />
          <Celda
            etiqueta="Probabilidad"
            valor={dia.probabilidadLluviaPct?.toFixed(0) ?? null}
            unidad="%"
            ayuda={
              <InfoModal titulo="Qué significa esta probabilidad">
                <p>
                  Es el pico de <strong>una hora</strong>, no la chance del día entero.
                </p>
                <p>
                  Por eso un día puede tener más probabilidad y menos lluvia: tiene una hora con
                  algo de chance, pero el modelo no llega a producir agua en ninguna.
                </p>
                <p className="text-ink-600">
                  Para decidir, mirá los milímetros. Esto dice cuánta confianza tenerles.
                </p>
              </InfoModal>
            }
          />
          <Celda etiqueta="Temp max / min" valor={`${dia.tempMaxC?.toFixed(0) ?? "—"}/${dia.tempMinC?.toFixed(0) ?? "—"}`} unidad="°C" />
          <Celda etiqueta="Humedad" valor={dia.humedadMediaPct?.toFixed(0) ?? null} unidad="%" />
          <Celda etiqueta="Viento / rafaga" valor={`${dia.vientoMaxKmh?.toFixed(0) ?? "—"}/${dia.vientoRafagaKmh?.toFixed(0) ?? "—"}`} unidad=" km/h" />
          <Celda etiqueta="Radiacion" valor={dia.radiacionSolarMj?.toFixed(1) ?? null} unidad=" MJ" />
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          <Celda etiqueta="Lluvia previa 5d" valor={dia.lluviaPrevia5DiasMm.toFixed(1)} unidad=" mm" />
          <Celda
            etiqueta="Suelo al llegar"
            valor={SUELO_EN_PALABRAS[dia.condicionHumedadAntecedente] ?? dia.condicionHumedadAntecedente}
          />
          <Celda etiqueta="Lamina maxima" valor={(dia.laminaMaximaMm / 10).toFixed(1)} unidad=" cm" />
          <Celda etiqueta="Superficie anegada" valor={dia.superficieAnegadaPct.toFixed(0)} unidad="%" />
          <Celda etiqueta="Pico" valor={dia.laminaMaximaMm > 0 ? `${dia.horaPico}` : null} unidad=" h" />
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Celda etiqueta="Infiltracion" valor={dia.infiltracionMediaMm.toFixed(0)} unidad=" mm" />
          <Celda etiqueta="Entra desde afuera" valor={dia.aporteExternoMm.toFixed(0)} unidad=" mm" />
          <Celda etiqueta="Escurre fuera" valor={dia.escurrimientoFueraDelLoteMm.toFixed(0)} unidad=" mm" />
        </div>

        {dia.impactos.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {dia.impactos.map((i) => (
              <li key={i} className="rounded-full bg-clay-100 px-2.5 py-0.5 text-[11px] text-clay-600">
                {i}
              </li>
            ))}
          </ul>
        )}

        {dia.bandas.length === 0 && (
          <p className="text-xs text-ink-600">
            {dia.precipitacionMm === 0
              ? "Sin lluvia pronosticada para este dia: no hay acumulacion que mapear."
              : `El suelo llega ${SUELO_EN_PALABRAS[dia.condicionHumedadAntecedente] ?? "sin saturar"} y absorbe los ${dia.precipitacionMm.toFixed(1)} mm de este dia: no queda agua en superficie.`}
          </p>
        )}
      </div>
    </div>
  );
}
