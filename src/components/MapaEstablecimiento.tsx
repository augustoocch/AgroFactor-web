"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM, cargarGeoman, colorPorRiesgo } from "@/lib/mapa-utils";
import { nivelRiesgo } from "@/lib/explicar-riesgo";
import type { Activo, Coordenada, Lote, TipoActivo } from "@/lib/types";

const ETIQUETA_TIPO_ACTIVO: Record<TipoActivo, string> = {
  HACIENDA: "Hacienda",
  MAQUINARIA: "Maquinaria",
  INSTALACION: "Instalacion",
  RESERVA_FORRAJERA: "Reserva forrajera",
  CAMINO_ACCESO: "Camino / acceso",
};

const CENTRO_CUENCA_DEL_SALADO: [number, number] = [-35.8, -60.0];

const COLOR_POR_TIPO_ACTIVO: Record<TipoActivo, string> = {
  HACIENDA: "#8a5a2f",
  MAQUINARIA: "#3a5a6b",
  INSTALACION: "#5a4a6b",
  RESERVA_FORRAJERA: "#c2703d",
  CAMINO_ACCESO: "#6b6b5a",
};

function iconoActivo(tipo: TipoActivo): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${COLOR_POR_TIPO_ACTIVO[tipo]};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Encuadra el mapa a los lotes existentes en vez de quedarse en el centro generico de la cuenca. */
function AutoEncuadre({ lotes }: { lotes: Lote[] }) {
  const map = useMap();
  const encuadrado = useRef(false);

  useEffect(() => {
    if (encuadrado.current || lotes.length === 0) return;
    const puntos = lotes.flatMap((l) => l.anillo.map((c) => [c.lat, c.lon] as [number, number]));
    if (puntos.length > 0) {
      map.fitBounds(puntos, { padding: [32, 32], maxZoom: 16 });
      encuadrado.current = true;
    }
  }, [lotes, map]);

  return null;
}

type ModoEdicion = "ninguno" | "lote";

interface Props {
  establecimientoId: string;
  lotes: Lote[];
  activos: Activo[];
  scorePorLote?: Record<string, number>;
  onLoteDibujado: (anillo: Coordenada[]) => void;
  /** Se dispara al soltar el pin de un activo MOVIBLE. Sin esto los pines quedan fijos. */
  onActivoMovido?: (activo: Activo, coordenada: Coordenada) => void;
  /** true en la pantalla de Lotes: se ve el conjunto pero no se dibuja nada nuevo desde ahi. */
  soloLectura?: boolean;
  alto?: string;
}

/**
 * Editor de lotes sobre leaflet-geoman: los vertices se arrastran/insertan/borran antes de
 * confirmar (no un click-y-reza), y al terminar se abre NuevoLoteForm en vez de guardar directo.
 *
 * Solo lotes: los cultivos y los activos se cargan dentro de cada lote, en su propia pantalla,
 * para que la relacion con el lote la defina la accion del usuario y no la posicion del click.
 */
