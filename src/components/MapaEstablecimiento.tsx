"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM, cargarGeoman, colorPorRiesgo } from "@/lib/mapa-utils";
import { nivelRiesgo } from "@/lib/explicar-riesgo";
import { Icono } from "@/components/Icono";
import type { VistaPreviaLote } from "@/components/CargaPorCoordenadas";
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

/**
 * Sin lotes todavia, abre sobre el partido del establecimiento (centroide oficial, ver
 * /catalogo/centroide) en vez de un punto fijo de la cuenca: el primer lote se dibuja ahi.
 */
function CentrarEnPartido({ centro, hayLotes }: { centro?: Coordenada | null; hayLotes: boolean }) {
  const map = useMap();
  const centrado = useRef(false);

  useEffect(() => {
    if (centrado.current || hayLotes || !centro) return;
    map.setView([centro.lat, centro.lon], 11);
    centrado.current = true;
  }, [centro, hayLotes, map]);

  return null;
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

/**
 * Leaflet calcula el tamaño del mapa una sola vez: cuando el panel de coordenadas aparece al
 * costado y el mapa se angosta, sin esto quedan franjas grises y los clicks caen corridos.
 */
function AjustarAlTamano() {
  const map = useMap();
  useEffect(() => {
    const observador = new ResizeObserver(() => map.invalidateSize());
    observador.observe(map.getContainer());
    return () => observador.disconnect();
  }, [map]);
  return null;
}

function iconoVertice(numero: number, resaltado: boolean): L.DivIcon {
  const fondo = resaltado ? "#8a4a22" : "#c2703d";
  const tamano = resaltado ? 26 : 22;
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${tamano}px;height:${tamano}px;border-radius:9999px;background:${fondo};color:white;font:600 11px ui-monospace,monospace;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45)">${numero}</span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
  });
}

/**
 * Lo que se va cargando por coordenadas: cada vertice con el numero de su renglon, y el poligono
 * cuando hay tres. Si el poligono tiene un error (lados cruzados, un digito que lo estira 40 km)
 * se dibuja gris: el problema se ve en el mapa, no solo en el texto.
 */
function VistaPreviaCoordenadas({ vista }: { vista: VistaPreviaLote }) {
  const map = useMap();
  const puntos = vista.vertices.filter((v): v is Coordenada => v !== null);
  const firma = puntos.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(";");

  // Se encuadra un rato despues de que se deja de escribir, para que el mapa no salte con cada digito.
  useEffect(() => {
    if (!firma) return;
    const espera = setTimeout(() => {
      const limites = firma.split(";").map((p) => p.split(",").map(Number) as [number, number]);
      if (limites.length === 1) map.setView(limites[0], Math.max(map.getZoom(), 14));
      else map.fitBounds(limites, { padding: [48, 48], maxZoom: 16 });
    }, 600);
    return () => clearTimeout(espera);
  }, [firma, map]);

  return (
    <>
      {vista.anillo && (
        <Polygon
          positions={vista.anillo.map((c) => [c.lat, c.lon])}
          pathOptions={
            vista.valido
              ? { color: "#c2703d", weight: 2, dashArray: "5 5", fillOpacity: 0.15 }
              : { color: "#6b6b5a", weight: 2, dashArray: "2 6", fillOpacity: 0.05 }
          }
        />
      )}
      {vista.vertices.map((v, i) =>
        v ? (
          <Marker
            key={i}
            position={[v.lat, v.lon]}
            icon={iconoVertice(i + 1, vista.resaltado === i)}
            zIndexOffset={vista.resaltado === i ? 1000 : 0}
            interactive={false}
          />
        ) : null,
      )}
    </>
  );
}

type ModoEdicion = "ninguno" | "elegir" | "lote";

