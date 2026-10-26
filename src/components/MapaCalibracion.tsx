"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Polygon, TileLayer, Tooltip } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM } from "@/lib/mapa-utils";
import type { ResultadoLoteCalibracion } from "@/lib/types";

// Colores literales (Leaflet no resuelve variables CSS en atributos SVG). Son los de globals.css.
/** Relleno por score: rampa secuencial de un solo tono (arcilla), claro = bajo, oscuro = alto. */
const RAMPA_SCORE = ["oklch(94% 0.03 60)", "oklch(84% 0.08 58)", "oklch(74% 0.13 55)", "oklch(64% 0.15 50)", "oklch(56% 0.14 46)"];
/** Borde por lo observado: azul (agua) si el satelite lo vio anegado, tinta si quedo seco. */
const BORDE_ANEGADO = "oklch(58% 0.14 245)";
const BORDE_SECO = "oklch(30% 0.03 250)";
const BORDE_ERROR = "oklch(62% 0.02 250)";

function colorScore(score: number): string {
  return RAMPA_SCORE[Math.min(RAMPA_SCORE.length - 1, Math.max(0, Math.floor(score * RAMPA_SCORE.length)))];
}

/**
 * Los N lotes del sandbox sobre el mapa: el relleno es lo que el motor dijo ANTES del evento (score
 * de riesgo) y el borde lo que paso (agua observada). Un lote oscuro con borde negro es una falsa
 * alarma; uno claro con borde azul, un anegamiento que el score no anticipo.
 */
export function MapaCalibracion({ resultados }: { resultados: ResultadoLoteCalibracion[] }) {
  const conAnillo = resultados.filter((r) => r.anillo && r.anillo.length >= 3);
  if (conAnillo.length === 0) return null;
  const lats = conAnillo.flatMap((r) => r.anillo!.map((p) => p[0]));
  const lons = conAnillo.flatMap((r) => r.anillo!.map((p) => p[1]));

  return (
    <MapContainer
      bounds={[
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ]}
      boundsOptions={{ padding: [16, 16] }}
      scrollWheelZoom={false}
      className={`${CLASES_CONTENEDOR_MAPA} h-[26rem]`}
    >
      <TileLayer url={URL_TILES_OSM} attribution={ATRIBUCION_OSM} />
      {conAnillo.map((r) => {
        const anegado = r.observado?.huboAnegamiento;
        return (
          <Polygon
            key={r.id}
            positions={r.anillo!}
            pathOptions={{
              color: r.error ? BORDE_ERROR : anegado ? BORDE_ANEGADO : BORDE_SECO,
              weight: 3,
              fillColor: r.riesgo ? colorScore(r.riesgo.score) : "transparent",
              fillOpacity: 0.85,
              dashArray: r.error ? "4 4" : undefined,
            }}
          >
            <Tooltip sticky>
              <strong>{r.nombre ?? r.id}</strong>
              <br />
              {r.error
                ? `Sin evaluar: ${r.error}`
                : `Score ${r.riesgo?.score.toFixed(2)} · agua máx. ${r.observado?.maxPct ?? 0}% (${anegado ? "anegado" : "seco"})`}
            </Tooltip>
          </Polygon>
        );
      })}
    </MapContainer>
  );
}
