import * as THREE from "three";

/** Ancho del bloque de terreno en unidades de escena (el lote se normaliza siempre a esto). */
export const ANCHO_ESCENA = 10;
/** Altura del bloque de tierra por debajo de la superficie. */
export const ESPESOR_BLOQUE = 2.2;

const COLOR_COTA_BAJA = new THREE.Color("#4a6b3a"); // verde bajo: zonas deprimidas
const COLOR_COTA_MEDIA = new THREE.Color("#8a7a4a");
const COLOR_COTA_ALTA = new THREE.Color("#b5a179"); // loma clara

// Estratos del perfil del suelo, de arriba hacia abajo (horizonte A, B textural, C / material madre).
const ESTRATOS = [
  { hasta: 0.18, color: new THREE.Color("#4a3b28") },
  { hasta: 0.55, color: new THREE.Color("#6b4f2f") },
  { hasta: 1.0, color: new THREE.Color("#8c7a55") },
];

export interface GeometriaTerreno {
  superficie: THREE.BufferGeometry;
  bloque: THREE.BufferGeometry;
  alturaDe: (fila: number, columna: number) => number;
  yBase: number;
}

function colorPorAltura(t: number): THREE.Color {
  return t < 0.5
    ? COLOR_COTA_BAJA.clone().lerp(COLOR_COTA_MEDIA, t / 0.5)
    : COLOR_COTA_MEDIA.clone().lerp(COLOR_COTA_ALTA, (t - 0.5) / 0.5);
}

function colorEstrato(profundidadRelativa: number): THREE.Color {
  for (const estrato of ESTRATOS) {
    if (profundidadRelativa <= estrato.hasta) return estrato.color;
  }
  return ESTRATOS[ESTRATOS.length - 1].color;
}

export function posicionX(columna: number, columnas: number): number {
  return (columna / Math.max(columnas - 1, 1) - 0.5) * ANCHO_ESCENA;
}

export function posicionZ(fila: number, filas: number): number {
  return (fila / Math.max(filas - 1, 1) - 0.5) * ANCHO_ESCENA;
}

/**
 * Construye el lote como un bloque de tierra solido (superficie + cuatro paredes + fondo), no
 * como una lamina: asi se ve el volumen del suelo y sus horizontes al girar la camara.
 */
export function construirTerreno(
  grid: number[][],
  elevacionMinM: number,
  elevacionMaxM: number,
  metrosPorUnidad: number,
  exageracion: number,
): GeometriaTerreno {
  const filas = grid.length;
  const columnas = grid[0].length;
  const rango = Math.max(elevacionMaxM - elevacionMinM, 0.01);
  // Escala vertical REAL (metros del terreno / metros por unidad de escena) multiplicada por un
  // factor de exageracion explicito y ajustable. Normalizar el relieve al mismo alto siempre
  // seria mas vistoso pero mentiroso: un lote plano se veria igual que uno con lomas.
  const alturaDe = (fila: number, columna: number) =>
    ((grid[fila][columna] - elevacionMinM) / metrosPorUnidad) * exageracion;
  const yBase = -ESPESOR_BLOQUE;

  // --- Superficie ---
  const posiciones: number[] = [];
  const colores: number[] = [];
  const indices: number[] = [];

  for (let fila = 0; fila < filas; fila++) {
    for (let columna = 0; columna < columnas; columna++) {
      const altura = alturaDe(fila, columna);
      posiciones.push(posicionX(columna, columnas), altura, posicionZ(fila, filas));
      const color = colorPorAltura((grid[fila][columna] - elevacionMinM) / rango);
      colores.push(color.r, color.g, color.b);
    }
  }
  for (let fila = 0; fila < filas - 1; fila++) {
    for (let columna = 0; columna < columnas - 1; columna++) {
      const a = fila * columnas + columna;
      const b = a + 1;
      const c = a + columnas;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const superficie = new THREE.BufferGeometry();
  superficie.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  superficie.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
  superficie.setIndex(indices);
  superficie.computeVertexNormals();

  // --- Paredes laterales + fondo ---
  const posBloque: number[] = [];
  const colBloque: number[] = [];

  const agregarQuad = (
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    v4: [number, number, number],
  ) => {
    const alturaTope = Math.max(v1[1], v2[1]);
    for (const [vertice, esProfundo] of [
      [v1, false],
      [v2, false],
      [v3, true],
      [v1, false],
      [v3, true],
      [v4, true],
    ] as const) {
      posBloque.push(vertice[0], vertice[1], vertice[2]);
      const profundidad = esProfundo ? 1 : (alturaTope - vertice[1]) / (alturaTope - yBase || 1);
      const color = colorEstrato(profundidad);
      colBloque.push(color.r, color.g, color.b);
    }
  };

  for (let columna = 0; columna < columnas - 1; columna++) {
    // borde norte (fila 0) y sur (ultima fila)
    const xa = posicionX(columna, columnas);
    const xb = posicionX(columna + 1, columnas);
    const zNorte = posicionZ(0, filas);
    const zSur = posicionZ(filas - 1, filas);
    agregarQuad(
      [xb, alturaDe(0, columna + 1), zNorte],
      [xa, alturaDe(0, columna), zNorte],
      [xa, yBase, zNorte],
      [xb, yBase, zNorte],
    );
    agregarQuad(
      [xa, alturaDe(filas - 1, columna), zSur],
      [xb, alturaDe(filas - 1, columna + 1), zSur],
      [xb, yBase, zSur],
      [xa, yBase, zSur],
    );
  }

  for (let fila = 0; fila < filas - 1; fila++) {
    const za = posicionZ(fila, filas);
    const zb = posicionZ(fila + 1, filas);
    const xOeste = posicionX(0, columnas);
    const xEste = posicionX(columnas - 1, columnas);
    agregarQuad(
      [xOeste, alturaDe(fila, 0), za],
      [xOeste, alturaDe(fila + 1, 0), zb],
      [xOeste, yBase, zb],
      [xOeste, yBase, za],
    );
    agregarQuad(
      [xEste, alturaDe(fila + 1, columnas - 1), zb],
      [xEste, alturaDe(fila, columnas - 1), za],
      [xEste, yBase, za],
      [xEste, yBase, zb],
    );
  }

  const x0 = posicionX(0, columnas);
  const x1 = posicionX(columnas - 1, columnas);
  const z0 = posicionZ(0, filas);
  const z1 = posicionZ(filas - 1, filas);
  agregarQuad([x0, yBase, z0], [x0, yBase, z1], [x1, yBase, z1], [x1, yBase, z0]);

  const bloque = new THREE.BufferGeometry();
  bloque.setAttribute("position", new THREE.Float32BufferAttribute(posBloque, 3));
  bloque.setAttribute("color", new THREE.Float32BufferAttribute(colBloque, 3));
  bloque.computeVertexNormals();

  return { superficie, bloque, alturaDe, yBase };
}
