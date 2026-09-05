"use client";

import { useMemo, useState } from "react";
import { PARTIDOS_SUGERIDOS } from "@/lib/partidos";

interface Props {
  valorPartido: string;
  onCambiarPartido: (partido: string) => void;
  onSeleccionarProvincia: (provincia: string) => void;
}

/** Autocompletado sobre partidos citados en la investigacion del TFI, con texto libre como fallback (ver lib/partidos.ts sobre por que no se uso una API externa para esto). */
export function PartidoCombobox({ valorPartido, onCambiarPartido, onSeleccionarProvincia }: Props) {
  const [abierto, setAbierto] = useState(false);

  const sugerencias = useMemo(() => {
    const q = valorPartido.trim().toLowerCase();
    if (!q) return PARTIDOS_SUGERIDOS.slice(0, 6);
    return PARTIDOS_SUGERIDOS.filter((p) => p.partido.toLowerCase().includes(q)).slice(0, 6);
  }, [valorPartido]);

  return (
    <div className="relative">
      <input
        value={valorPartido}
        onChange={(e) => onCambiarPartido(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        placeholder="Bolívar, 9 de Julio, ..."
        autoComplete="off"
        className="w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
      />
      {abierto && sugerencias.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-paper-300 bg-paper-50 shadow-lg">
          {sugerencias.map((s) => (
            <li key={`${s.partido}-${s.provincia}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCambiarPartido(s.partido);
                  onSeleccionarProvincia(s.provincia);
                  setAbierto(false);
                }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-brand-100/40"
              >
                <span className="text-ink-950">{s.partido}</span>
                <span className="text-xs text-ink-600">{s.provincia}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
