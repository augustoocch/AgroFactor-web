"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { easeOutExpo } from "@/lib/motion";

/**
 * El ID es lo que el productor le pasa al asesor para que entre a su establecimiento, asi que
 * tiene que poder leerlo y copiarlo sin salir de la pantalla. Hasta ahora solo existia dentro
 * de la URL: el circuito "productor comparte / asesor busca" no se podia completar desde la app.
 *
 * La confirmacion va en el boton y no en un toast: el toast vive abajo a la derecha, lejos de
 * donde esta mirando el usuario cuando aprieta.
 */
type Resultado = "inactivo" | "copiado" | "copialo-a-mano";

/** Portapapeles heredado: no necesita contexto seguro ni que el documento tenga foco. */
function copiarConExecCommand(valor: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = valor;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function IdCopiable({ valor }: { valor: string }) {
  const [resultado, setResultado] = useState<Resultado>("inactivo");
  const codigo = useRef<HTMLElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  function avisar(estado: Resultado) {
    setResultado(estado);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setResultado("inactivo"), 2500);
  }

  async function copiar() {
    // execCommand primero, aunque este deprecado, porque es el que funciona siempre aca: la
    // app se usa en el campo sobre http contra una IP de la LAN, y ahi navigator.clipboard
    // directamente no existe por no ser contexto seguro. Ademas es sincrono y no pide
    // permisos, asi que no puede quedar colgado esperando un prompt.
    if (copiarConExecCommand(valor)) {
      avisar("copiado");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sin clipboard api");
      // Si el permiso queda pendiente, writeText no rechaza: no resuelve nunca. Sin esta
      // carrera el boton se quedaria mudo para siempre en vez de degradar al ultimo recurso.
      await Promise.race([
        navigator.clipboard.writeText(valor),
        new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("sin respuesta")), 1000)),
      ]);
      avisar("copiado");
      return;
    } catch {
      /* cae al ultimo recurso */
    }
    // Ultimo recurso: dejar el ID seleccionado para que un Cmd+C lo levante, y decirlo.
    // Fallar en silencio seria peor que no tener el boton.
    if (codigo.current) {
      const rango = document.createRange();
      rango.selectNodeContents(codigo.current);
      const seleccion = window.getSelection();
      seleccion?.removeAllRanges();
      seleccion?.addRange(rango);
    }
    avisar("copialo-a-mano");
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-ink-600">ID</span>
      <code ref={codigo} className="select-all rounded-md bg-paper-200 px-2 py-0.5 font-mono text-xs text-ink-800">
        {valor}
      </code>
      <button
        onClick={copiar}
        aria-label="Copiar el ID del establecimiento"
        className="relative rounded-md border border-paper-300 px-2 py-0.5 text-xs font-medium text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resultado}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: easeOutExpo }}
            className={`block whitespace-nowrap ${resultado === "copiado" ? "text-risk-bajo" : ""}`}
          >
            {resultado === "copiado" ? "Copiado" : resultado === "copialo-a-mano" ? "Copialo con Ctrl+C" : "Copiar"}
          </motion.span>
        </AnimatePresence>
      </button>
      <span aria-live="polite" className="sr-only">
        {resultado === "copiado" ? "ID copiado al portapapeles" : ""}
      </span>
    </div>
  );
}
