import type { MiAcceso } from "@/lib/types";

/**
 * Espejo de PermisosEstablecimiento (api-core). El backend es quien decide; esto solo evita
 * mostrar botones que van a volver 403.
 *
 * Titular = propietario, o el administrador mientras el campo esta cedido. El asesor ve y opera
 * igual que el titular, sin gestionar accesos ni borrar. El propietario con el campo cedido no ve
 * nada: solo puede finalizar la cesion.
 */
export type Accion = "ver" | "operar" | "gestionarAsesores" | "ceder" | "finalizarCesion" | "borrar";

const PERMISOS: Record<MiAcceso, readonly Accion[]> = {
  PROPIETARIO: ["ver", "operar", "gestionarAsesores", "ceder", "borrar"],
  PROPIETARIO_CEDIDO: ["finalizarCesion"],
  ADMINISTRADOR: ["ver", "operar", "gestionarAsesores", "finalizarCesion"],
  ASESOR: ["ver", "operar"],
  NINGUNO: [],
};

export function puede(acceso: MiAcceso | undefined, accion: Accion): boolean {
  return acceso ? PERMISOS[acceso].includes(accion) : false;
}

export const ETIQUETA_ACCESO: Record<MiAcceso, string> = {
  PROPIETARIO: "Propietario",
  PROPIETARIO_CEDIDO: "Propietario (cedido)",
  ADMINISTRADOR: "Administrador · arriendo",
  ASESOR: "Asesor técnico",
  NINGUNO: "Sin acceso",
};

/** "2027-06-30" -> "30/06/2027", sin pasar por Date (evita el corrimiento de zona horaria). */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
