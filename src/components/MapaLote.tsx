"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Pane, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { ATRIBUCION_OSM, CLASES_CONTENEDOR_MAPA, URL_TILES_OSM, cargarGeoman } from "@/lib/mapa-utils";
import {
  puntoDentroDelLote,
  validarPoligonoDibujado,
  type ZonaExistente,
} from "@/lib/reglas-de-dibujo";
import type { Activo, Coordenada, CultivoImplantado, Lote, TipoActivo, ZonaSuelo } from "@/lib/types";

const COLOR_LOTE = "var(--color-brand-600)";
// El suelo se dibuja en un tono terroso y por debajo de los cultivos: describe el sustrato, no lo
// que esta implantado arriba.
const COLOR_ZONA_SUELO = "#8a6b3f";
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
  lote,
  cultivos,
  zonasSuelo,
  onZonaDibujada,
  onActivoUbicado,
  onZonaSueloDibujada,
  onRechazo,
  autoIniciar,
  autoDibujarSuelo,
}: {
  lote: Lote;
  cultivos: CultivoImplantado[];
  zonasSuelo: ZonaSuelo[];
  onZonaDibujada: (anillo: Coordenada[]) => void;
  onActivoUbicado: (coordenada: Coordenada) => void;
  onZonaSueloDibujada?: (anillo: Coordenada[]) => void;
  onRechazo: (motivo: string) => void;
  autoIniciar: boolean;
  autoDibujarSuelo?: boolean;
}) {
  const map = useMap();
  const [avisoVertice, setAvisoVertice] = useState<string | null>(null);
  const [modo, setModo] = useState<"ninguno" | "cultivo" | "activo" | "suelo">("ninguno");
  // Que se esta dibujando cuando geoman avisa que termino un poligono: cultivo y suelo usan la
  // misma herramienta, asi que el modo hay que fijarlo ANTES de habilitar el dibujo.
  const intencion = useRef<"cultivo" | "suelo">("cultivo");
  const capaEnEdicion = useRef<L.Polygon | L.Marker | null>(null);
  const autoIniciado = useRef(false);
  const sueloIniciado = useRef(false);
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
        const esSuelo = intencion.current === "suelo";
        e.layer.setStyle({
          color: esSuelo ? COLOR_ZONA_SUELO : "#6b8f3a",
          dashArray: "5 5",
          fillOpacity: 0.15,
        });
        (e.layer as L.Polygon & { pm: { enable: (o?: object) => void } }).pm.enable({ draggable: true });
        setModo(esSuelo ? "suelo" : "cultivo");
      } else if (e.shape === "Marker" && e.layer instanceof L.Marker) {
        e.layer.dragging?.enable();
        setModo("activo");
      }
    };

    // Mientras dibuja: un vertice fuera del alambrado se descarta en el acto. Es la unica forma
    // de que el usuario entienda el limite MIENTRAS traza, en vez de enterarse al guardar.
    const alAgregarVertice = ((e: L.LeafletEvent & { marker?: L.Marker }) => {
      if (!e.marker) return;
      if (intencion.current !== "cultivo" && intencion.current !== "suelo") return;
      const punto = e.marker.getLatLng();
      if (puntoDentroDelLote({ lat: punto.lat, lon: punto.lng }, lote.anillo)) {
        setAvisoVertice(null);
        return;
      }
      // `_removeLastVertex` es la API interna de geoman para deshacer el ultimo punto: no expone
      // una publica para rechazar un vertice recien puesto.
      const dibujo = map.pm.Draw.Polygon as unknown as { _removeLastVertex?: () => void };
      dibujo._removeLastVertex?.();
      setAvisoVertice("Ese punto cae fuera del lote. El dibujo tiene que quedar adentro del alambrado.");
      // Los tipos de Leaflet no conocen los eventos `pm:*` de geoman ni su payload.
    }) as L.LeafletEventHandlerFn;

    map.on("pm:create", alCrear);
    map.on("pm:vertexadded", alAgregarVertice);
    return () => {
      map.off("pm:create", alCrear);
      map.off("pm:vertexadded", alAgregarVertice);
    };
  }, [map, lote]);

  // Si se llega desde "+ Cultivo" en la lista de lotes, arranca a dibujar directo sin un click extra.
  useEffect(() => {
    if (autoIniciar && !autoIniciado.current) {
      autoIniciado.current = true;
      intencion.current = "cultivo";
      map.pm.enableDraw("Polygon");
      setModo("cultivo");
    }
  }, [autoIniciar, map]);

  // Se llega desde "Dibujar un sector" del panel de suelo: arranca a dibujar sin un click extra.
  // El guard es un ref y no el estado `modo` para que cancelar el dibujo no lo reabra en bucle;
  // se rearma cuando el panel vuelve a bajar la bandera.
  useEffect(() => {
    if (!autoDibujarSuelo) {
      sueloIniciado.current = false;
      return;
    }
    if (sueloIniciado.current) return;
    sueloIniciado.current = true;
    intencion.current = "suelo";
    map.pm.enableDraw("Polygon");
    setModo("suelo");
  }, [autoDibujarSuelo, map]);

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

    if ((modo === "cultivo" || modo === "suelo") && capa instanceof L.Polygon) {
      const anillo = (capa.getLatLngs()[0] as L.LatLng[]).map((p) => ({ lat: p.lat, lon: p.lng }));
      const eraSuelo = modo === "suelo";

      // El poligono ya terminado se valida entero: el bloqueo por vertice no alcanza a ver el
      // solape con otra zona ni que el trazo se cruce a si mismo.
      const existentes: ZonaExistente[] = eraSuelo
        ? zonasSuelo.map((z) => ({ id: z.id, nombre: z.nombre, anillo: z.geometria }))
        : cultivos.map((c) => ({ id: c.id, nombre: c.tipoCultivo, anillo: c.anillo }));
      const motivo = validarPoligonoDibujado(
        anillo, lote.anillo, existentes, eraSuelo ? "sector de suelo" : "cultivo",
      );
      if (motivo) {
        // La capa queda en pantalla y editable: el usuario corrige los vertices en vez de
        // volver a dibujar desde cero.
        onRechazo(motivo);
        return;
      }

      map.removeLayer(capa);
      capaEnEdicion.current = null;
      setModo("ninguno");
      setAvisoVertice(null);
      if (eraSuelo) {
        onZonaSueloDibujada?.(anillo);
      } else {
        onZonaDibujada(anillo);
      }
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
          {onZonaSueloDibujada && (
            <button
              onClick={() => {
                intencion.current = "suelo";
                map.pm.enableDraw("Polygon");
                setModo("suelo");
              }}
              style={{ borderColor: COLOR_ZONA_SUELO, color: COLOR_ZONA_SUELO }}
              className="rounded-full border bg-paper-50 px-3.5 py-1.5 text-xs font-medium shadow-sm hover:bg-paper-200"
            >
              + Sector de suelo
            </button>
          )}
        </div>
      )}
      {dibujando && (
        <div className="flex flex-col items-end gap-1.5 rounded-xl border border-paper-300 bg-paper-50 p-2.5 shadow-lg">
          <p className="max-w-[11rem] text-right text-xs text-ink-600">
            {modo === "cultivo" && "Dibuja el area sembrada. Doble click para terminar."}
            {modo === "suelo" &&
              "Dibuja el sector con un mismo tipo de suelo (un bajo, una loma). Doble click para terminar."}
            {modo === "activo" && "Arrastra el marcador al punto exacto del activo."}
          </p>
          {avisoVertice && (
            <p className="max-w-[11rem] rounded-lg bg-risk-alto-bg px-2 py-1.5 text-right text-xs leading-snug text-risk-alto">
              {avisoVertice}
            </p>
          )}
          <p className="hidden">
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
  /** Sectores de suelo ya cargados, para verlos sobre el lote. */
  zonasSuelo?: ZonaSuelo[];
  /** Si falta, el boton de dibujar suelo no aparece. */
  onZonaSueloDibujada?: (anillo: Coordenada[]) => void;
  /** true cuando se pidio dibujar un sector desde el panel de suelo. */
  autoDibujarSuelo?: boolean;
  /** Se dispara cuando el dibujo terminado viola una regla: sale del lote, se pisa, o se cruza. */
  onRechazo: (motivo: string) => void;
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
  zonasSuelo = [],
  onZonaSueloDibujada,
  onRechazo,
  autoDibujarSuelo = false,
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
          lote={lote}
          cultivos={cultivos}
          zonasSuelo={zonasSuelo}
          onZonaDibujada={onZonaDibujada}
          onActivoUbicado={onActivoUbicado}
          onZonaSueloDibujada={onZonaSueloDibujada}
          onRechazo={onRechazo}
          autoIniciar={autoDibujar}
          autoDibujarSuelo={autoDibujarSuelo}
        />

        {/*
          En un pane propio por DEBAJO del overlayPane de Leaflet (zIndex 400).

          Sin esto, un sector de suelo del tamano del lote se come los clicks de las zonas de
          cultivo y de los activos que estan adentro: el relleno del poligono captura el evento y
          el popup para editar el cultivo se vuelve inalcanzable. El suelo es el sustrato, tiene
          que quedar siempre atras de lo que esta implantado arriba.
        */}
        <Pane name="zonas-suelo" style={{ zIndex: 350 }}>
          {zonasSuelo.map((zona) => (
          <Polygon
            key={zona.id}
            positions={zona.geometria.map((c) => [c.lat, c.lon])}
            pathOptions={{ color: COLOR_ZONA_SUELO, weight: 1.5, fillOpacity: 0.18, dashArray: "3 3" }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-ink-950">{zona.nombre}</p>
                <p className="text-xs text-ink-600">
                  {zona.arenaPct != null
                    ? `${zona.arenaPct}% arena · ${zona.limoPct}% limo · ${zona.arcillaPct}% arcilla`
                    : "textura sin cargar"}
                </p>
                <p className="text-xs text-ink-600">
                  {zona.napaCm != null ? `napa a ${zona.napaCm} cm` : "napa sin cargar"}
                </p>
              </div>
            </Popup>
          </Polygon>
          ))}
        </Pane>

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