interface Props {
  establecimientoId: string;
  lotes: Lote[];
  activos: Activo[];
  scorePorLote?: Record<string, number>;
  onLoteDibujado: (anillo: Coordenada[]) => void;
  /** Segunda opcion de "+ Lote": abre la carga por coordenadas (vive fuera del mapa). */
  onCargarPorCoordenadas?: () => void;
  /** Vertices que se estan cargando por coordenadas. Mientras haya, el editor de dibujo se oculta. */
  vistaPrevia?: VistaPreviaLote | null;
  /** Se dispara al soltar el pin de un activo MOVIBLE. Sin esto los pines quedan fijos. */
  onActivoMovido?: (activo: Activo, coordenada: Coordenada) => void;
  /** true en la pantalla de Lotes: se ve el conjunto pero no se dibuja nada nuevo desde ahi. */
  soloLectura?: boolean;
  alto?: string;
  /** Centroide del partido del establecimiento: donde abrir el mapa si todavia no hay lotes. */
  centroPartido?: Coordenada | null;
}

/**
 * Editor de lotes sobre leaflet-geoman: los vertices se arrastran/insertan/borran antes de
 * confirmar (no un click-y-reza), y al terminar se abre NuevoLoteForm en vez de guardar directo.
 *
 * Solo lotes: los cultivos y los activos se cargan dentro de cada lote, en su propia pantalla,
 * para que la relacion con el lote la defina la accion del usuario y no la posicion del click.
 */
function EditorDibujo({ onLoteDibujado, onCargarPorCoordenadas }: Pick<Props, "onLoteDibujado" | "onCargarPorCoordenadas">) {
  const map = useMap();
  const [modo, setModo] = useState<ModoEdicion>("ninguno");
  const capaEnEdicion = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (modo !== "elegir") return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setModo("ninguno");
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [modo]);

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
      {(modo === "ninguno" || modo === "elegir") && (
        <button
          onClick={() => setModo(modo === "elegir" ? "ninguno" : "elegir")}
          aria-expanded={modo === "elegir"}
          aria-haspopup="menu"
          className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-medium text-paper-50 shadow-sm hover:bg-brand-600"
        >
          <Icono nombre={modo === "elegir" ? "cerrar" : "mas"} className="h-3.5 w-3.5" />
          Lote
        </button>
      )}

      {modo === "elegir" && (
        <div role="menu" aria-label="Cómo cargar el lote" className="w-72 overflow-hidden rounded-xl border border-paper-300 bg-paper-50 shadow-lg">
          <OpcionAlta
            icono="dibujar"
            titulo="Dibujar en el mapa"
            detalle="Marcá cada esquina con un clic y ajustá los vértices arrastrándolos."
            onElegir={() => {
              map.pm.enableDraw("Polygon");
              setModo("lote");
            }}
          />
          {onCargarPorCoordenadas && (
            <OpcionAlta
              icono="coordenadas"
              titulo="Ingresar coordenadas"
              detalle="Si tenés los vértices de un plano de mensura, un GPS o Google Earth."
              onElegir={() => {
                setModo("ninguno");
                onCargarPorCoordenadas();
              }}
            />
          )}
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

function OpcionAlta({ icono, titulo, detalle, onElegir }: { icono: "dibujar" | "coordenadas"; titulo: string; detalle: string; onElegir: () => void }) {
  return (
    <button role="menuitem" onClick={onElegir} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-100 [&+&]:border-t [&+&]:border-paper-200">
      <span className="mt-0.5 text-brand-700">
        <Icono nombre={icono} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink-950">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-600">{detalle}</span>
      </span>
    </button>
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
  onCargarPorCoordenadas,
  vistaPrevia,
  onActivoMovido,
  soloLectura = false,
  alto = "h-[55vh]",
  centroPartido,
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
        <CentrarEnPartido centro={centroPartido} hayLotes={lotes.length > 0} />
        <AjustarAlTamano />
        {!soloLectura && !vistaPrevia && (
          <EditorDibujo onLoteDibujado={onLoteDibujado} onCargarPorCoordenadas={onCargarPorCoordenadas} />
        )}
        {vistaPrevia && <VistaPreviaCoordenadas vista={vistaPrevia} />}

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
