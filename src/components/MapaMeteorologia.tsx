"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { GeoJSON, MapContainer, Polygon, TileLayer, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM } from "@/lib/mapa-utils";
import type { CapaMeteorologica, Lote } from "@/lib/types";

/**
 * Rampa de intensidad para las bandas. Va de un verde frio a un rojo, la misma familia que la
 * escala de riesgo del resto de la app, para que "mas oscuro y mas rojo" signifique lo mismo en
 * todas las pantallas.
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
  const posicion = Math.round((indice / (total - 1)) * (RAMPA.length - 1));
  return RAMPA[posicion];
}

/**
 * La nitidez del borde refleja la del dato, y esa diferencia es informacion, no una
 * inconsistencia de estilo: un campo de modelo suavizado no tiene frentes definidos y no debe
 * dibujarse como si los tuviera, mientras que el radar/satelite si observa bordes reales.
 */
function estiloDeHorizonte(horizonte: CapaMeteorologica["horizonte"]) {
  if (horizonte === "OBSERVACION") return { weight: 1.5, opacity: 0.9, fillOpacity: 0.5, dashArray: undefined };
  if (horizonte === "PRONOSTICO") return { weight: 0.5, opacity: 0.35, fillOpacity: 0.3, dashArray: "4 4" };
  return { weight: 1, opacity: 0.6, fillOpacity: 0.45, dashArray: undefined };
}

function AutoEncuadre({ lotes }: { lotes: Lote[] }) {
  const map = useMap();
  const encuadrado = useRef(false);

  useEffect(() => {
    if (encuadrado.current || lotes.length === 0) return;
    const puntos = lotes.flatMap((l) => l.anillo.map((c) => [c.lat, c.lon] as [number, number]));
    if (puntos.length > 0) {
      map.fitBounds(puntos, { padding: [32, 32], maxZoom: 15 });
      encuadrado.current = true;
    }
  }, [lotes, map]);

  return null;
}

interface Props {
  lotes: Lote[];
  capa: CapaMeteorologica | null;
  alto?: string;
}

export function MapaMeteorologia({ lotes, capa, alto = "h-[52vh]" }: Props) {
  const estilo = capa ? estiloDeHorizonte(capa.horizonte) : null;

  return (
    <div className={`relative isolate ${alto} w-full overflow-hidden rounded-2xl border border-paper-300 ${CLASES_CONTENEDOR_MAPA}`}>
      <MapContainer
        center={[-35.8, -60.0]}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={false}
        style={{ background: "var(--color-paper-100)" }}
      >
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <AutoEncuadre lotes={lotes} />

        {/* Los lotes van debajo de las bandas, como referencia de donde esta cada cosa. */}
        {lotes.map((lote) => (
          <Polygon
            key={lote.id}
            positions={lote.anillo.map((c) => [c.lat, c.lon])}
            pathOptions={{ color: "var(--color-ink-600)", weight: 1, fillOpacity: 0.04, dashArray: "3 3" }}
          />
        ))}

        {capa?.disponible &&
          estilo &&
          capa.bandas.map((banda, i) => (
            <GeoJSON
              // La key incluye el titulo de la capa: sin eso React reusaria la capa de Leaflet
              // al cambiar de pestania y las bandas viejas quedarian dibujadas encima.
              key={`${capa.titulo}-${i}`}
              data={banda.geometria}
              style={{
                color: colorDeBanda(i, capa.bandas.length),
                fillColor: colorDeBanda(i, capa.bandas.length),
                ...estilo,
              }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
