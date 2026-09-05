"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM, cargarGeoman } from "@/lib/mapa-utils";
import type { Activo, Coordenada, CultivoImplantado, Lote, TipoActivo } from "@/lib/types";

const COLOR_LOTE = "var(--color-brand-600)";
const COLORES_CULTIVO = ["#6b8f3a", "#c2703d", "#3a5a6b", "#8a5a2f", "#5a4a6b"];

const ETIQUETA_MARGEN: Record<string, string> = {
  NINGUNO: "sin margen de accion",
  COSECHA_ANTICIPADA: "cosecha anticipada",
  RESIEMBRA: "resiembra",
};

function colorCultivo(index: number): string {
  return COLORES_CULTIVO[index % COLORES_CULTIVO.length];
}

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

/** Encuadra el mapa al lote apenas monta (una vez), en vez de arrancar en el centro generico. */
function EncuadreLote({ lote }: { lote: Lote }) {
  const map = useMap();
  const encuadrado = useRef(false);

  useEffect(() => {
    if (encuadrado.current) return;
    const puntos = lote.anillo.map((c) => [c.lat, c.lon] as [number, number]);
    map.fitBounds(puntos, { padding: [40, 40], maxZoom: 18 });
    encuadrado.current = true;
  }, [lote, map]);

  return null;
}

