"use client";

import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  ANCHO_ESCENA,
  apagarContexto,
  construirTerreno,
  dimensionesDe,
  posicionX,
  posicionZ,
  type Dimensiones,
} from "@/components/terreno3d";
import type { Coordenada, Movilidad, PasoSimulacion, Terreno, TerrenoBounds, TipoActivo } from "@/lib/types";

const MAX_GOTAS = 900;
const COLOR_FLUJO_LENTO = new THREE.Color("#9fd4ef");
const COLOR_FLUJO_RAPIDO = new THREE.Color("#1b6ea8");
const COLOR_AGUA_BAJA = new THREE.Color("#7fb2d6");
const COLOR_AGUA_ALTA = new THREE.Color("#1d4d73");
/** Lamina (mm) desde la que se dibuja agua; por debajo el agua queda oculta dentro del terreno. */
const LAMINA_VISIBLE_MM = 1.0;

// Paleta de cielo/atmosfera segun intensidad de lluvia.
const CIELO_CALMO = new THREE.Color("#dbe7f0");
const CIELO_TORMENTA = new THREE.Color("#4f5c66");
const NIEBLA_CALMA = new THREE.Color("#dbe7f0");
const NIEBLA_TORMENTA = new THREE.Color("#6b7680");

export interface VistaCamara {
  posicion: [number, number, number];
  nombre: string;
}

export const VISTAS: VistaCamara[] = [
  { nombre: "Isometrica", posicion: [9, 8, 11] },
  { nombre: "Aerea", posicion: [0, 16, 0.01] },
  { nombre: "Perfil", posicion: [0, 2.4, 15] },
];

/** Un activo ya proyectado sobre la grilla del terreno, listo para pintarse como marcador 3D. */
export interface ActivoMarcador {
  id: string;
  nombre: string;
  tipo: TipoActivo;
  movilidad: Movilidad;
  valorEstimadoUsd: number;
  /** Posicion en indices de grilla (pueden ser fraccionarios: se interpola). */
  fFila: number;
  fColumna: number;
  /** Si a la hora que se esta mostrando el agua ya supera la altura del activo. */
  inundadoAhora: boolean;
  /** Si en algun momento del escenario el agua llega a superarlo (aunque todavia no, a esta hora). */
  seInundaEnEscenario: boolean;
  horaInundacion: number | null;
}

/** Escala vertical del agua: la misma que el terreno, para que lamina y relieve sean comparables. */
function escalaAgua(metrosPorUnidad: number, exageracion: number): number {
  return exageracion / metrosPorUnidad / 1000; // mm de lamina -> unidades de escena
}

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

/** Interpola `alturaDe` (definida solo en indices enteros de grilla) en una posicion fraccionaria. */
function alturaInterpolada(
  alturaDe: (fila: number, columna: number) => number,
  fFila: number,
  fColumna: number,
  filas: number,
  columnas: number,
): number {
  const f = Math.min(Math.max(fFila, 0), filas - 1);
  const c = Math.min(Math.max(fColumna, 0), columnas - 1);
  const f0 = Math.floor(f);
  const c0 = Math.floor(c);
  const f1 = Math.min(f0 + 1, filas - 1);
  const c1 = Math.min(c0 + 1, columnas - 1);
  const tf = f - f0;
  const tc = c - c0;
  return (
    alturaDe(f0, c0) * (1 - tf) * (1 - tc) +
    alturaDe(f0, c1) * (1 - tf) * tc +
    alturaDe(f1, c0) * tf * (1 - tc) +
    alturaDe(f1, c1) * tf * tc
  );
}

