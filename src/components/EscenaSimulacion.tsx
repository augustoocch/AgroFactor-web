"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ANCHO_ESCENA, construirTerreno, posicionX, posicionZ } from "@/components/terreno3d";
import type { PasoSimulacion, Terreno } from "@/lib/types";

const MAX_GOTAS = 1800;
const COLOR_FLUJO_LENTO = new THREE.Color("#9fd4ef");
const COLOR_FLUJO_RAPIDO = new THREE.Color("#1b6ea8");
const COLOR_AGUA_BAJA = new THREE.Color("#7fb2d6");
const COLOR_AGUA_ALTA = new THREE.Color("#1d4d73");
/** Lamina (mm) desde la que se dibuja agua; por debajo el agua queda oculta dentro del terreno. */
const LAMINA_VISIBLE_MM = 1.0;

export interface VistaCamara {
  posicion: [number, number, number];
  nombre: string;
}

export const VISTAS: VistaCamara[] = [
  { nombre: "Isometrica", posicion: [9, 8, 11] },
  { nombre: "Aerea", posicion: [0, 16, 0.01] },
  { nombre: "Perfil", posicion: [0, 2.4, 15] },
];

/** Escala vertical del agua: la misma que el terreno, para que lamina y relieve sean comparables. */
function escalaAgua(metrosPorUnidad: number, exageracion: number): number {
  return exageracion / metrosPorUnidad / 1000; // mm de lamina -> unidades de escena
}

/** Ruido determinista (hash estilo GLSL): la lluvia se ve aleatoria pero la escena es reproducible. */
/** Une dos geometrias en una sola (para armar la flecha: astil + punta). */
function mergeGeometrias(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const posiciones = new Float32Array([
    ...(a.toNonIndexed().getAttribute("position").array as Float32Array),
    ...(b.toNonIndexed().getAttribute("position").array as Float32Array),
  ]);
  const unida = new THREE.BufferGeometry();
  unida.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  unida.computeVertexNormals();
  return unida;
}

