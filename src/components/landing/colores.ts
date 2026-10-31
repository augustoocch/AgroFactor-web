/**
 * Los tokens del sistema estan en OKLCH (globals.css) y THREE.Color no parsea OKLCH. Estos hex son
 * la conversion exacta a sRGB de esos mismos tokens: si cambia un token, recalcular aca.
 */
export const HEX = {
  brand950: "#001e2b",
  brand900: "#002b3b",
  brand700: "#054a5e",
  brand600: "#0a5f75",
  brand500: "#187790",
  brand200: "#c3dde5",
  clay500: "#d26c28",
  clay400: "#e99355",
  paper50: "#faf8f4",
  paper300: "#d9d3cc",
  riskBajo: "#4e8a58",
  riskMedio: "#cb882e",
  riskAlto: "#ba3630",
} as const;
