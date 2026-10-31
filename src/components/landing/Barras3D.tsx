"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { HEX } from "@/components/landing/colores";

/**
 * Grafico 3D del establecimiento de ejemplo: cada columna es un lote, ubicado donde esta en el
 * campo, y su altura es el % de superficie con agua en el escenario. La lectura es espacial a
 * proposito: los lotes del bajo (sudoeste) son los altos, igual que en el mapa real.
 */
export interface LoteEjemplo {
  nombre: string;
  pct: number;
  fila: number;
  col: number;
}

const FILAS = 4;
const COLS = 5;
const ESPACIO = 1.25;

export const LOTES_EJEMPLO: LoteEjemplo[] = Array.from({ length: FILAS * COLS }, (_, i) => {
  const fila = Math.floor(i / COLS);
  const col = i % COLS;
  // Bajo en la esquina (fila 3, col 0): el % cae con la distancia, con algo de ruido fijo.
  const dist = Math.hypot(fila - 3, col - 0.3);
  const ruido = ((i * 37) % 11) / 11 - 0.5;
  const pct = Math.max(2, Math.min(78, Math.round(74 - dist * 17 + ruido * 10)));
  return { nombre: `Lote ${i + 1}`, pct, fila, col };
});

function colorDe(pct: number): string {
  if (pct >= 40) return HEX.riskAlto;
  if (pct >= 18) return HEX.riskMedio;
  return HEX.riskBajo;
}

function Columna({
  lote,
  activo,
  retraso,
  seleccionado,
  onSeleccion,
}: {
  lote: LoteEjemplo;
  activo: boolean;
  retraso: number;
  seleccionado: boolean;
  onSeleccion: (l: LoteEjemplo | null) => void;
}) {
  const malla = useRef<THREE.Mesh>(null);
  const inicio = useRef<number | null>(null);
  const alto = (lote.pct / 100) * 3.2 + 0.08;
  const x = (lote.col - (COLS - 1) / 2) * ESPACIO;
  const z = (lote.fila - (FILAS - 1) / 2) * ESPACIO;

  useFrame(({ clock }) => {
    const m = malla.current;
    if (!m) return;
    if (!activo) {
      m.scale.y = 0.001;
      return;
    }
    if (inicio.current === null) inicio.current = clock.elapsedTime;
    const t = Math.min(Math.max((clock.elapsedTime - inicio.current - retraso) / 1.1, 0), 1);
    const e = 1 - Math.pow(1 - t, 4);
    m.scale.y = Math.max(e, 0.001);
    m.position.y = (alto * m.scale.y) / 2;
    const objetivo = seleccionado ? 1.08 : 1;
    m.scale.x = m.scale.z = THREE.MathUtils.lerp(m.scale.x, objetivo, 0.15);
  });

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={malla}
        scale={[1, 0.001, 1]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onSeleccion(lote);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onSeleccion(null);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[0.78, alto, 0.78]} />
        <meshStandardMaterial
          color={colorDe(lote.pct)}
          roughness={0.65}
          emissive={seleccionado ? colorDe(lote.pct) : "#000000"}
          emissiveIntensity={seleccionado ? 0.35 : 0}
        />
      </mesh>
      {seleccionado && (
        <Html position={[0, alto + 0.45, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-paper-300 bg-paper-50 px-2.5 py-1.5 text-xs text-ink-900 shadow-sm">
            <span className="font-medium">{lote.nombre}</span>
            <span className="ml-2 font-mono tabular-nums">{lote.pct}% con agua</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Escena({ activo }: { activo: boolean }) {
  const [sel, setSel] = useState<LoteEjemplo | null>(null);
  const orden = useMemo(
    () => new Map([...LOTES_EJEMPLO].sort((a, b) => b.pct - a.pct).map((l, i) => [l.nombre, i])),
    [],
  );

  return (
    <group>
      {/* Placa del campo con grilla de lotes */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[COLS * ESPACIO + 0.6, FILAS * ESPACIO + 0.6]} />
        <meshStandardMaterial color={HEX.paper300} roughness={1} />
      </mesh>
      <gridHelper
        args={[COLS * ESPACIO + 0.6, 16, HEX.paper50, HEX.paper50]}
        position={[0, 0.001, 0]}
        scale={[1, 1, (FILAS * ESPACIO + 0.6) / (COLS * ESPACIO + 0.6)]}
      />
      {LOTES_EJEMPLO.map((l) => (
        <Columna
          key={l.nombre}
          lote={l}
          activo={activo}
          retraso={(orden.get(l.nombre) ?? 0) * 0.05}
          seleccionado={sel?.nombre === l.nombre}
          onSeleccion={setSel}
        />
      ))}
    </group>
  );
}

export default function Barras3D() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(false);
  const [visible, setVisible] = useState(false);
  const sinMovimiento = useReducedMotion();

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setActivo(true);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={contenedor} className="h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [7, 6, 8.2], fov: 34 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 9, 4]} intensity={1.6} />
        <directionalLight position={[-6, 3, -4]} intensity={0.35} color={HEX.brand200} />
        <Escena activo={activo} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={!sinMovimiento}
          autoRotateSpeed={0.6}
          minPolarAngle={0.5}
          maxPolarAngle={1.2}
          target={[0, 0.6, 0]}
        />
      </Canvas>
    </div>
  );
}
