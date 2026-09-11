import * as THREE from "three";

/** Ancho del bloque de terreno en unidades de escena (el lote se normaliza siempre a esto). */
export const ANCHO_ESCENA = 10;
/** Altura del bloque de tierra por debajo de la superficie. */
export const ESPESOR_BLOQUE = 2.2;

const COLOR_COTA_BAJA = new THREE.Color("#4a6b3a"); // verde bajo: zonas deprimidas
const COLOR_COTA_MEDIA = new THREE.Color("#8a7a4a");
const COLOR_COTA_ALTA = new THREE.Color("#b5a179"); // loma clara

// Tierra del corte: humus oscuro arriba, material madre mas claro y seco abajo. Es un degrade
// continuo, no capas: el corte tiene que leerse como un pan de tierra macizo, no como una torta.
const TIERRA_SUPERIOR = new THREE.Color("#4a3524");
const TIERRA_INFERIOR = new THREE.Color("#9c8560");

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

function colorTierra(profundidadRelativa: number): THREE.Color {
  return TIERRA_SUPERIOR.clone().lerp(TIERRA_INFERIOR, profundidadRelativa);
}

/** Ruido determinista (hash estilo GLSL). */
function aleatorio(semilla: number): number {
  const x = Math.sin(semilla * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Moteado de dos escalas (manchones + grano fino) mas sombra hacia la base, para que el corte de tierra no se vea plano. */
function jaspeado(color: THREE.Color, x: number, y: number, z: number, profundidadRelativa: number): THREE.Color {
  const manchon = aleatorio(Math.floor(x * 3) * 12.9898 + Math.floor(y * 3) * 78.233 + Math.floor(z * 3) * 37.719) * 0.26 - 0.13;
  const grano = aleatorio(x * 91.7 + y * 47.3 + z * 63.1) * 0.14 - 0.07;
  const ruido = manchon + grano;
  const sombra = 1 - profundidadRelativa * 0.22;
  return new THREE.Color(
    Math.min(Math.max((color.r + ruido) * sombra, 0), 1),
    Math.min(Math.max((color.g + ruido * 0.85) * sombra, 0), 1),
    Math.min(Math.max((color.b + ruido * 0.6) * sombra, 0), 1),
  );
}

export function posicionX(columna: number, columnas: number): number {
  return (columna / Math.max(columnas - 1, 1) - 0.5) * ANCHO_ESCENA;
}

export function posicionZ(fila: number, filas: number): number {
  return (fila / Math.max(filas - 1, 1) - 0.5) * ANCHO_ESCENA;
}

/** Construye el lote como un bloque de tierra solido (superficie + cuatro paredes + fondo), no una lamina. */
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
  // Escala vertical real x factor de exageracion: normalizar el relieve seria mas vistoso pero
  // mentiroso, un lote plano se veria igual que uno con lomas.
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

  const lerpVec = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  // v1-v2 es el borde de arriba, v4-v3 el de abajo (yBase); v4 debajo de v1, v3 debajo de v2.
  //
  // El orden de los vertices (v1,v3,v2) va al reves de lo que parece natural, a proposito: define
  // el winding, y con el winding contrario la normal de cada cara apunta HACIA ADENTRO del bloque.
  // Con el culling por defecto de three.js (FrontSide) eso hace que las paredes no se dibujen
  // desde afuera y se vea el interior del volumen: un bloque hueco, una caja de zapatos vacia.
  //
  // Subdividido en franjas horizontales para que el moteado tenga vertices donde variar; si no,
  // cada pared es un unico quad de dos vertices de alto y queda un degrade liso sin textura.
  const SUBDIVISIONES_PARED = 14;
  const agregarQuad = (
    v1: [number, number, number],
    v2: [number, number, number],
    v3: [number, number, number],
    v4: [number, number, number],
  ) => {
    for (let i = 0; i < SUBDIVISIONES_PARED; i++) {
      const t0 = i / SUBDIVISIONES_PARED;
      const t1 = (i + 1) / SUBDIVISIONES_PARED;
      const p1 = lerpVec(v1, v4, t0);
      const p2 = lerpVec(v2, v3, t0);
      const p3 = lerpVec(v2, v3, t1);
      const p4 = lerpVec(v1, v4, t1);
      for (const [vertice, profundidad] of [
        [p1, t0],
        [p3, t1],
        [p2, t0],
        [p1, t0],
        [p4, t1],
        [p3, t1],
      ] as const) {
        posBloque.push(vertice[0], vertice[1], vertice[2]);
        const color = jaspeado(colorTierra(profundidad), vertice[0], vertice[1], vertice[2], profundidad);
        colBloque.push(color.r, color.g, color.b);
      }
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
