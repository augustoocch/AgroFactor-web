"use client";

/**
 * Una linea de aclaracion que aparece al pasar el mouse (o al tabular) sobre un dato.
 *
 * Existe en vez de `title=""` porque el tooltip nativo tarda cerca de un segundo en aparecer y no
 * se puede leer con el teclado: para un dato que sin la aclaracion no se entiende, eso equivale a
 * no tenerla. Es para UNA linea, dos como maximo; si hace falta mas, el dato necesita otra cosa
 * que un tooltip.
 *
 * El grupo va nombrado (`group/tip`): con `group` a secas, cualquier tarjeta ancestro que ya use
 * `group` -hay varias- abriria el globo al pasar el mouse por cualquier parte de esa tarjeta.
 */
export function Tooltip({
  texto,
  posicion = "abajo",
  subrayado = true,
  children,
}: {
  texto: string;
  /** Por defecto abajo: la mayoria de estos datos viven en paneles con scroll, donde un globo
      que sale para arriba en la primera fila queda cortado. */
  posicion?: "arriba" | "abajo";
  /** El punteado marca que hay algo que leer. Sobra cuando el disparador ya es un chip o un
      icono con forma propia. */
  subrayado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex items-center">
      <span
        tabIndex={0}
        className={`cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          subrayado ? "border-b border-dotted border-ink-400" : ""
        }`}
      >
        {children}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-0 z-30 w-60 rounded-lg bg-ink-950 px-2.5 py-1.5 text-[11px] leading-snug text-paper-50 opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          posicion === "arriba" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        }`}
      >
        {texto}
      </span>
    </span>
  );
}