/** Ruido determinista (hash estilo GLSL): la lluvia se ve aleatoria pero la escena es reproducible. */
function aleatorio(semilla: number): number {
  const x = Math.sin(semilla * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Lluvia({
  intensidadMmH,
  vientoKmh,
  direccionVientoDeg,
}: {
  intensidadMmH: number;
  vientoKmh: number;
  direccionVientoDeg: number;
}) {
  const puntos = useRef<THREE.Points>(null);

  const { geometria, velocidades } = useMemo(() => {
    const posiciones = new Float32Array(MAX_GOTAS * 3);
    const velocidades = new Float32Array(MAX_GOTAS);
    for (let i = 0; i < MAX_GOTAS; i++) {
      posiciones[i * 3] = (aleatorio(i) - 0.5) * ANCHO_ESCENA * 1.15;
      posiciones[i * 3 + 1] = aleatorio(i + 0.33) * 9;
      posiciones[i * 3 + 2] = (aleatorio(i + 0.66) - 0.5) * ANCHO_ESCENA * 1.15;
      velocidades[i] = 6 + aleatorio(i + 0.9) * 6;
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
    return { geometria, velocidades };
  }, []);
  const contadorReciclado = useRef(0);

  // La cantidad de gotas visibles sale de la intensidad real de esa hora de la simulacion.
  const visibles = Math.round(Math.min(intensidadMmH / 12, 1) * MAX_GOTAS);
  const arrastreX = Math.sin((direccionVientoDeg * Math.PI) / 180) * (vientoKmh / 45);
  const arrastreZ = Math.cos((direccionVientoDeg * Math.PI) / 180) * (vientoKmh / 45);

  useFrame((_, delta) => {
    if (!puntos.current) return;
    const atributo = puntos.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = atributo.array as Float32Array;
    for (let i = 0; i < visibles; i++) {
      array[i * 3] += arrastreX * delta;
      array[i * 3 + 1] -= velocidades[i] * delta;
      array[i * 3 + 2] += arrastreZ * delta;
      if (array[i * 3 + 1] < -0.5) {
        // Reciclado de la gota: vuelve arriba en una posicion nueva del mismo ruido determinista.
        const semilla = (contadorReciclado.current += 1);
        array[i * 3] = (aleatorio(semilla) - 0.5) * ANCHO_ESCENA * 1.15;
        array[i * 3 + 1] = 8 + aleatorio(semilla + 0.5) * 2;
        array[i * 3 + 2] = (aleatorio(semilla + 0.75) - 0.5) * ANCHO_ESCENA * 1.15;
      }
    }
    atributo.needsUpdate = true;
    puntos.current.geometry.setDrawRange(0, visibles);
  });

  if (visibles === 0) return null;

  return (
    <points ref={puntos} geometry={geometria}>
      <pointsMaterial color="#a8cde8" size={0.07} transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}

function FlechasEscurrimiento({
  flujo,
  alturaDe,
  laminaGrid,
  escala,
}: {
  flujo: number[][][];
  alturaDe: (fila: number, columna: number) => number;
  laminaGrid: number[][];
  escala: number;
}) {
  const malla = useRef<THREE.InstancedMesh>(null);
  const filas = flujo.length;
  const columnas = flujo[0]?.length ?? 0;
  const total = filas * columnas;

  // Flecha de verdad (astil + punta) en vez de un cono suelto: apoyada casi horizontal sobre el
  // agua, se lee la direccion de un vistazo.
  const geometria = useMemo(() => {
    const punta = new THREE.ConeGeometry(0.055, 0.16, 6);
    punta.translate(0, 0.1, 0);
    const astil = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5);
    astil.translate(0, -0.02, 0);

    const flecha = mergeGeometrias(punta, astil);
    flecha.rotateX(Math.PI / 2); // pasa a apuntar a +Z: la rotacion en Y la orienta
    return flecha;
  }, []);

  // Se dibuja una flecha cada N celdas: con una por celda el terreno queda tapado por una
  // alfombra de flechas y deja de leerse el agua.
  const salto = columnas > 10 ? 2 : 1;

  /** Las celdas que efectivamente muestran flecha, con su direccion y velocidad relativa. */
  const corrientes = useMemo(() => {
    const magnitudes: number[] = [];
    for (const fila of flujo) for (const [dc, df] of fila) magnitudes.push(Math.hypot(dc, df));
    const maxima = Math.max(...magnitudes, 0.001);

    const items: { fila: number; columna: number; angulo: number; intensidad: number }[] = [];
    for (let fila = 0; fila < filas; fila += salto) {
      for (let columna = 0; columna < columnas; columna += salto) {
        const [dc, df] = flujo[fila][columna];
        const magnitud = Math.hypot(dc, df);
        // Solo donde hay escurrimiento apreciable y algo de agua que mover.
        if (magnitud / maxima < 0.15 || laminaGrid[fila][columna] < LAMINA_VISIBLE_MM) continue;
        items.push({ fila, columna, angulo: Math.atan2(dc, df), intensidad: magnitud / maxima });
      }
    }
    return items;
  }, [flujo, laminaGrid, filas, columnas, salto]);

  // Color por velocidad: celeste donde el agua apenas se mueve, azul intenso donde corre.
  useEffect(() => {
    if (!malla.current) return;
    corrientes.forEach((corriente, i) => {
      malla.current!.setColorAt(i, COLOR_FLUJO_LENTO.clone().lerp(COLOR_FLUJO_RAPIDO, corriente.intensidad));
    });
    malla.current.count = corrientes.length;
    if (malla.current.instanceColor) malla.current.instanceColor.needsUpdate = true;
  }, [corrientes]);

  /**
   * Las flechas avanzan en su direccion y reaparecen atras, como el agua corriendo. Una flecha
   * quieta no distingue "por aca escurre" de "aca hay una marca en el mapa"; el movimiento si.
   */
  useFrame((estado) => {
    if (!malla.current) return;
    const auxiliar = new THREE.Object3D();
    const t = estado.clock.elapsedTime;

    corrientes.forEach((corriente, i) => {
      const { fila, columna, angulo, intensidad } = corriente;
      // Avance ciclico: recorre poco menos de una celda y vuelve a empezar.
      const avance = ((t * (0.25 + intensidad * 0.5)) % 1) * (ANCHO_ESCENA / Math.max(columnas - 1, 1)) * salto;
      const base = alturaDe(fila, columna) + laminaGrid[fila][columna] * escala + 0.05;

      auxiliar.position.set(
        posicionX(columna, columnas) + Math.sin(angulo) * avance,
        base,
        posicionZ(fila, filas) + Math.cos(angulo) * avance,
      );
      auxiliar.rotation.set(0, angulo, 0);
      const tamano = 0.6 + intensidad * 0.7;
      auxiliar.scale.set(tamano, tamano, tamano);
      auxiliar.updateMatrix();
      malla.current!.setMatrixAt(i, auxiliar.matrix);
    });

    malla.current.instanceMatrix.needsUpdate = true;
  });

  if (total === 0) return null;

  return (
    <instancedMesh ref={malla} args={[geometria, undefined, total]} frustumCulled={false}>
      <meshStandardMaterial vertexColors={false} emissiveIntensity={0.45} emissive="#1d4d73" toneMapped={false} />
    </instancedMesh>
  );
}

function Agua({
  laminaGrid,
  alturaDe,
  escala,
}: {
  laminaGrid: number[][];
  alturaDe: (fila: number, columna: number) => number;
  escala: number;
}) {
  const geometria = useMemo(() => new THREE.BufferGeometry(), []);
  const filas = laminaGrid.length;
  const columnas = laminaGrid[0]?.length ?? 0;

  useEffect(() => {
    const posiciones: number[] = [];
    const colores: number[] = [];
    const indices: number[] = [];
    const laminaMaxima = Math.max(...laminaGrid.flat(), 1);

    for (let fila = 0; fila < filas; fila++) {
      for (let columna = 0; columna < columnas; columna++) {
        const lamina = laminaGrid[fila][columna];
        // Donde no hay agua, la malla se hunde apenas por debajo del terreno y queda oculta.
        const y =
          lamina >= LAMINA_VISIBLE_MM
            ? alturaDe(fila, columna) + lamina * escala
            : alturaDe(fila, columna) - 0.04;
        posiciones.push(posicionX(columna, columnas), y, posicionZ(fila, filas));
        const color = COLOR_AGUA_BAJA.clone().lerp(COLOR_AGUA_ALTA, Math.min(lamina / laminaMaxima, 1));
        colores.push(color.r, color.g, color.b);
      }
    }
    for (let fila = 0; fila < filas - 1; fila++) {
      for (let columna = 0; columna < columnas - 1; columna++) {
        const a = fila * columnas + columna;
        indices.push(a, a + columnas, a + 1, a + 1, a + columnas, a + columnas + 1);
      }
    }

    geometria.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
    geometria.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
    geometria.setIndex(indices);
    geometria.computeVertexNormals();
  }, [laminaGrid, alturaDe, escala, geometria, filas, columnas]);

  return (
    <mesh geometry={geometria}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.78}
        roughness={0.15}
        metalness={0.25}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CamaraControlada({ vista }: { vista: VistaCamara }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...vista.posicion);
    camera.lookAt(0, 0, 0);
  }, [vista, camera]);
  return null;
}

interface Props {
  terreno: Terreno;
  paso: PasoSimulacion;
  vientoKmh: number;
  direccionVientoDeg: number;
  vista: VistaCamara;
  mostrarFlechas: boolean;
  mostrarLluvia: boolean;
  /** Ancho real del lote en metros: fija la escala vertical verdadera del bloque. */
  anchoLoteM: number;
  exageracion: number;
}

export function EscenaSimulacion({
  terreno,
  paso,
  vientoKmh,
  direccionVientoDeg,
  vista,
  mostrarFlechas,
  mostrarLluvia,
  anchoLoteM,
  exageracion,
}: Props) {
  const metrosPorUnidad = Math.max(anchoLoteM, 1) / ANCHO_ESCENA;
  const { superficie, bloque, alturaDe } = useMemo(
    () =>
      construirTerreno(
        terreno.grid,
        terreno.elevacionMinM,
        terreno.elevacionMaxM,
        metrosPorUnidad,
        exageracion,
      ),
    [terreno, metrosPorUnidad, exageracion],
  );
  const escala = escalaAgua(metrosPorUnidad, exageracion);

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#cfe3f2", "#5a4a35", 0.5]} />
      <directionalLight position={[8, 12, 6]} intensity={1.15} castShadow />
      <directionalLight position={[-7, 5, -8]} intensity={0.3} />

      <mesh geometry={superficie} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} />
      </mesh>
      <mesh geometry={bloque}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>

      <Agua laminaGrid={paso.laminaGrid} alturaDe={alturaDe} escala={escala} />

      {mostrarFlechas && (
        <FlechasEscurrimiento
          flujo={paso.flujoGrid}
          laminaGrid={paso.laminaGrid}
          alturaDe={alturaDe}
          escala={escala}
        />
      )}

      {mostrarLluvia && (
        <Lluvia intensidadMmH={paso.lluviaMmH} vientoKmh={vientoKmh} direccionVientoDeg={direccionVientoDeg} />
      )}

      <CamaraControlada vista={vista} />
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.05} minDistance={5} maxDistance={30} />
    </>
  );
}
