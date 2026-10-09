"use client";

import { InfoAside } from "@/components/InfoAside";

/**
 * Explicacion de un numero o de un criterio.
 *
 * Antes abria un modal centrado con fondo oscuro, y eso tapaba justo el dato que se estaba
 * tratando de entender. Ahora todas las explicaciones abren el mismo panel lateral de referencia
 * (`InfoAside`), que deja la pantalla a la vista. `Modal` queda para lo que si exige atencion
 * exclusiva: confirmar un borrado, completar un formulario.
 */
export function InfoModal(props: { titulo: string; etiqueta?: string; children: React.ReactNode }) {
  return <InfoAside {...props} />;
}
