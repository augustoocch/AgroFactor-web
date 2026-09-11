"use client";

/**
 * Campos de formulario reutilizables.
 *
 * Existen para que los formularios largos se lean como una lista de datos y no como un muro de
 * markup: cada campo trae su etiqueta y su ayuda al lado, que es donde el usuario la necesita.
 */

const CLASES_CAMPO =
  "mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500";

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-700">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-0.5 text-[10px] leading-tight text-ink-600">{ayuda}</p>}
    </div>
  );
}

export function Texto({
  etiqueta,
  ayuda,
  valor,
  onChange,
  placeholder,
  tipo = "text",
}: {
  etiqueta: string;
  ayuda?: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: "text" | "number" | "date";
}) {
  // Ningun campo numerico de este formulario (valor, cantidad, año, altura) tiene sentido en
  // negativo — se rechaza en el origen, no con un `min` decorativo que el backend igual va a
  // rechazar despues de que el usuario ya completo todo el formulario.
  const manejarCambio = (v: string) => {
    if (tipo === "number" && v.includes("-")) return;
    onChange(v);
  };

  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <input
        type={tipo}
        min={tipo === "number" ? 0 : undefined}
        value={valor}
        onChange={(e) => manejarCambio(e.target.value)}
        placeholder={placeholder}
        className={CLASES_CAMPO}
      />
    </Campo>
  );
}

export function Opciones({
  etiqueta,
  ayuda,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: string;
  opciones: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={CLASES_CAMPO}>
        <option value="">Sin especificar</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Campo>
  );
}
