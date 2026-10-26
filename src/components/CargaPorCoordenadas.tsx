"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "@/components/Icono";
import { boton, enlace } from "@/lib/estilos";
import {
  CAMPO_VACIO,
  EJES,
  anilloDeFilas,
  editarCampo,
  estadoEje,
  filaDesdeVertice,
  limpiarDecimal,
  limpiarEntero,
  verticeDeFila,
  verticesDePegado,
  type CampoEje,
  type Eje,
  type FilaVertice,
  type Formato,
} from "@/lib/campo-coordenada";
import { leerVertices, validarAnillo } from "@/lib/coordenadas";
import type { Coordenada } from "@/lib/types";

/** Lo que el mapa dibuja mientras se cargan los vertices. */
export interface VistaPreviaLote {
  /** Un lugar por fila, en el orden de la lista: el numero del pin es el de la fila. */
  vertices: (Coordenada | null)[];
  /** El poligono, cuando ya hay tres vertices validos. */
  anillo: Coordenada[] | null;
  valido: boolean;
  /** Fila con el foco: su pin se resalta en el mapa. */
  resaltado: number | null;
}

interface Props {
  centroPartido?: Coordenada | null;
  onCambio: (vista: VistaPreviaLote) => void;
  onContinuar: (anillo: Coordenada[]) => void;
  onCancelar: () => void;
}

type Parte = keyof CampoEje;

/** Orden de los campos dentro de una fila, segun el formato: es el orden de Tab y de Enter. */
const PARTES: Record<Formato, [Eje, Parte][]> = {
  decimal: [
    ["lat", "dec"],
    ["lon", "dec"],
  ],
  dms: [
    ["lat", "g"],
    ["lat", "m"],
    ["lat", "s"],
    ["lon", "g"],
    ["lon", "m"],
    ["lon", "s"],
  ],
};

const FILAS_INICIALES = 4;

// El id sale de las filas mismas y no de un contador global: un contador de modulo se reinicia
// (recarga en caliente, otro montaje) y repetia ids, con renglones que React confundia.
const siguienteId = (filas: FilaVertice[]) => filas.reduce((max, f) => Math.max(max, f.id), 0) + 1;
const filaVaciaCon = (id: number): FilaVertice => ({ id, lat: CAMPO_VACIO, lon: CAMPO_VACIO });

function limpiar(parte: Parte, texto: string): string {
  if (parte === "dec") return limpiarDecimal(texto);
  if (parte === "s") return limpiarDecimal(texto, 2, 2);
  return limpiarEntero(texto, 2);
}

/**
 * Alta de lote por coordenadas: un renglon por vertice, con latitud y longitud en campos
 * separados que no dejan escribir un valor imposible (ver lib/campo-coordenada). El mapa de al
 * lado dibuja cada vertice numerado a medida que se completa, asi el error de orden o de un
 * digito se ve antes de guardar.
 *
 * Para quien ya tiene la lista (plano, GPS, GeoJSON) se puede pegar entera, o pegar un par en
 * cualquier campo: se reparte sola en los renglones.
 */
