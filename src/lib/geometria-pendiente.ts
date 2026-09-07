import type { Coordenada } from "@/lib/types";

/**
 * Traspaso de la geometria dibujada en el mapa hacia la pagina del formulario.
 *
 * Dibujar es inherentemente una accion del mapa, pero cargar la ficha ya no cabe en un modal.
 * La geometria viaja por sessionStorage y no por la URL: un anillo de veinte vertices deja una
 * direccion ilegible de mas de mil caracteres, y ademas se rompe al compartirla o recargarla.
 * Vive solo hasta que el formulario la consume.
 */
const CLAVE = "elagua.geometria-pendiente";

interface GeometriaPendiente {
  anillo?: Coordenada[];
  punto?: Coordenada;
}

export function guardarGeometriaPendiente(valor: GeometriaPendiente): void {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(valor));
  } catch {
    // Ventana privada o storage bloqueado: el formulario lo detecta y pide volver a dibujar.
  }
}

/** Devuelve la geometria y la borra: es de un solo uso, no debe reaparecer en un alta posterior. */
export function tomarGeometriaPendiente(): GeometriaPendiente | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    window.sessionStorage.removeItem(CLAVE);
    return JSON.parse(crudo) as GeometriaPendiente;
  } catch {
    return null;
  }
}
