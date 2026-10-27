"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { GeoJSON, ImageOverlay, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM } from "@/lib/mapa-utils";
import type { BandaMeteorologica, EscenaReproduccion, ImagenReproduccion, LimitesGeograficos, Lote } from "@/lib/types";

/** Agua observada: el azul de la marca, no el rojo de riesgo -esto es un hecho, no una alarma. */
export const COLOR_AGUA = "oklch(58% 0.14 245)";
// Todos los colores que llegan a Leaflet van LITERALES, nunca como `var(--...)`: Leaflet los
// escribe como atributos SVG (`stroke`, `fill`), y ahi una variable CSS no se resuelve y el trazo
// queda invisible. Asi desaparecian los lotes al apagar la foto. Son los mismos valores que los
// tokens de globals.css.
/** Lagunas y bajos que ya tenian agua antes del evento: presentes, pero no son anegamiento (ink-400). */
export const COLOR_AGUA_PREVIA = "oklch(62% 0.02 250)";
/** Agua que simula el modelo del sistema: otro tono (arcilla) para que nunca se confunda con la observada (clay-500). */
export const COLOR_AGUA_SIMULADA = "oklch(64% 0.15 50)";
/** Contorno de los lotes: claro sobre la foto satelital, tinta oscura (ink-800) sobre el mapa base. */
const COLOR_LOTE_SOBRE_FOTO = "oklch(92% 0.12 95)";
const COLOR_LOTE_SOBRE_MAPA = "oklch(30% 0.03 250)";

/**
 * Rampa secuencial (un solo tono, de claro a oscuro) para la lamina simulada: mas oscuro = mas
 * agua. Arcilla y no azul, para que la simulacion nunca se lea como agua observada.
 */
const RAMPA_SIMULADA = [
  "oklch(84% 0.08 58)",
  "oklch(75% 0.12 55)",
  "oklch(66% 0.15 50)",
  "oklch(56% 0.14 46)",
  "oklch(45% 0.12 42)",
];

export function colorBandaSimulada(indice: number, total: number): string {
  if (total <= 1) return RAMPA_SIMULADA[2];
  return RAMPA_SIMULADA[Math.round((indice / (total - 1)) * (RAMPA_SIMULADA.length - 1))];
}

function Encuadre({ bounds }: { bounds: LimitesGeograficos }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [bounds.sur, bounds.oeste],
        [bounds.norte, bounds.este],
      ],
      { padding: [8, 8] },
    );
    // Solo al montar: si el usuario hizo zoom, cambiar de semana no lo tiene que devolver al encuadre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

interface Props {
  lotes: Lote[];
  bounds: LimitesGeograficos;
  escena: EscenaReproduccion;
  aguaPrevia: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  imagen: ImagenReproduccion | null;
  mostrarImagen: boolean;
  mostrarAgua: boolean;
  /** Si viene, el mapa muestra las isobandas de agua que simulo el modelo en vez de la observada, sin foto. */
  bandasSimuladas?: BandaMeteorologica[] | null;
  /**
   * Identifica la corrida que produjo `bandasSimuladas` (fecha + lluvia del escenario). Va en la key
   * de cada capa: dos escenarios pueden traer una banda con el mismo rango (10-25 mm) y distinta
   * forma, y con la misma key React reusaba la capa montada y Leaflet seguia dibujando la vieja.
   */
  claveSimulacion?: string;
  alto?: string;
}

/**
 * La semana elegida sobre el campo: la foto real del satelite de ese dia (si se pidio), el agua que
 * el sistema detecto en ella, y las lagunas que ya estaban antes del evento.
 *
 * La foto va debajo de las manchas y se puede apagar: con la foto prendida el usuario comprueba
 * que las manchas azules caen sobre agua que se ve a simple vista; con la foto apagada se lee
 * mejor la forma del anegamiento contra los lotes.
 */
export function MapaReproduccion({
  lotes,
  bounds,
  escena,
  aguaPrevia,
  imagen,
  mostrarImagen: mostrarImagenPedido,
  mostrarAgua,
  bandasSimuladas,
  claveSimulacion = "",
  alto = "h-[56vh] min-h-[340px]",
}: Props) {
  const esSimulacion = bandasSimuladas !== undefined;
  const mostrarImagen = mostrarImagenPedido && !esSimulacion;
  return (
    <div className={`relative isolate ${alto} w-full overflow-hidden rounded-2xl border border-paper-300 ${CLASES_CONTENEDOR_MAPA}`}>
      <MapContainer
        center={[(bounds.sur + bounds.norte) / 2, (bounds.oeste + bounds.este) / 2]}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom={false}
        style={{ background: "var(--color-paper-100)" }}
      >
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <Encuadre bounds={bounds} />

        {/* La foto queda montada y se prende o apaga con la opacidad, en vez de montarla y
            desmontarla con cada tilde: asi el interruptor siempre actua sobre la misma capa. */}
        {!esSimulacion && imagen?.disponible && (
          <ImageOverlay
            key={`img-${imagen.fecha}`}
            url={imagen.dataUrl}
            bounds={[
              [imagen.bounds.sur, imagen.bounds.oeste],
              [imagen.bounds.norte, imagen.bounds.este],
            ]}
            opacity={mostrarImagen ? 1 : 0}
            attribution="Sentinel-2 · ESA/Copernicus"
          />
        )}

        {mostrarAgua && !esSimulacion && aguaPrevia && (
          <GeoJSON
            key="previa"
            data={aguaPrevia}
            style={{ color: COLOR_AGUA_PREVIA, fillColor: COLOR_AGUA_PREVIA, weight: 0.8, opacity: 0.8, fillOpacity: 0.35 }}
          />
        )}

        {mostrarAgua &&
          esSimulacion &&
          (bandasSimuladas ?? []).map((banda, i, todas) => (
            <GeoJSON
              // Ver `claveSimulacion`: cada corrida monta capas nuevas, nunca reusa las de otra.
              key={`sim-${claveSimulacion}-${i}-${banda.desde}-${banda.hasta}`}
              data={banda.geometria}
              style={{
                color: colorBandaSimulada(i, todas.length),
                fillColor: colorBandaSimulada(i, todas.length),
                weight: 0.6,
                opacity: 0.8,
                fillOpacity: 0.6,
              }}
            />
          ))}

        {mostrarAgua && !esSimulacion && escena.agua && (
          <GeoJSON
            // La key cambia con la fecha: Leaflet no reemplaza los datos de una capa GeoJSON montada.
            key={`agua-${escena.fecha}`}
            data={escena.agua}
            style={{ color: COLOR_AGUA, fillColor: COLOR_AGUA, weight: 0.8, opacity: 0.9, fillOpacity: mostrarImagen ? 0.55 : 0.7 }}
          />
        )}

        {lotes.map((lote) => (
          <Polygon
            key={lote.id}
            positions={lote.anillo.map((c) => [c.lat, c.lon])}
            pathOptions={{
              color: mostrarImagen ? COLOR_LOTE_SOBRE_FOTO : COLOR_LOTE_SOBRE_MAPA,
              weight: 2,
              fillOpacity: 0,
            }}
          >
            <Tooltip sticky>{lote.nombre}</Tooltip>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  );
}