/** Lluvia como trazos (cilindros estirados por caida + viento), no puntos: un trazo largo lee velocidad. */
function Lluvia({
  intensidadMmH,
  vientoKmh,
  direccionVientoDeg,
}: {
  intensidadMmH: number;
  vientoKmh: number;
  direccionVientoDeg: number;
}) {
  const malla = useRef<THREE.InstancedMesh>(null);

  const geometria = useMemo(() => new THREE.CylinderGeometry(0.007, 0.007, 1, 4), []);

  // Refs, no useMemo: se mutan en cada frame y se cargan en un efecto para no tocar un ref durante el render.
  const posicionesRef = useRef<Float32Array | null>(null);
  const velocidadesRef = useRef<Float32Array | null>(null);
  useEffect(() => {
    const posiciones = new Float32Array(MAX_GOTAS * 3);
    const velocidades = new Float32Array(MAX_GOTAS);
    for (let i = 0; i < MAX_GOTAS; i++) {
      posiciones[i * 3] = (aleatorio(i) - 0.5) * ANCHO_ESCENA * 1.15;
      posiciones[i * 3 + 1] = aleatorio(i + 0.33) * 9;
      posiciones[i * 3 + 2] = (aleatorio(i + 0.66) - 0.5) * ANCHO_ESCENA * 1.15;
      velocidades[i] = 7 + aleatorio(i + 0.9) * 7;
    }
    posicionesRef.current = posiciones;
    velocidadesRef.current = velocidades;
  }, []);
  const contadorReciclado = useRef(0);

  const visibles = Math.round(Math.min(intensidadMmH / 12, 1) * MAX_GOTAS);
  const arrastreX = Math.sin((direccionVientoDeg * Math.PI) / 180) * (vientoKmh / 45);
  const arrastreZ = Math.cos((direccionVientoDeg * Math.PI) / 180) * (vientoKmh / 45);

  useFrame((_, delta) => {
    if (!malla.current || !posicionesRef.current || !velocidadesRef.current) return;
    const posiciones = posicionesRef.current;
    const velocidades = velocidadesRef.current;
    const auxiliar = new THREE.Object3D();

    for (let i = 0; i < visibles; i++) {
      posiciones[i * 3] += arrastreX * delta;
      posiciones[i * 3 + 1] -= velocidades[i] * delta;
      posiciones[i * 3 + 2] += arrastreZ * delta;
      if (posiciones[i * 3 + 1] < -0.5) {
        const semilla = (contadorReciclado.current += 1);
        posiciones[i * 3] = (aleatorio(semilla) - 0.5) * ANCHO_ESCENA * 1.15;
        posiciones[i * 3 + 1] = 8 + aleatorio(semilla + 0.5) * 2;
        posiciones[i * 3 + 2] = (aleatorio(semilla + 0.75) - 0.5) * ANCHO_ESCENA * 1.15;
      }

      const largo = 0.45 + velocidades[i] * 0.045;
      auxiliar.position.set(posiciones[i * 3], posiciones[i * 3 + 1], posiciones[i * 3 + 2]);
      auxiliar.rotation.set(Math.atan2(arrastreZ, velocidades[i]), 0, -Math.atan2(arrastreX, velocidades[i]));
      auxiliar.scale.set(1, largo, 1);
      auxiliar.updateMatrix();
      malla.current.setMatrixAt(i, auxiliar.matrix);
    }
    malla.current.count = visibles;
    malla.current.instanceMatrix.needsUpdate = true;
  });

  if (visibles === 0) return null;

  return (
    <instancedMesh ref={malla} args={[geometria, undefined, MAX_GOTAS]} frustumCulled={false}>
      <meshBasicMaterial color="#bcdcf0" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}

/** Posiciones y tamanos de los blobs de una nube, generados una sola vez con ruido determinista. */
const BLOBS_NUBE = Array.from({ length: 7 }, (_, i) => ({
  x: (aleatorio(i * 3.1) - 0.5) * 3.2,
  z: (aleatorio(i * 3.1 + 1) - 0.5) * 1.6,
  y: aleatorio(i * 3.1 + 2) * 0.4,
  radio: 0.5 + aleatorio(i * 3.1 + 3) * 0.45,
}));

/**
 * Nubes de tormenta bajas. Esferas achatadas sin textura a proposito: drei `Cloud` carga una
 * textura de un CDN externo y, si esa red falla, tira abajo el Canvas entero via Suspense.
 */
function CielosDeTormenta({
  intensidadMmH,
  vientoKmh,
  direccionVientoDeg,
}: {
  intensidadMmH: number;
  vientoKmh: number;
  direccionVientoDeg: number;
}) {
  const opacidad = Math.min(intensidadMmH / 25, 1) * 0.75 + 0.05;
  const deriva = useRef(0);
  const grupo = useRef<THREE.Group>(null);
  const dx = Math.sin((direccionVientoDeg * Math.PI) / 180);
  const dz = Math.cos((direccionVientoDeg * Math.PI) / 180);
  const geometria = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);

  useFrame((_, delta) => {
    deriva.current += delta * (0.05 + vientoKmh / 400);
    if (grupo.current) {
      grupo.current.position.x = Math.sin(deriva.current * 0.3) * 2 + dx * 3;
      grupo.current.position.z = Math.cos(deriva.current * 0.3) * 2 + dz * 3;
    }
  });

  if (opacidad <= 0.05) return null;

  return (
    <group ref={grupo} position={[0, 8.5, 0]} scale={[1, 0.55, 1]}>
      {BLOBS_NUBE.map((blob, i) => (
        <mesh key={i} position={[blob.x, blob.y, blob.z]} scale={blob.radio} geometry={geometria}>
          <meshLambertMaterial color="#7c8791" transparent opacity={opacidad} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function FlechasEscurrimiento({
  flujo,
  alturaDe,
  laminaGrid,
  escala,
  dimensiones,
}: {
  flujo: number[][][];
  alturaDe: (fila: number, columna: number) => number;
  laminaGrid: number[][];
  escala: number;
  dimensiones: Dimensiones;
}) {
  const malla = useRef<THREE.InstancedMesh>(null);
  const filas = flujo.length;
  const columnas = flujo[0]?.length ?? 0;
  const total = filas * columnas;
  // Tamano de celda en la escena por eje: con un dominio rectangular no es el mismo, y el angulo de
  // la flecha tiene que salir del vector en la escena, no del vector en celdas.
  const celdaX = dimensiones.ancho / Math.max(columnas - 1, 1);
  const celdaZ = dimensiones.fondo / Math.max(filas - 1, 1);

  const geometria = useMemo(() => {
    const punta = new THREE.ConeGeometry(0.055, 0.16, 6);
    punta.translate(0, 0.1, 0);
    const astil = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5);
    astil.translate(0, -0.02, 0);

    const flecha = mergeGeometrias(punta, astil);
    flecha.rotateX(Math.PI / 2); // pasa a apuntar a +Z: la rotacion en Y la orienta
    return flecha;
  }, []);

  // Una flecha cada N celdas: una por celda tapa el terreno.
  const salto = columnas > 10 ? 2 : 1;

  /** Las celdas que efectivamente muestran flecha, con su direccion y velocidad relativa. */
  const corrientes = useMemo(() => {
    const magnitudes: number[] = [];
    for (const fila of flujo) for (const [dc, df] of fila) magnitudes.push(Math.hypot(dc, df));
    const maxima = Math.max(...magnitudes, 0.001);

    const items: {
      fila: number;
      columna: number;
      angulo: number;
      intensidad: number;
    }[] = [];
    for (let fila = 0; fila < filas; fila += salto) {
      for (let columna = 0; columna < columnas; columna += salto) {
        const [dc, df] = flujo[fila][columna];
        const magnitud = Math.hypot(dc, df);
        if (magnitud / maxima < 0.15 || laminaGrid[fila][columna] < LAMINA_VISIBLE_MM) continue;
        items.push({
          fila,
          columna,
          angulo: Math.atan2(dc * celdaX, df * celdaZ),
          intensidad: magnitud / maxima,
        });
      }
    }
    return items;
  }, [flujo, laminaGrid, filas, columnas, salto, celdaX, celdaZ]);

  useEffect(() => {
    if (!malla.current) return;
    corrientes.forEach((corriente, i) => {
      malla.current!.setColorAt(i, COLOR_FLUJO_LENTO.clone().lerp(COLOR_FLUJO_RAPIDO, corriente.intensidad));
    });
    malla.current.count = corrientes.length;
    if (malla.current.instanceColor) malla.current.instanceColor.needsUpdate = true;
  }, [corrientes]);

  useFrame((estado) => {
    if (!malla.current) return;
    const auxiliar = new THREE.Object3D();
    const t = estado.clock.elapsedTime;

    corrientes.forEach((corriente, i) => {
      const { fila, columna, angulo, intensidad } = corriente;
      const avance = ((t * (0.25 + intensidad * 0.5)) % 1) * Math.min(celdaX, celdaZ) * salto;
      const base = alturaDe(fila, columna) + laminaGrid[fila][columna] * escala + 0.05;

      auxiliar.position.set(
        posicionX(columna, columnas, dimensiones.ancho) + Math.sin(angulo) * avance,
        base,
        posicionZ(fila, filas, dimensiones.fondo) + Math.cos(angulo) * avance,
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
  dimensiones,
  mascaraLote,
}: {
  laminaGrid: number[][];
  alturaDe: (fila: number, columna: number) => number;
  escala: number;
  dimensiones: Dimensiones;
  mascaraLote: boolean[][] | null;
}) {
  const malla = useRef<THREE.Mesh>(null);
  const geometria = useMemo(() => new THREE.BufferGeometry(), []);
  const filas = laminaGrid.length;
  const columnas = laminaGrid[0]?.length ?? 0;
  // Alturas base y mascara "esta mojado", para animar el oleaje sin recalcular toda la malla en cada frame.
  const alturasBase = useRef<Float32Array>(new Float32Array(0));
  const fasesOleaje = useRef<Float32Array>(new Float32Array(0));
  const humedo = useRef<Uint8Array>(new Uint8Array(0));

  useEffect(() => {
    const posiciones: number[] = [];
    const colores: number[] = [];
    const indices: number[] = [];
    const laminaMaxima = Math.max(...laminaGrid.flat(), 1);
    const base = new Float32Array(filas * columnas);
    const fases = new Float32Array(filas * columnas);
    const mojado = new Uint8Array(filas * columnas);

    for (let fila = 0; fila < filas; fila++) {
      for (let columna = 0; columna < columnas; columna++) {
        const lamina = laminaGrid[fila][columna];
        const idx = fila * columnas + columna;
        const y =
          lamina >= LAMINA_VISIBLE_MM ? alturaDe(fila, columna) + lamina * escala : alturaDe(fila, columna) - 0.04;
        base[idx] = y;
        fases[idx] = aleatorio(idx) * Math.PI * 2;
        mojado[idx] = lamina >= LAMINA_VISIBLE_MM ? 1 : 0;
        posiciones.push(posicionX(columna, columnas, dimensiones.ancho), y, posicionZ(fila, filas, dimensiones.fondo));
        const color = COLOR_AGUA_BAJA.clone().lerp(COLOR_AGUA_ALTA, Math.min(lamina / laminaMaxima, 1));
        if (mascaraLote && !mascaraLote[fila]?.[columna]) apagarContexto(color);
        colores.push(color.r, color.g, color.b);
      }
    }
    for (let fila = 0; fila < filas - 1; fila++) {
      for (let columna = 0; columna < columnas - 1; columna++) {
        const a = fila * columnas + columna;
        indices.push(a, a + columnas, a + 1, a + 1, a + columnas, a + columnas + 1);
      }
    }

    alturasBase.current = base;
    fasesOleaje.current = fases;
    humedo.current = mojado;

    geometria.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
    geometria.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
    geometria.setIndex(indices);
    geometria.computeVertexNormals();
  }, [laminaGrid, alturaDe, escala, geometria, filas, columnas, dimensiones, mascaraLote]);

  // Oleaje sutil para que el agua no se vea como un plano pintado.
  useFrame((estado) => {
    if (!malla.current) return;
    const atributo = malla.current.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!atributo || alturasBase.current.length === 0) return;
    const t = estado.clock.elapsedTime;
    const array = atributo.array as Float32Array;
    for (let i = 0; i < humedo.current.length; i++) {
      if (!humedo.current[i]) continue;
      array[i * 3 + 1] = alturasBase.current[i] + Math.sin(t * 1.6 + fasesOleaje.current[i]) * 0.012;
    }
    atributo.needsUpdate = true;
  });

  return (
    <mesh ref={malla} geometry={geometria}>
      {/* Sin metalness/envMap: sin un environment que reflejar, un material metalico renderiza casi negro. */}
      <meshStandardMaterial vertexColors transparent opacity={0.8} roughness={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Altura del mastil de cada baliza de activo por encima del relieve. */
const ALTURA_BALIZA = 0.85;

/** Marcador de un activo (hacienda, maquinaria, instalaciones): mastil + baliza que pulsa. Color
 * segun estado: verde a salvo, ambar se moja mas adelante, rojo ya bajo agua. */
function BalizaActivo({
  activo,
  y,
  x,
  z,
  seleccionado,
  onSeleccionar,
}: {
  activo: ActivoMarcador;
  y: number;
  x: number;
  z: number;
  seleccionado: boolean;
  onSeleccionar: () => void;
}) {
  const esfera = useRef<THREE.Mesh>(null);
  const color = activo.inundadoAhora ? "#c23b28" : activo.seInundaEnEscenario ? "#c98a2e" : "#3f7a4a";

  useFrame((estado) => {
    if (!esfera.current) return;
    const pulso = 1 + Math.sin(estado.clock.elapsedTime * 2.4) * (seleccionado ? 0.22 : 0.12);
    esfera.current.scale.setScalar(pulso * (seleccionado ? 1.5 : 1));
  });

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, ALTURA_BALIZA / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, ALTURA_BALIZA, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.075, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* No agregar una esfera invisible extra "mas grande" solo para el click: el occlude del
          <Html> de abajo raycastea contra toda la escena (Html.js de drei), y cualquier geometria
          extra en este punto le tapa la etiqueta a si misma. */}
      <mesh
        ref={esfera}
        position={[0, ALTURA_BALIZA, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSeleccionar();
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.09, 14, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={activo.inundadoAhora ? 0.9 : 0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Etiqueta con nombre, siempre visible. zIndexRange bajo: por defecto drei pone estos
          overlays con un z-index ~16 millones, por encima de cualquier modal de la pagina. */}
      <Html
        distanceFactor={seleccionado ? 7 : 9}
        position={[0, ALTURA_BALIZA + 0.14, 0]}
        occlude
        zIndexRange={[30, 0]}
        style={{ transition: "opacity .15s" }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeleccionar();
          }}
          className={`cursor-pointer whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium shadow-sm transition-colors ${
            seleccionado
              ? "border-brand-500 bg-brand-100 text-brand-700"
              : "border-paper-300 bg-paper-50/95 text-ink-800 hover:border-brand-500/60"
          }`}
        >
          {activo.nombre}
        </button>
      </Html>
    </group>
  );
}

function MarcadoresActivos({
  activos,
  alturaDe,
  filas,
  columnas,
  dimensiones,
  seleccionadoId,
  onSeleccionar,
}: {
  activos: ActivoMarcador[];
  alturaDe: (fila: number, columna: number) => number;
  filas: number;
  columnas: number;
  dimensiones: Dimensiones;
  seleccionadoId: string | null;
  onSeleccionar: (id: string | null) => void;
}) {
  return (
    <>
      {activos.map((activo) => {
        const y = alturaInterpolada(alturaDe, activo.fFila, activo.fColumna, filas, columnas);
        const x = posicionX(activo.fColumna, columnas, dimensiones.ancho);
        const z = posicionZ(activo.fFila, filas, dimensiones.fondo);
        const seleccionado = seleccionadoId === activo.id;

        return (
          <BalizaActivo
            key={activo.id}
            activo={activo}
            x={x}
            y={y}
            z={z}
            seleccionado={seleccionado}
            onSeleccionar={() => onSeleccionar(seleccionado ? null : activo.id)}
          />
        );
      })}
    </>
  );
}

/**
 * Interpola la camara SOLO durante la transicion al cambiar de vista. Fuera de eso no la toca:
 * si sigue corriendo mientras el usuario arrastra (OrbitControls), la tira de vuelta cada frame
 * y girar se vuelve imposible.
 */
function CamaraControlada({ vista }: { vista: VistaCamara }) {
  const { camera } = useThree();
  const objetivo = useRef(new THREE.Vector3(...vista.posicion));
  const transicionando = useRef(false);

  useEffect(() => {
    objetivo.current.set(...vista.posicion);
    transicionando.current = true;
  }, [vista]);

  useFrame((_, delta) => {
    if (!transicionando.current) return;
    camera.position.lerp(objetivo.current, Math.min(delta * 4, 1));
    camera.lookAt(0, 0, 0);
    if (camera.position.distanceTo(objetivo.current) < 0.02) transicionando.current = false;
  });

  return null;
}

/** Altura del terreno (en unidades de escena) en una posicion continua de la grilla, por interpolacion bilineal. */
function alturaContinua(
  grid: number[][],
  elevacionMinM: number,
  metrosPorUnidad: number,
  exageracion: number,
  fLat: number,
  fLon: number,
): number {
  const filas = grid.length;
  const columnas = grid[0]?.length ?? 0;
  const f = Math.min(Math.max(fLat * (filas - 1), 0), filas - 1);
  const c = Math.min(Math.max(fLon * (columnas - 1), 0), columnas - 1);
  const f0 = Math.floor(f);
  const c0 = Math.floor(c);
  const f1 = Math.min(f0 + 1, filas - 1);
  const c1 = Math.min(c0 + 1, columnas - 1);
  const tf = f - f0;
  const tc = c - c0;
  const cota =
    grid[f0][c0] * (1 - tf) * (1 - tc) +
    grid[f0][c1] * (1 - tf) * tc +
    grid[f1][c0] * tf * (1 - tc) +
    grid[f1][c1] * tf * tc;
  return ((cota - elevacionMinM) / metrosPorUnidad) * exageracion;
}

/** Coordenada geografica proyectada a (x, z) de la escena, mas sus fracciones de fila/columna. */
function proyectarCoordenada(coord: Coordenada, bounds: TerrenoBounds, dimensiones: Dimensiones) {
  const dLat = bounds.latMax - bounds.latMin || 1;
  const dLon = bounds.lonMax - bounds.lonMin || 1;
  const fLat = (coord.lat - bounds.latMin) / dLat;
  const fLon = (coord.lon - bounds.lonMin) / dLon;
  return {
    x: (fLon - 0.5) * dimensiones.ancho,
    z: (fLat - 0.5) * dimensiones.fondo,
    fLat,
    fLon,
  };
}

/** Un lote: contorno punteado + relleno tenue con su forma real, clickeable para seleccionarlo. */
function LoteInteractivo({
  anillo,
  bounds,
  grid,
  elevacionMinM,
  dimensiones,
  exageracion,
  seleccionado,
  onClick,
}: {
  anillo: Coordenada[];
  bounds: TerrenoBounds;
  grid: number[][];
  elevacionMinM: number;
  dimensiones: Dimensiones;
  exageracion: number;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const alturaEn = (fLat: number, fLon: number) =>
    alturaContinua(grid, elevacionMinM, dimensiones.metrosPorUnidad, exageracion, fLat, fLon);

  const contorno = useMemo(() => {
    if (anillo.length < 2) return null;
    const puntos = anillo.map((c) => {
      const { x, z, fLat, fLon } = proyectarCoordenada(c, bounds, dimensiones);
      return [x, alturaEn(fLat, fLon) + 0.05, z] as [number, number, number];
    });
    const cerrado = [...puntos, puntos[0]];
    const vertices: number[] = [];
    const distancias: number[] = [];
    let recorrido = 0;
    for (let i = 0; i < cerrado.length - 1; i++) {
      const a = cerrado[i];
      const b = cerrado[i + 1];
      vertices.push(...a, ...b);
      // lineDashedMaterial necesita lineDistance acumulada o dibuja continuo.
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      distancias.push(recorrido, recorrido + largo);
      recorrido += largo;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("lineDistance", new THREE.Float32BufferAttribute(distancias, 1));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alturaEn ya depende solo de los deps listados
  }, [anillo, bounds, grid, elevacionMinM, dimensiones, exageracion]);

  const relleno = useMemo(() => {
    if (anillo.length < 3) return null;
    const puntos2D = anillo.map((c) => {
      const { x, z } = proyectarCoordenada(c, bounds, dimensiones);
      return new THREE.Vector2(x, z);
    });
    let caras: number[][];
    try {
      caras = THREE.ShapeUtils.triangulateShape(puntos2D, []);
    } catch {
      return null;
    }
    if (caras.length === 0) return null;

    const posiciones: number[] = [];
    for (const c of anillo) {
      const { x, z, fLat, fLon } = proyectarCoordenada(c, bounds, dimensiones);
      posiciones.push(x, alturaEn(fLat, fLon) + 0.03, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
    g.setIndex(caras.flat());
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentario en `contorno`
  }, [anillo, bounds, grid, elevacionMinM, dimensiones, exageracion]);

  return (
    <>
      {contorno && (
        <lineSegments geometry={contorno}>
          <lineDashedMaterial color={seleccionado ? "#ffb020" : "#fdf6e8"} dashSize={0.16} gapSize={0.1} />
        </lineSegments>
      )}
      {relleno && (
        <mesh
          geometry={relleno}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <meshBasicMaterial
            color={seleccionado ? "#ffb020" : "#fdf6e8"}
            transparent
            opacity={seleccionado ? 0.22 : 0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

interface Props {
  terreno: Terreno;
  paso: PasoSimulacion;
  vientoKmh: number;
  direccionVientoDeg: number;
  vista: VistaCamara;
  mostrarFlechas: boolean;
  mostrarLluvia: boolean;
  /** Ancho real del dominio simulado en metros: escala del bloque cuando el terreno no trae bounds. */
  anchoLoteM: number;
  /** Celdas que son el campo (fila 0 = latitud minima). El resto se dibuja apagado. */
  mascaraLote?: boolean[][] | null;
  exageracion: number;
  /** Lotes reales del alcance. Sin esto el bloque entero se leeria como un solo campo generico. */
  lotes?: { id: string; nombre: string; anillo: Coordenada[] }[];
  loteSeleccionadoId?: string | null;
  onSeleccionarLote?: (id: string | null) => void;
  activos?: ActivoMarcador[];
  activoSeleccionadoId?: string | null;
  onSeleccionarActivo?: (id: string | null) => void;
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
  mascaraLote = null,
  exageracion,
  lotes,
  loteSeleccionadoId,
  onSeleccionarLote,
  activos,
  activoSeleccionadoId,
  onSeleccionarActivo,
}: Props) {
  // Proporcion real del dominio: antes se estiraba a un cuadrado y un lote alargado se veia ancho.
  const dimensiones = useMemo(() => dimensionesDe(terreno.bounds, anchoLoteM), [terreno.bounds, anchoLoteM]);
  const { superficie, bloque, alturaDe } = useMemo(
    () =>
      construirTerreno(
        terreno.grid,
        terreno.elevacionMinM,
        terreno.elevacionMaxM,
        dimensiones,
        exageracion,
        mascaraLote,
      ),
    [terreno, dimensiones, exageracion, mascaraLote],
  );
  const escala = escalaAgua(dimensiones.metrosPorUnidad, exageracion);

  const intensidad = Math.min(paso.lluviaMmH / 25, 1);
  const colorCielo = useMemo(() => CIELO_CALMO.clone().lerp(CIELO_TORMENTA, intensidad), [intensidad]);
  const colorNiebla = useMemo(() => NIEBLA_CALMA.clone().lerp(NIEBLA_TORMENTA, intensidad), [intensidad]);
  const intensidadLuz = 1.2 - intensidad * 0.3;

  const filas = terreno.grid.length;
  const columnas = terreno.grid[0]?.length ?? 0;

  return (
    <>
      <color attach="background" args={[colorCielo]} />
      <fog attach="fog" args={[colorNiebla, 20, 42]} />

      <ambientLight intensity={0.75 - intensidad * 0.08} />
      <hemisphereLight args={["#cfe3f2", "#5a4a35", 0.6 - intensidad * 0.08]} />
      <directionalLight position={[8, 12, 6]} intensity={intensidadLuz} castShadow />
      <directionalLight position={[-7, 5, -8]} intensity={0.35} />
      {/* Relleno en las 4 caras del corte de suelo, direccional y no puntual: una pointLight
          pegada a la pared genera un punto caliente por la caida inversa al cuadrado de la
          distancia (todo blanco cerca de la luz, todo oscuro lejos), que tapaba las bandas de
          estrato. Direccional ilumina parejo sin importar la distancia. */}
      <directionalLight position={[0, 3, 9]} intensity={0.4} />
      <directionalLight position={[0, 3, -9]} intensity={0.4} />
      <directionalLight position={[9, 3, 0]} intensity={0.4} />
      <directionalLight position={[-9, 3, 0]} intensity={0.4} />

      {/* Espejo en z: la fila 0 de la grilla es el SUR y la camara mira desde +z, asi que sin esto
          el norte quedaba abajo y el lote se veia invertido respecto del mapa. three.js corrige el
          sentido de las caras de un objeto con escala negativa, asi que la geometria no cambia. */}
      <group scale={[1, 1, -1]}>
        <mesh geometry={superficie} receiveShadow>
          <meshStandardMaterial vertexColors roughness={Math.max(0.92 - intensidad * 0.25, 0.55)} />
        </mesh>
        <mesh geometry={bloque}>
          <meshStandardMaterial vertexColors roughness={0.95} />
        </mesh>
        <Agua
          laminaGrid={paso.laminaGrid}
          alturaDe={alturaDe}
          escala={escala}
          dimensiones={dimensiones}
          mascaraLote={mascaraLote}
        />

        {lotes &&
          terreno.bounds &&
          lotes.map((lote) => (
            <LoteInteractivo
              key={lote.id}
              anillo={lote.anillo}
              bounds={terreno.bounds!}
              grid={terreno.grid}
              elevacionMinM={terreno.elevacionMinM}
              dimensiones={dimensiones}
              exageracion={exageracion}
              seleccionado={loteSeleccionadoId === lote.id}
              onClick={() => onSeleccionarLote?.(loteSeleccionadoId === lote.id ? null : lote.id)}
            />
          ))}

        {activos && activos.length > 0 && (
          <MarcadoresActivos
            activos={activos}
            alturaDe={alturaDe}
            filas={filas}
            columnas={columnas}
            dimensiones={dimensiones}
            seleccionadoId={activoSeleccionadoId ?? null}
            onSeleccionar={(id) => onSeleccionarActivo?.(id)}
          />
        )}

        {mostrarFlechas && (
          <FlechasEscurrimiento
            flujo={paso.flujoGrid}
            laminaGrid={paso.laminaGrid}
            alturaDe={alturaDe}
            escala={escala}
            dimensiones={dimensiones}
          />
        )}

        {mostrarLluvia && (
          <>
            <Lluvia intensidadMmH={paso.lluviaMmH} vientoKmh={vientoKmh} direccionVientoDeg={direccionVientoDeg} />
            <CielosDeTormenta
              intensidadMmH={paso.lluviaMmH}
              vientoKmh={vientoKmh}
              direccionVientoDeg={direccionVientoDeg}
            />
          </>
        )}
      </group>

      <CamaraControlada vista={vista} />
      <OrbitControls enablePan maxPolarAngle={Math.PI / 2.05} minDistance={5} maxDistance={30} />
    </>
  );
}
