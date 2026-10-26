"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { easeOutExpo } from "@/lib/motion";

/**
 * Un valor que el usuario tiene que pasarle a otra persona por fuera de la app (hoy: el link de
 * una invitacion, para mandarlo por WhatsApp si el email no llego). Se lee y se copia sin salir
 * de la pantalla.
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

export function IdCopiable({
  valor,
  textoBoton = "Copiar código",
  descripcion = "Copiar el ID del establecimiento",
}: {
  valor: string;
  textoBoton?: string;
  descripcion?: string;
}) {
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
    <div className="flex flex-wrap items-center gap-2">
      <code ref={codigo} className="select-all break-all rounded-md border border-paper-300 bg-paper-50 px-3 py-1.5 font-mono text-sm text-ink-900">
        {valor}
      </code>
      <button
        onClick={copiar}
        aria-label={descripcion}
        className="relative rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resultado}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: easeOutExpo }}
            className={`block whitespace-nowrap ${resultado === "copiado" ? "text-risk-bajo-ink" : ""}`}
          >
            {resultado === "copiado" ? "Copiado" : resultado === "copialo-a-mano" ? "Copialo con Ctrl+C" : textoBoton}
          </motion.span>
        </AnimatePresence>
      </button>
      <span aria-live="polite" className="sr-only">
        {resultado === "copiado" ? "Copiado al portapapeles" : ""}
      </span>
    </div>
  );
}
