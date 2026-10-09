import { grupoDe } from "@/lib/navegacion";

/**
 * Encabezado unico de cada pantalla del establecimiento.
 *
 * Tres piezas y siempre en el mismo orden: el momento (antetitulo, sale del grupo del menu), que
 * es la pantalla (titulo) y para que sirve (una sola oracion). Todo lo que explica COMO se
 * calcula algo no va aca: va en el panel lateral de referencia que se abre con `ayuda`, para que
 * quien no lo necesita no tenga que leerlo para llegar al dato.
 *
 * Antes cada panel traia su propio antetitulo en mayusculas, su titulo y su parrafo, y una
 * pantalla con cinco paneles tenia cinco encabezados compitiendo.
 */
export function EncabezadoPantalla({
  segmento,
  antetitulo,
  titulo,
  descripcion,
  ayuda,
  acciones,
}: {
  /** Segmento de la ruta: define el antetitulo si no se pasa uno explicito. */
  segmento?: string;
  antetitulo?: string;
  titulo: string;
  descripcion?: React.ReactNode;
  /** Disparador del panel de referencia (un `InfoAside` con etiqueta). */
  ayuda?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  const eyebrow = antetitulo ?? (segmento !== undefined ? grupoDe(segmento) : null);

  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-paper-300 pb-6">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.08em] text-brand-600">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl font-medium leading-tight text-ink-950">{titulo}</h1>
        {descripcion && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-600">{descripcion}</p>}
        {ayuda && <div className="mt-3">{ayuda}</div>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

/** Titulo de una seccion dentro de una pantalla: un nivel por debajo del encabezado. */
export function TituloSeccion({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h2 className="font-display text-lg font-medium text-ink-950">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-ink-600">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
