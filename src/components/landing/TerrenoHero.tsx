"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { HEX } from "@/components/landing/colores";
import { altura, CICLO_S, nivelAgua } from "@/components/landing/modelo-hero";

/**
 * Terreno procedural del hero: una loma al noreste y un bajo al sudoeste, con curvas de nivel
 * dibujadas en el shader. El agua sube y baja en un ciclo lento: es el concepto del producto
 * ("donde se junta primero") contado sin texto. Todo se genera en el cliente con unas pocas
 * sumas de senos: no hay modelo exportado ni assets que bajar.
 */

const LADO = 14;
const SEGMENTOS = 140;

const vertex = /* glsl */ `
  attribute float aAltura;
  varying float vAltura;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vAltura = aAltura;
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uNivel;
  uniform vec3 uBajo;
  uniform vec3 uMedio;
  uniform vec3 uAlto;
  uniform vec3 uAgua;
  uniform vec3 uAguaHonda;
  uniform vec3 uLinea;
  uniform vec3 uOrilla;
  varying float vAltura;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 base = vAltura < 0.5 ? mix(uBajo, uMedio, vAltura / 0.5) : mix(uMedio, uAlto, (vAltura - 0.5) / 0.5);
    float luz = clamp(dot(normalize(vNormal), normalize(vec3(0.4, 0.9, 0.3))), 0.0, 1.0);
    vec3 color = base * (0.55 + 0.6 * luz);

    // Curvas de nivel cada 0.06 de altura, con antialias por derivada.
    float k = vAltura / 0.06;
    float d = abs(fract(k - 0.5) - 0.5) / fwidth(k);
    float linea = 1.0 - min(d, 1.0);
    color = mix(color, uLinea, linea * 0.35);

    // Agua: tinte por profundidad y una orilla calida (el borde que el productor mira).
    float prof = uNivel - vAltura;
    if (prof > 0.0) {
      vec3 agua = mix(uAgua, uAguaHonda, clamp(prof / 0.25, 0.0, 1.0));
      color = mix(color, agua, 0.82);
    }
    float orilla = 1.0 - smoothstep(0.0, 0.012, abs(prof));
    color = mix(color, uOrilla, orilla * 0.9);

    // Bordes del bloque se apagan hacia el fondo del hero.
    float r = length(vPos.xz) / ${(LADO / 2).toFixed(1)};
    color = mix(color, vec3(0.0, 0.0129, 0.0242), smoothstep(0.72, 1.0, r));
    gl_FragColor = vec4(color, 1.0);
    // Los uniforms THREE.Color estan en lineal: sin esto el agua sale casi negra.
    #include <colorspace_fragment>
  }
`;

function Terreno({ animar, onNivel }: { animar: boolean; onNivel?: (n: number) => void }) {
  const geometria = useMemo(() => {
    const g = new THREE.PlaneGeometry(LADO, LADO, SEGMENTOS, SEGMENTOS);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const alturas = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const h = altura(pos.getX(i), pos.getZ(i));
      alturas[i] = h;
      pos.setY(i, h * 1.6);
    }
    g.setAttribute("aAltura", new THREE.BufferAttribute(alturas, 1));
    g.computeVertexNormals();
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uNivel: { value: nivelAgua(CICLO_S * 0.3) },
      uBajo: { value: new THREE.Color("#3f5e35") },
      uMedio: { value: new THREE.Color("#7d7144") },
      uAlto: { value: new THREE.Color("#b5a179") },
      uAgua: { value: new THREE.Color(HEX.brand500) },
      uAguaHonda: { value: new THREE.Color(HEX.brand700) },
      uLinea: { value: new THREE.Color(HEX.paper50) },
      uOrilla: { value: new THREE.Color(HEX.clay400) },
    }),
    [],
  );

  const material = useRef<THREE.ShaderMaterial>(null);
  const ultimoAviso = useRef(0);
  useFrame(({ clock }) => {
    if (!animar) return;
    const n = nivelAgua(clock.elapsedTime + CICLO_S * 0.1);
    if (material.current) material.current.uniforms.uNivel.value = n;
    // El HUD se actualiza ~8 veces por segundo, no en cada frame: alcanza para leerse en vivo.
    if (onNivel && clock.elapsedTime - ultimoAviso.current > 0.12) {
      ultimoAviso.current = clock.elapsedTime;
      onNivel(n);
    }
  });

  useEffect(() => () => geometria.dispose(), [geometria]);

  return (
    <mesh geometry={geometria}>
      <shaderMaterial ref={material} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  );
}

/** Camara en orbita lenta que ademas sigue un poco al puntero (parallax). */
function Camara({ animar }: { animar: boolean }) {
  const objetivo = useRef(new THREE.Vector2(0, 0));
  useEffect(() => {
    const mover = (e: PointerEvent) => {
      objetivo.current.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", mover, { passive: true });
    return () => window.removeEventListener("pointermove", mover);
  }, []);

  useFrame(({ camera, clock }) => {
    // Vaiven acotado, no orbita completa: el bajo nunca queda detras del titular.
    const t = animar ? Math.sin(clock.elapsedTime * 0.08) * 0.35 : 0;
    const ang = 3.75 + t + objetivo.current.x * 0.12;
    const radio = 13;
    const destino = new THREE.Vector3(Math.cos(ang) * radio, 7.2 - objetivo.current.y * 0.8, Math.sin(ang) * radio);
    camera.position.lerp(destino, 0.04);
    camera.lookAt(-0.8, 0.4, 0.6);
  });
  return null;
}

export default function TerrenoHero({ onNivel }: { onNivel?: (n: number) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const animar = !useReducedMotion();

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    // Fuera de pantalla no se renderiza: el hero no gasta GPU mientras se lee el resto.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={contenedor} className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={visible && animar ? "always" : "demand"}
        camera={{ position: [-10, 7, -7], fov: 38 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={[HEX.brand950]} />
        <Terreno animar={animar} onNivel={onNivel} />
        <Camara animar={animar} />
      </Canvas>
    </div>
  );
}
