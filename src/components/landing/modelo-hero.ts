/**
 * Modelo del terreno del hero, separado del componente 3D para que el HUD (que se renderiza en el
 * servidor y en el primer paint) pueda calcular las mismas cifras sin cargar three.js.
 */
export const CICLO_S = 14;

/** Altura del terreno en [0,1] para coordenadas de escena x,z en [-7,7]. */
export function altura(x: number, z: number): number {
  const loma = Math.exp(-((x - 3.2) ** 2 + (z + 2.6) ** 2) / 18) * 0.75;
  const bajo = -Math.exp(-((x + 2.4) ** 2 + (z - 2.2) ** 2) / 10) * 0.6;
  const cauce = -Math.exp(-((z - 0.35 * x - 1.2) ** 2) / 0.9) * 0.18;
  const rugosidad =
    Math.sin(x * 1.3 + z * 0.4) * 0.05 + Math.sin(z * 2.1 - x * 0.7) * 0.035 + Math.sin(x * 3.7 + z * 2.9) * 0.012;
  return 0.45 + loma + bajo + cauce + rugosidad;
}

/** Nivel de agua (en unidades de altura) segun el tiempo: sube rapido, baja lento. */
export function nivelAgua(t: number): number {
  const fase = (t % CICLO_S) / CICLO_S;
  const subida = fase < 0.35 ? fase / 0.35 : 1 - (fase - 0.35) / 0.65;
  const suave = subida * subida * (3 - 2 * subida);
  return 0.08 + suave * 0.34;
}

// Muestreo fijo del disco visible (radio 5.2) para pasar de nivel a % de superficie y lamina.
const MUESTRAS: number[] = [];
for (let i = -26; i <= 26; i++)
  for (let j = -26; j <= 26; j++) {
    const x = i * 0.2;
    const z = j * 0.2;
    if (x * x + z * z <= 27) MUESTRAS.push(altura(x, z));
  }
const H_MIN = Math.min(...MUESTRAS);

/** Lectura del HUD: % del campo con agua y lamina maxima en cm (1 unidad de altura = 1 m). */
export function lecturaNivel(nivel: number): { pct: number; laminaCm: number } {
  const bajo = MUESTRAS.filter((h) => h < nivel).length;
  return {
    pct: Math.round((bajo / MUESTRAS.length) * 100),
    laminaCm: Math.max(0, Math.round((nivel - H_MIN) * 100)),
  };
}