/** Mismo patron que EditorDibujo de MapaEstablecimiento, pero solo dibuja poligonos de zona de cultivo. */
function EditorDelLote({
  onZonaDibujada,
  onActivoUbicado,
  autoIniciar,
}: {
  onZonaDibujada: (anillo: Coordenada[]) => void;
  onActivoUbicado: (coordenada: Coordenada) => void;
  autoIniciar: boolean;
}) {
  const map = useMap();
  const [modo, setModo] = useState<"ninguno" | "cultivo" | "activo">("ninguno");
  const capaEnEdicion = useRef<L.Polygon | L.Marker | null>(null);
  const autoIniciado = useRef(false);
  const dibujando = modo !== "ninguno";

  useEffect(() => {
    map.pm.setGlobalOptions({
      snappable: true,
      templineStyle: { color: "#6b8f3a" },
      hintlineStyle: { color: "#6b8f3a", dashArray: [4, 4] },
    });

    const alCrear = (e: { shape: string; layer: L.Layer }) => {
      map.pm.disableDraw();
      capaEnEdicion.current = e.layer as L.Polygon | L.Marker;

      if (e.shape === "Polygon" && e.layer instanceof L.Polygon) {
        e.layer.setStyle({ color: "#6b8f3a", dashArray: "5 5", fillOpacity: 0.15 });
        (e.layer as L.Polygon & { pm: { enable: (o?: object) => void } }).pm.enable({ draggable: true });
        setModo("cultivo");
      } else if (e.shape === "Marker" && e.layer instanceof L.Marker) {
        e.layer.dragging?.enable();
        setModo("activo");
      }
    };

    map.on("pm:create", alCrear);
    return () => {
      map.off("pm:create", alCrear);
    };
  }, [map]);

  // Si se llega desde "+ Cultivo" en la lista de lotes, arranca a dibujar directo sin un click extra.
  useEffect(() => {
    if (autoIniciar && !autoIniciado.current) {
      autoIniciado.current = true;
      map.pm.enableDraw("Polygon");
      setModo("cultivo");
    }
  }, [autoIniciar, map]);

  const cancelar = () => {
    map.pm.disableDraw();
    if (capaEnEdicion.current) {
      map.removeLayer(capaEnEdicion.current);
      capaEnEdicion.current = null;
    }
    setModo("ninguno");
  };

  const confirmar = () => {
    const capa = capaEnEdicion.current;
    if (!capa) return;

    if (modo === "cultivo" && capa instanceof L.Polygon) {
      const anillo = (capa.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lon: p.lng }));
      map.removeLayer(capa);
      capaEnEdicion.current = null;
      setModo("ninguno");
      onZonaDibujada(anillo);
    } else if (modo === "activo" && capa instanceof L.Marker) {
      const posicion = capa.getLatLng();
      map.removeLayer(capa);
      capaEnEdicion.current = null;
      setModo("ninguno");
      onActivoUbicado({ lat: posicion.lat, lon: posicion.lng });
    }
  };

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
      {!dibujando && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              map.pm.enableDraw("Polygon");
              setModo("cultivo");
            }}
            className="rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-medium text-paper-50 shadow-sm hover:bg-brand-600"
          >
            + Zona de cultivo
          </button>
          <button
            onClick={() => {
              map.pm.enableDraw("Marker");
              setModo("activo");
            }}
            className="rounded-full border border-clay-500 bg-paper-50 px-3.5 py-1.5 text-xs font-medium text-clay-600 shadow-sm hover:bg-clay-100"
          >
            + Activo
          </button>
        </div>
      )}
      {dibujando && (
        <div className="flex flex-col items-end gap-1.5 rounded-xl border border-paper-300 bg-paper-50 p-2.5 shadow-lg">
          <p className="max-w-[11rem] text-right text-xs text-ink-600">
            {modo === "cultivo"
              ? "Dibuja el area sembrada. Doble click para terminar."
              : "Arrastra el marcador al punto exacto del activo."}
          </p>
          <div className="flex gap-1.5">
            <button onClick={cancelar} className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700">
              Cancelar
            </button>
            <button onClick={confirmar} className="rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-paper-50">
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  lote: Lote;
  cultivos: CultivoImplantado[];
  activos: Activo[];
  onZonaDibujada: (anillo: Coordenada[]) => void;
  onActivoUbicado: (coordenada: Coordenada) => void;
  onEditarCultivo: (cultivo: CultivoImplantado) => void;
  onEditarActivo: (activo: Activo) => void;
  /** Se dispara al soltar el marcador de un activo: ajusta su posicion exacta dentro del lote. */
  onActivoMovido: (activo: Activo, coordenada: Coordenada) => void;
  /** true si se llego con "+ Cultivo" desde la lista de lotes: arranca a dibujar sin un click extra. */
  autoDibujar?: boolean;
}

/** Mapa grande y enfocado a un solo lote (vista de detalle): el lote de referencia + sus zonas de cultivo dibujables. */
export function MapaLote({
  lote,
  cultivos,
  activos,
  onZonaDibujada,
  onActivoUbicado,
  onEditarCultivo,
  onEditarActivo,
  onActivoMovido,
  autoDibujar = false,
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
      <div className="flex h-[70vh] w-full items-center justify-center rounded-2xl border border-paper-300 bg-paper-100 text-sm text-ink-600">
        Cargando mapa...
      </div>
    );
  }

  return (
    <div className={`relative isolate h-[70vh] w-full overflow-hidden rounded-2xl border border-paper-300 ${CLASES_CONTENEDOR_MAPA}`}>
      <MapContainer center={[lote.anillo[0].lat, lote.anillo[0].lon]} zoom={16} className="h-full w-full" style={{ background: "var(--color-paper-100)" }}>
        <TileLayer attribution={ATRIBUCION_OSM} url={URL_TILES_OSM} />
        <EncuadreLote lote={lote} />
        <EditorDelLote
          onZonaDibujada={onZonaDibujada}
          onActivoUbicado={onActivoUbicado}
          autoIniciar={autoDibujar}
        />

        <Polygon
          positions={lote.anillo.map((c) => [c.lat, c.lon])}
          pathOptions={{ color: COLOR_LOTE, weight: 2, fillOpacity: 0.08, dashArray: "6 4" }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-ink-950">{lote.nombre}</p>
              <p className="text-xs text-ink-600">
                {lote.tipoUso.toLowerCase()} · antecedentes: {lote.antecedentesAnegamientoUltimos10Anios ?? 0}/10 anios
              </p>
              <p className="text-xs text-ink-600">
                {cultivos.length === 0 ? "Sin zonas de cultivo todavia" : `${cultivos.length} zona(s) de cultivo`}
              </p>
            </div>
          </Popup>
        </Polygon>

        {cultivos.map((cultivo, i) => (
            <Polygon
              key={cultivo.id}
              positions={cultivo.anillo.map((c) => [c.lat, c.lon])}
              pathOptions={{ color: colorCultivo(i), weight: 2, fillOpacity: 0.35 }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-ink-950">{cultivo.tipoCultivo}</p>
                  <p className="text-xs text-ink-600">
                    {cultivo.estadoFenologico} · sembrado {new Date(cultivo.fechaSiembra).toLocaleDateString("es-AR")}
                  </p>
                  <p className="text-xs text-ink-600">{ETIQUETA_MARGEN[cultivo.margenAccion]}</p>
                  <button
                    onClick={() => onEditarCultivo(cultivo)}
                    className="text-xs font-medium text-brand-700 underline underline-offset-2"
                  >
                    Editar esta zona →
                  </button>
                </div>
              </Popup>
            </Polygon>
        ))}

        {activos
          .filter((activo) => activo.ubicacion)
          .map((activo) => {
            // Solo los MOVIBLE se arrastran. Antes se arrastraban todos: el backend lo dejaba
            // pasar porque no cambia el lote, pero mover un galpon en el mapa es mentirle al
            // usuario sobre lo que representa el pin.
            const arrastrable = activo.movilidad === "MOVIBLE";
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
                          onActivoMovido(activo, { lat, lon: lng });
                        },
                      }
                    : undefined
                }
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-ink-950">{activo.nombre}</p>
                    <p className="text-xs text-ink-600">
                      {activo.movilidad === "MOVIBLE" ? "movible" : "fijo"} · USD{" "}
                      {activo.valorEstimado.toLocaleString("es-AR")}
                    </p>
                    {arrastrable ? (
                      <p className="text-[11px] text-ink-600">Arrastra el marcador para ajustar su posicion.</p>
                    ) : (
                      <p className="text-[11px] text-ink-600">
                        Es un activo fijo, por eso no se arrastra. Si en realidad se puede trasladar, marcalo como
                        movible aca abajo.
                      </p>
                    )}
                    <button
                      onClick={() => onEditarActivo(activo)}
                      className="text-xs font-medium text-brand-700 underline underline-offset-2"
                    >
                      Editar activo →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
