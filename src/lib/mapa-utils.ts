import L from "leaflet";

/**
 * leaflet-geoman-free se distribuye como un bundle viejo estilo "incluir con <script> despues de
 * leaflet.js": referencia la variable global `L` directamente (510 referencias, ni una sola
 * declaracion propia) en vez de importar el paquete `leaflet`. Con Next.js no existe ese global
 * salvo que lo creemos nosotros ANTES de que el bundle de geoman se evalue -y un import estatico
 * se evalua antes que cualquier asignacion escrita despues en el archivo (los imports se
 * hoistean), asi que la unica forma correcta es cargarlo dinamicamente ya con `window.L` seteado.
 *
 * Ademas geoman se engancha a Leaflet via `L.Map.addInitHook(...)`: ese hook solo corre para
 * mapas creados DESPUES de que el hook se registro. Por eso ningun `<MapContainer>` puede
 * renderizarse hasta que este import haya terminado -si no, `map.pm` queda undefined para
 * siempre en ese mapa aunque geoman ya haya cargado. Singleton a nivel de modulo: se carga una
 * sola vez sin importar cuantos mapas (Resumen, detalle de lote) lo pidan.
 */
let geomanCargando: Promise<void> | null = null;
export function cargarGeoman(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!geomanCargando) {
    (window as unknown as { L: typeof L }).L = L;
    repararIconoPorDefecto();
    geomanCargando = import("@geoman-io/leaflet-geoman-free").then(() => undefined);
  }
  return geomanCargando;
}

/**
 * El icono de marker por defecto de Leaflet referencia rutas relativas a un bundle armado con
 * <script> clasico (`images/marker-icon.png`); con Next.js esas rutas no resuelven a nada y el
 * icono se ve roto. Esto no es cosmetico solo de nuestro codigo: geoman tambien usa el icono por
 * defecto mientras se esta dibujando un marcador (antes de que nuestro `pm:create` lo reemplace
 * por el circulo custom), asi que hay que arreglarlo a nivel global antes de que geoman cargue.
 */
function repararIconoPorDefecto() {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export function colorPorRiesgo(score?: number): string {
  if (score === undefined) return "var(--color-ink-400)";
  if (score >= 0.66) return "var(--color-risk-alto)";
  if (score >= 0.33) return "var(--color-risk-medio)";
  return "var(--color-risk-bajo)";
}

/** Clases Tailwind del basemap OSM despaturado (ver MapaEstablecimiento para el porque). */
export const CLASES_CONTENEDOR_MAPA =
  "[&_.leaflet-control-attribution]:bg-paper-50/80 [&_.leaflet-control-attribution]:text-[10px] [&_.leaflet-tile]:![filter:grayscale(0.55)_sepia(0.12)_brightness(1.06)_contrast(0.92)]";

export const ATRIBUCION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const URL_TILES_OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