function EditorDibujo({ onLoteDibujado }: Pick<Props, "onLoteDibujado">) {
  const map = useMap();
  const [modo, setModo] = useState<ModoEdicion>("ninguno");
  const capaEnEdicion = useRef<L.Layer | null>(null);

  useEffect(() => {
    map.pm.setGlobalOptions({
      snappable: true,
      templineStyle: { color: "#c2703d" },
      hintlineStyle: { color: "#c2703d", dashArray: [4, 4] },
    });

    const alCrear = (e: { shape: string; layer: L.Layer }) => {
      if (e.shape !== "Polygon" || !(e.layer instanceof L.Polygon)) return;
      map.pm.disableDraw();
      capaEnEdicion.current = e.layer;
      e.layer.setStyle({ color: "#c2703d", dashArray: "5 5", fillOpacity: 0.1 });
      (e.layer as L.Polygon & { pm: { enable: (o?: object) => void } }).pm.enable({ draggable: true });
      setModo("lote");
    };

    map.on("pm:create", alCrear);
    return () => {
      map.off("pm:create", alCrear);
    };
  }, [map]);

  const cancelar = () => {
    map.pm.disableDraw();
    if (capaEnEdicion.current) {
      map.removeLayer(capaEnEdicion.current);
      capaEnEdicion.current = null;
    }
    setModo("ninguno");
  };

  const confirmarLote = () => {
    const capa = capaEnEdicion.current as L.Polygon | null;
    if (!capa) return;
    const anillo = (capa.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lon: p.lng }));
    map.removeLayer(capa);
    capaEnEdicion.current = null;
    setModo("ninguno");
    onLoteDibujado(anillo);
  };

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
      {modo === "ninguno" && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              map.pm.enableDraw("Polygon");
              setModo("lote");
            }}
            className="rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-medium text-paper-50 shadow-sm hover:bg-brand-600"
          >
            + Lote
          </button>
        </div>
      )}

      {modo === "lote" && (
        <div className="flex flex-col items-end gap-1.5 rounded-xl border border-paper-300 bg-paper-50 p-2.5 shadow-lg">
          <p className="max-w-[11rem] text-right text-xs text-ink-600">
            Arrastra los vertices para ajustar el lote. Doble click para terminar de dibujar.
          </p>
          <div className="flex gap-1.5">
            <button onClick={cancelar} className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700">
              Cancelar
            </button>
            <button onClick={confirmarLote} className="rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-paper-50">
              Listo
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Basemap OpenStreetMap estandar (gratuito, sin API key) con un filtro CSS que lo despatura y
 * le da temperatura calida acorde a la paleta, para que el color de riesgo sea lo unico que
 * llame la atencion sobre el mapa sin depender de un proveedor de tiles de pago.
 */
export function MapaEstablecimiento({
  establecimientoId,
  lotes,
  activos,
  scorePorLote,
  onLoteDibujado,
  onActivoMovido,
  soloLectura = false,
  alto = "h-[55vh]",
}: Props) {
  const [geomanListo, setGeomanListo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    cargarGeoman().then(() => {
      if (!cancelado) setGeomanListo(true);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (!geomanListo) {
    return (
      <div className={`flex ${alto} w-full items-center justify-center rounded-2xl border border-paper-300 bg-paper-100 text-sm text-ink-600`}>
        Cargando mapa...
      </div>
    );
  }

  return (
    <div className={`relative isolate ${alto} w-full overflow-hidden rounded-2xl border border-paper-300 ${CLASES_CONTENEDOR_MAPA}`}>
      <MapContainer
        center={CENTRO_CUENCA_DEL_SALADO}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom={false}
        style={{ background: "var(--color-paper-100)" }}
      >
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <AutoEncuadre lotes={lotes} />
        {!soloLectura && <EditorDibujo onLoteDibujado={onLoteDibujado} />}

        {lotes.map((lote) => (
          <Polygon
            key={lote.id}
            positions={lote.anillo.map((c) => [c.lat, c.lon])}
            pathOptions={{
              color: colorPorRiesgo(scorePorLote?.[lote.id]),
              weight: 2,
              fillOpacity: 0.32,
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-ink-950">{lote.nombre}</p>
                <p className="text-xs text-ink-600">
                  {lote.tipoUso.toLowerCase()} · se anegó {lote.antecedentesAnegamientoUltimos10Anios ?? 0} de los últimos 10 años
                </p>
                {/* La palabra y no el valor 0-1: el popup de Leaflet recorta lo que se sale de
                    su caja, asi que aca va el dato pelado y la aclaracion vive en el detalle. */}
                {scorePorLote?.[lote.id] !== undefined && (
                  <p className="text-xs font-medium" style={{ color: colorPorRiesgo(scorePorLote[lote.id]) }}>
                    Riesgo {nivelRiesgo(scorePorLote[lote.id])}
                  </p>
                )}
                <Link
                  href={`/establecimientos/${establecimientoId}/lotes/${lote.id}`}
                  className="inline-block text-xs font-medium text-brand-700 underline underline-offset-2"
                >
                  Ver detalle y cultivos →
                </Link>
              </div>
            </Popup>
          </Polygon>
        ))}

        {activos
          .filter((a) => a.ubicacion)
          .map((activo) => {
            // Un galpon o un camino no se arrastran: es la misma distincion que gobierna la
            // priorizacion. El pin fijo lo dice antes del intento, no despues de fallar.
            const arrastrable = Boolean(onActivoMovido) && activo.movilidad === "MOVIBLE";
            return (
              <Marker
                key={activo.id}
                position={[activo.ubicacion!.lat, activo.ubicacion!.lon]}
                icon={iconoActivo(activo.tipo)}
                draggable={arrastrable}
                eventHandlers={
                  arrastrable
                    ? {
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng();
                          onActivoMovido?.(activo, { lat, lon: lng });
                        },
                      }
                    : undefined
                }
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-ink-950">{activo.nombre}</p>
                    <p className="text-xs text-ink-600">
                      {ETIQUETA_TIPO_ACTIVO[activo.tipo]} · {activo.movilidad === "MOVIBLE" ? "movible" : "fijo"}
                    </p>
                    <p className="text-xs text-ink-600">USD {activo.valorEstimado.toLocaleString("es-AR")}</p>
                    {onActivoMovido &&
                      (arrastrable ? (
                        <p className="text-[11px] text-ink-600">Arrastra el marcador para ajustar su posicion.</p>
                      ) : (
                        <p className="text-[11px] text-ink-600">
                          Es un activo fijo, por eso no se arrastra. Si en realidad se puede trasladar, marcalo como
                          movible al editarlo.
                        </p>
                      ))}
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