export function CargaPorCoordenadas({ centroPartido, onCambio, onContinuar, onCancelar }: Props) {
  const [formato, setFormato] = useState<Formato>("decimal");
  const [filas, setFilas] = useState<FilaVertice[]>(() => Array.from({ length: FILAS_INICIALES }, (_, i) => filaVaciaCon(i + 1)));
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [resaltado, setResaltado] = useState<number | null>(null);
  const [pegando, setPegando] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [errorPegado, setErrorPegado] = useState<string | null>(null);
  const campos = useRef(new Map<string, HTMLInputElement>());
  const enfocarLuego = useRef<string | null>(null);

  const clave = (filaId: number, eje: Eje, parte: Parte) => `${filaId}:${eje}:${parte}`;

  // El foco a una fila recien creada se da despues de que exista en el DOM.
  useEffect(() => {
    if (!enfocarLuego.current) return;
    campos.current.get(enfocarLuego.current)?.focus();
    enfocarLuego.current = null;
  });

  const armado = useMemo(() => anilloDeFilas(filas, formato), [filas, formato]);
  const validacion = useMemo(
    () => ("anillo" in armado ? validarAnillo(armado.anillo, centroPartido) : null),
    [armado, centroPartido],
  );
  const listo = "anillo" in armado && validacion?.error === null;

  const vista = useMemo<VistaPreviaLote>(
    () => ({
      vertices: filas.map((f) => verticeDeFila(f, formato)),
      anillo: "anillo" in armado ? armado.anillo : null,
      valido: listo,
      resaltado,
    }),
    [filas, formato, armado, listo, resaltado],
  );
  useEffect(() => onCambio(vista), [vista, onCambio]);

  const editar = (filaId: number, eje: Eje, parte: Parte, texto: string) => {
    const valor = limpiar(parte, texto);
    setFilas((actuales) =>
      actuales.map((f) => (f.id === filaId ? { ...f, [eje]: editarCampo(eje, f[eje], { [parte]: valor }, formato) } : f)),
    );
    // En grados-minutos-segundos los grados y los minutos tienen siempre dos digitos: al
    // completarlos se pasa solo al siguiente campo.
    if (formato === "dms" && parte !== "s" && valor.length === 2) {
      const orden = PARTES.dms;
      const i = orden.findIndex(([e, p]) => e === eje && p === parte);
      const [e, p] = orden[i + 1];
      campos.current.get(clave(filaId, e, p))?.focus();
    }
  };

  const agregarFila = (enfocar: boolean) => {
    const nueva = filaVaciaCon(siguienteId(filas));
    setFilas((actuales) => [...actuales, nueva]);
    if (enfocar) enfocarLuego.current = clave(nueva.id, ...PARTES[formato][0]);
  };

  const quitarFila = (filaId: number) => setFilas((actuales) => (actuales.length > 3 ? actuales.filter((f) => f.id !== filaId) : actuales));

  /** Enter avanza como Tab, y en el ultimo campo del ultimo vertice agrega uno nuevo. */
  const alEnter = (indiceFila: number, eje: Eje, parte: Parte) => {
    const orden = PARTES[formato];
    const i = orden.findIndex(([e, p]) => e === eje && p === parte);
    if (i < orden.length - 1) {
      campos.current.get(clave(filas[indiceFila].id, ...orden[i + 1]))?.focus();
    } else if (indiceFila < filas.length - 1) {
      campos.current.get(clave(filas[indiceFila + 1].id, ...orden[0]))?.focus();
    } else {
      agregarFila(true);
    }
  };

  /** Un par (o varios) pegado en un campo se reparte desde esa fila hacia abajo. */
  const alPegar = (e: React.ClipboardEvent, indiceFila: number) => {
    const vertices = verticesDePegado(e.clipboardData.getData("text"));
    if (!vertices) return; // Un numero suelto: lo pega el navegador y lo limpia editar().
    e.preventDefault();
    setFilas((actuales) => {
      const siguientes = [...actuales];
      vertices.forEach((v, k) => {
        const i = indiceFila + k;
        siguientes[i] = filaDesdeVertice(siguientes[i]?.id ?? siguienteId(siguientes), v);
      });
      return siguientes;
    });
  };

  const cargarPegado = () => {
    const vertices = verticesDePegado(textoPegado);
    if (!vertices) {
      const leidos = leerVertices(textoPegado);
      setErrorPegado(leidos.ok ? "Hay vértices que no son coordenadas de Argentina: revisá los números." : leidos.error);
      return;
    }
    // Ids nuevos para todas: los renglones viejos se van y React no tiene que reutilizar ninguno.
    const base = siguienteId(filas);
    const nuevas = vertices.map((v, k) => filaDesdeVertice(base + k, v));
    while (nuevas.length < 3) nuevas.push(filaVaciaCon(base + nuevas.length));
    setFilas(nuevas);
    setTextoPegado("");
    setErrorPegado(null);
    setPegando(false);
  };

  const marcarTocado = (filaId: number, eje: Eje) => setTocados((t) => new Set(t).add(`${filaId}:${eje}`));

  const alCambiarFormato = (nuevo: Formato) => {
    setFormato(nuevo);
    setTocados(new Set());
  };

  const estadoPie = () => {
    if ("pendiente" in armado) return <p className="text-ink-600">{armado.pendiente}</p>;
    if (validacion?.error) return <p className="text-risk-alto-ink">{validacion.error}</p>;
    return (
      <>
        <p className="font-medium text-risk-bajo-ink">
          {armado.anillo.length} vértices · {validacion!.hectareas.toLocaleString("es-AR")} ha · perímetro{" "}
          {validacion!.perimetroKm.toLocaleString("es-AR")} km
        </p>
        {validacion!.advertencias.map((a) => (
          <p key={a} className="text-risk-medio-ink">
            {a}
          </p>
        ))}
      </>
    );
  };

  return (
    <section aria-labelledby="titulo-coordenadas" className="flex flex-col rounded-2xl border border-paper-300 bg-paper-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-coordenadas" className="font-display text-lg font-medium text-ink-950">
            Lote por coordenadas
          </h2>
          <p className="mt-0.5 text-sm text-ink-600">Cargá las esquinas en orden, siguiendo el borde del lote.</p>
        </div>
        <button onClick={onCancelar} aria-label="Cerrar" className="rounded-full p-1.5 text-ink-600 hover:bg-paper-200 hover:text-ink-950">
          <Icono nombre="cerrar" className="h-4 w-4" />
        </button>
      </div>

      <div role="radiogroup" aria-label="Formato de las coordenadas" className="mt-4 grid grid-cols-2 rounded-full bg-paper-200 p-1 text-sm">
        {(
          [
            ["decimal", "Decimal"],
            ["dms", "Grados° min′ seg″"],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            role="radio"
            aria-checked={formato === valor}
            onClick={() => alCambiarFormato(valor)}
            className={`rounded-full px-3 py-1.5 transition-colors ${formato === valor ? "bg-paper-50 font-medium text-ink-950 shadow-sm" : "text-ink-600 hover:text-ink-950"}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-600">
        Sin signo menos: en Argentina todo es latitud sur (S) y longitud oeste (O).
      </p>

      <div className="mt-4 grid grid-cols-[1.75rem_1fr_1fr_1.75rem] items-end gap-x-2 px-0.5 text-xs font-medium text-ink-700">
        <span />
        <span>Latitud</span>
        <span>Longitud</span>
        <span />
      </div>

      <ol className="mt-1 space-y-1.5">
        {filas.map((fila, i) => {
          const errores = (["lat", "lon"] as const)
            .map((eje) => {
              const estado = estadoEje(eje, fila[eje], formato);
              const escrito = PARTES[formato].filter(([e]) => e === eje).some(([, p]) => fila[eje][p].length >= 2);
              const tocado = tocados.has(`${fila.id}:${eje}`);
              return {
                eje,
                error: estado.error && (escrito || tocado) ? estado.error : undefined,
                aviso: !estado.error && tocado ? estado.aviso : undefined,
              };
            })
            .filter((x) => x.error || x.aviso);
          const resaltada = resaltado === i;
          return (
            <li key={fila.id} onFocus={() => setResaltado(i)} onBlur={() => setResaltado(null)}>
              <div className="grid grid-cols-[1.75rem_1fr_1fr_1.75rem] items-center gap-x-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs tabular-nums ${resaltada ? "bg-brand-700 text-paper-50" : "bg-paper-200 text-ink-700"}`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {(["lat", "lon"] as const).map((eje) => (
                  <CampoCoordenada
                    key={eje}
                    eje={eje}
                    campo={fila[eje]}
                    formato={formato}
                    numero={i + 1}
                    // El ejemplo va solo en el primer renglon: repetido en todos parecia un valor ya cargado.
                    conEjemplo={i === 0}
                    conError={errores.some((x) => x.eje === eje && x.error)}
                    registrar={(parte, el) => {
                      const k = clave(fila.id, eje, parte);
                      if (el) campos.current.set(k, el);
                      else campos.current.delete(k);
                    }}
                    onEditar={(parte, texto) => editar(fila.id, eje, parte, texto)}
                    onEnter={(parte) => alEnter(i, eje, parte)}
                    onPegar={(e) => alPegar(e, i)}
                    onSalir={() => marcarTocado(fila.id, eje)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => quitarFila(fila.id)}
                  disabled={filas.length <= 3}
                  aria-label={`Quitar el vértice ${i + 1}`}
                  title={filas.length <= 3 ? "Un lote necesita al menos tres vértices" : `Quitar el vértice ${i + 1}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-600 hover:bg-paper-200 hover:text-risk-alto-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Icono nombre="cerrar" className="h-3.5 w-3.5" />
                </button>
              </div>
              {errores.length > 0 && (
                <div className="ml-[2.25rem] mt-0.5 space-y-0.5 text-xs">
                  {errores.map((x) => (
                    <p key={x.eje} className={x.error ? "text-risk-alto-ink" : "text-risk-medio-ink"}>
                      {EJES[x.eje].etiqueta}: {x.error ?? x.aviso}
                    </p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => agregarFila(true)} className={boton.sutil}>
          <Icono nombre="mas" className="h-3.5 w-3.5" />
          Agregar vértice
        </button>
        <button type="button" onClick={() => setPegando(!pegando)} className={`text-sm ${enlace}`}>
          {pegando ? "Volver a la carga por vértice" : "¿Tenés la lista? Pegala"}
        </button>
      </div>

      {pegando && (
        <div className="mt-3 rounded-xl border border-paper-300 bg-paper-100 p-3">
          <label htmlFor="pegado-coordenadas" className="text-xs font-medium text-ink-950">
            Un vértice por línea, o un GeoJSON
          </label>
          <textarea
            id="pegado-coordenadas"
            rows={4}
            value={textoPegado}
            onChange={(e) => {
              setTextoPegado(e.target.value);
              setErrorPegado(null);
            }}
            placeholder={"-35.4412, -60.9010\n-35.4412, -60.8890\n-35.4520, -60.8890"}
            className="mt-1 w-full resize-y rounded-lg border border-paper-300 bg-paper-50 px-2.5 py-2 font-mono text-xs outline-none focus:border-brand-500"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
            Sirve lo que exporta un GPS, Google Earth o un SIG: decimal o grados-minutos-segundos, con o sin signo, en
            cualquier orden latitud/longitud. Reemplaza los vértices de arriba, que después podés revisar uno por uno.
          </p>
          {errorPegado && <p className="mt-1 text-xs text-risk-alto-ink">{errorPegado}</p>}
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={cargarPegado} disabled={!textoPegado.trim()} className={boton.secundario}>
              Cargar vértices
            </button>
          </div>
        </div>
      )}

      <div aria-live="polite" className="mt-4 space-y-1 border-t border-paper-200 pt-3 text-sm">
        {estadoPie()}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className={boton.sutil}>
          Cancelar
        </button>
        <button type="button" onClick={() => "anillo" in armado && onContinuar(armado.anillo)} disabled={!listo} className={boton.primario}>
          Continuar
        </button>
      </div>
    </section>
  );
}

interface CampoProps {
  eje: Eje;
  campo: CampoEje;
  formato: Formato;
  numero: number;
  conEjemplo: boolean;
  conError: boolean;
  registrar: (parte: Parte, el: HTMLInputElement | null) => void;
  onEditar: (parte: Parte, texto: string) => void;
  onEnter: (parte: Parte) => void;
  onPegar: (e: React.ClipboardEvent) => void;
  onSalir: () => void;
}

/** Latitud o longitud de un vertice: un campo en decimal, tres en grados-minutos-segundos. */
function CampoCoordenada({ eje, campo, formato, numero, conEjemplo, conError, registrar, onEditar, onEnter, onPegar, onSalir }: CampoProps) {
  const { etiqueta, hemisferio } = EJES[eje];
  const borde = conError ? "border-risk-alto focus-within:border-risk-alto" : "border-paper-300 focus-within:border-brand-500";
  const input = (parte: Parte, ancho: string, placeholder: string, nombre: string) => (
    <input
      ref={(el) => registrar(parte, el)}
      value={campo[parte]}
      onChange={(e) => onEditar(parte, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter(parte);
        }
      }}
      onPaste={onPegar}
      onBlur={onSalir}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      placeholder={conEjemplo ? placeholder : undefined}
      aria-label={`${etiqueta} del vértice ${numero}, ${nombre}`}
      aria-invalid={conError}
      className={`${ancho} min-w-0 bg-transparent py-1.5 text-right font-mono text-sm tabular-nums text-ink-950 outline-none placeholder:text-ink-600/40`}
    />
  );

  return (
    <div className={`flex min-w-0 items-center rounded-lg border bg-paper-50 px-2 ${borde}`}>
      {formato === "decimal" ? (
        <>
          {input("dec", "w-full", eje === "lat" ? "35.4412" : "60.9010", "en grados decimales")}
          <span className="pl-1 text-xs text-ink-600">°{hemisferio}</span>
        </>
      ) : (
        <>
          {input("g", "w-5", "35", "grados")}
          <span className="text-xs text-ink-600">°</span>
          {input("m", "w-5", "26", "minutos")}
          <span className="text-xs text-ink-600">′</span>
          {input("s", "w-12", "28.5", "segundos")}
          <span className="text-xs text-ink-600">″</span>
          <span className="ml-auto pl-1 text-xs text-ink-600">{hemisferio}</span>
        </>
      )}
    </div>
  );
}
