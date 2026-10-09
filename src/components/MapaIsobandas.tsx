"use client";

import { Icono } from "@/components/Icono";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { GeoJSON, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM } from "@/lib/mapa-utils";
import type { BandaMeteorologica, Lote } from "@/lib/types";

/**
 * Rampa de intensidad de las isobandas. Misma familia que la escala de riesgo del resto de la
 * app, para que "mas oscuro y mas rojo" signifique lo mismo en todas las pantallas.
 */
const RAMPA = [
  "var(--color-risk-bajo)",
  "var(--color-risk-medio)",
  "var(--color-clay-500)",
  "var(--color-clay-600)",
  "var(--color-risk-alto)",
];

export function colorDeBanda(indice: number, total: number): string {
  if (total <= 1) return RAMPA[RAMPA.length - 1];
  return RAMPA[Math.round((indice / (total - 1)) * (RAMPA.length - 1))];
}

function AutoEncuadre({ lotes }: { lotes: Lote[] }) {
  const map = useMap();
  const encuadrado = useRef(false);

  useEffect(() => {
    if (encuadrado.current || lotes.length === 0) return;
    const puntos = lotes.flatMap((l) => l.anillo.map((c) => [c.lat, c.lon] as [number, number]));
    if (puntos.length > 0) {
      map.fitBounds(puntos, { padding: [28, 28], maxZoom: 15 });
      encuadrado.current = true;
    }
  }, [lotes, map]);

  return null;
}

interface Props {
  lotes: Lote[];
  bandas: BandaMeteorologica[];
  unidad?: string;
  alto?: string;
  /**
   * Por que no hay manchas que dibujar. Va SOBRE el mapa y no debajo: un mapa vacio sin
   * explicacion al lado se lee como una pantalla rota, y la razon estaba a media pagina de
   * distancia, donde nadie la encontraba.
   */
  motivoSinBandas?: string;
}

export function MapaIsobandas({ lotes, bandas, unidad = "mm", alto = "h-[46vh]", motivoSinBandas }: Props) {
  return (
    <div className="space-y-2">
      <div
        className={`relative isolate ${alto} w-full overflow-hidden rounded-2xl border border-paper-300 ${CLASES_CONTENEDOR_MAPA}`}
      >
        <MapContainer
          center={[-35.8, -60.0]}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={false}
          style={{ background: "var(--color-paper-100)" }}
        >
          <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
          <AutoEncuadre lotes={lotes} />

          {/* Los lotes van debajo, como referencia de donde cae cada mancha. */}
          {lotes.map((lote) => (
            <Polygon
              key={lote.id}
              positions={lote.anillo.map((c) => [c.lat, c.lon])}
              pathOptions={{ color: "var(--color-ink-600)", weight: 1.2, fillOpacity: 0.04, dashArray: "3 3" }}
            />
          ))}

          {bandas.map((banda, i) => (
            <GeoJSON
              // La key incluye los limites de la banda: al cambiar de dia React tiene que
              // reemplazar la capa de Leaflet, no reusarla, o quedan las bandas viejas encima.
              key={`${i}-${banda.desde}-${banda.hasta}`}
              data={banda.geometria}
              style={{
                color: colorDeBanda(i, bandas.length),
                fillColor: colorDeBanda(i, bandas.length),
                weight: 1,
                opacity: 0.65,
                fillOpacity: 0.45,
              }}
            />
          ))}
        </MapContainer>

        {bandas.length === 0 && motivoSinBandas && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex justify-start">
            <p className="pointer-events-auto flex max-w-xs items-start gap-2 rounded-xl border border-paper-300 bg-paper-50/95 px-3 py-2 text-xs leading-snug text-ink-700 shadow-md backdrop-blur">
              <Icono nombre="info" className="mt-px h-4 w-4 shrink-0 text-brand-600" />
              {motivoSinBandas}
            </p>
          </div>
        )}
      </div>

      {bandas.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-paper-300 bg-paper-50 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-600">
            Agua acumulada ({unidad})
          </span>
          {bandas.map((banda, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-700">
              <span
                className="inline-block h-3 w-6 rounded-sm border border-ink-400/30"
                style={{ background: colorDeBanda(i, bandas.length), opacity: 0.75 }}
              />
              {banda.desde}–{banda.hasta}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
