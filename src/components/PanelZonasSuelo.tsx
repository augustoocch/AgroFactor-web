"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeAntiguedad, BadgeProcedencia } from "@/components/BadgeProcedencia";
import { ConfirmarBorrado } from "@/components/ConfirmarBorrado";
import { InfoModal } from "@/components/InfoModal";
import { Modal } from "@/components/Modal";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Coordenada, ProcedenciaDato, ZonaSuelo } from "@/lib/types";

/**
 * Suelo del lote, por sector.
 *
 * Por qué existe: hasta ahora el motor asumía grupo hidrológico D para todos los lotes sin
 * verificar ninguno. 28 de 29 asesores condicionan el uso de la estimación a su precisión, y 7
 * objetan expresamente por eso ("cómo se mide y se hace específico para cada lote").
 *
 * Por qué por zonas y no un campo por lote: un lote de 3.000 ha no tiene un solo tipo de suelo, y
 * promediarlo borraría justo la diferencia por la que el bajo se anega antes que la loma.
 *
 * Diseño de la carga, contra la advertencia del research —la persona principal "desconfía de las
 * soluciones que exigen carga manual de datos" y 1 de 3 productores no dedicaría tiempo—:
 *
 * - **Opcional.** Sin zonas cargadas el lote calcula igual, con el supuesto regional declarado.
 * - **Incremental.** Se puede dibujar hoy, poner la napa la semana que viene y la textura cuando
 *   vuelva el análisis. Cada dato que entra mejora el cálculo; ninguno es un requisito.
 * - **Con beneficio visible.** El atajo de 30 segundos (¿arenoso o arcilloso?) ya mueve el número
 *   de curva, y el panel muestra cuánto cambió la estimación al cargarlo.
 */

/**
 * Atajo de 30 segundos. Son los tres suelos que el productor distingue a ojo y por el tacto, y
 * los porcentajes son el centro del rango de cada clase en el triángulo USDA, no un invento: se
 * usan solo como punto de partida y la pantalla dice que es una estimación gruesa.
 */
const PRESETS: { nombre: string; descripcion: string; arena: number; limo: number; arcilla: number }[] = [
  { nombre: "Arenoso", descripcion: "se desgrana en la mano, el agua se va rápido", arena: 65, limo: 25, arcilla: 10 },
  { nombre: "Intermedio", descripcion: "franco: ni se desgrana ni se hace plastilina", arena: 40, limo: 40, arcilla: 20 },
  { nombre: "Arcilloso", descripcion: "se hace un chorizo entre los dedos, se agrieta al secarse", arena: 20, limo: 20, arcilla: 60 },
];

interface Props {
  loteId: string;
  /** Anillo dibujado en el mapa que todavía no se guardó. Lo provee la pantalla del lote. */
  anilloPendiente: Coordenada[] | null;
  onAnilloConsumido: () => void;
  onPedirDibujo: () => void;
}

export function PanelZonasSuelo({ loteId, anilloPendiente, onAnilloConsumido, onPedirDibujo }: Props) {
  const { notificar } = useToast();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<ZonaSuelo | null>(null);
  const [aBorrar, setABorrar] = useState<ZonaSuelo | null>(null);

  const { data: zonas = [], isLoading } = useQuery({
    queryKey: ["zonas-suelo", loteId],
    queryFn: () => api.get<ZonaSuelo[]>(`/lotes/${loteId}/zonas-suelo`),
  });

  const borrar = useMutation({
    mutationFn: (zonaId: string) => api.delete(`/lotes/${loteId}/zonas-suelo/${zonaId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["zonas-suelo", loteId] });
      void queryClient.invalidateQueries({ queryKey: ["simulacion"] });
      setABorrar(null);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const cobertura = zonas.reduce((suma, z) => suma + (z.fraccionDelLote ?? 0), 0);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Opcional. Mejora el cálculo de cuánta lluvia absorbe el lote antes de que el agua empiece a correr.
        </p>
        <InfoModal titulo="Para qué sirve cargar el suelo" etiqueta="Por qué conviene cargarlo">
          <p>
            El sistema tiene que saber cuánta lluvia absorbe tu campo antes de que empiece a correr
            el agua. Sin dato asume el peor caso: suelo sódico que casi no absorbe, que es el
            dominante en la Cuenca del Salado pero <strong>no</strong> en el oeste arenoso.
          </p>
          <p className="mt-2">
            La diferencia no es menor: sobre una pastura, con una lluvia de 50 mm, asumir el peor
            caso sobreestima el agua que corre en un 43 %.
          </p>
          <p className="mt-2">
            <strong>Lo que más cambia el cálculo es la napa</strong>, no la textura. Si la freática
            está a menos de 60 cm, el lote escurre como el peor suelo aunque sea arenoso. Si tenés
            una lectura de pozo, ese es el dato que más rinde cargar.
          </p>
          <p className="mt-2 text-ink-600">
            Nada de esto es obligatorio. Sin cargar nada el lote se calcula igual y el sistema
            avisa que está usando un supuesto en vez de una medición.
          </p>
        </InfoModal>
      </div>

      {zonas.length > 0 && (
        <p className="mt-1 text-sm text-ink-600">
          Suelo medido en el {Math.round(cobertura * 100)} % del lote. El resto se calcula con el
          supuesto regional.
        </p>
      )}

      {isLoading && <p className="mt-4 text-sm text-ink-600">Cargando…</p>}

      {!isLoading && zonas.length === 0 && !anilloPendiente && !editando && (
        <div className="mt-4 rounded-xl border border-dashed border-paper-300 bg-paper-100/40 p-5">
          <p className="text-sm text-ink-800">Todavía no cargaste el suelo de este lote.</p>
          <p className="mt-1 text-sm text-ink-600">
            Se está calculando con el supuesto regional: grupo hidrológico D, el de los suelos
            sódicos de la Pampa Deprimida. Si tu campo no es así, el cálculo te está sobreestimando
            el agua.
          </p>
          <button
            onClick={onPedirDibujo}
            className="mt-3 rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
          >
            Dibujar un sector en el mapa
          </button>
        </div>
      )}

      {/* En modal y no debajo del mapa: el formulario aparecia fuera de la vista despues de
          dibujar y habia que buscarlo scrolleando, sin ninguna senal de que existia. */}
      <Modal
        abierto={anilloPendiente !== null || editando !== null}
        onCerrar={() => {
          setEditando(null);
          onAnilloConsumido();
        }}
        titulo={editando ? `Editar "${editando.nombre}"` : "Nuevo sector de suelo"}
        ancho="lg"
      >
        {(anilloPendiente || editando) && (
          <FormularioZona
            loteId={loteId}
            anillo={anilloPendiente}
            zona={editando}
            onCerrar={() => {
              setEditando(null);
              onAnilloConsumido();
            }}
          />
        )}
      </Modal>

      {zonas.length > 0 && (
        <ul className="mt-4 space-y-3">
          {zonas.map((zona) => (
            <li key={zona.id} className="rounded-xl border border-paper-300 bg-paper-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink-900">{zona.nombre}</p>
                  <p className="text-xs text-ink-600">
                    {zona.superficieHectareas.toFixed(1)} ha
                    {zona.fraccionDelLote != null &&
                      ` · ${Math.round(zona.fraccionDelLote * 100)} % del lote`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditando(zona)}
                    className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:bg-paper-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setABorrar(zona)}
                    className="rounded-full border border-paper-300 px-3 py-1 text-xs text-ink-700 hover:bg-paper-200"
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-600">Textura</dt>
                  <dd className="text-sm text-ink-900">
                    {zona.arenaPct != null ? (
                      <>
                        {zona.arenaPct}% arena · {zona.limoPct}% limo · {zona.arcillaPct}% arcilla
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {zona.procedenciaTextura && (
                            <BadgeProcedencia procedencia={zona.procedenciaTextura} />
                          )}
                          {zona.antiguedadTextura && (
                            <BadgeAntiguedad
                              antiguedad={zona.antiguedadTextura}
                              medidoEn={zona.texturaMedidaEn}
                            />
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-ink-600">sin cargar — se resuelve por satélite</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-600">Napa</dt>
                  <dd className="text-sm text-ink-900">
                    {zona.napaCm != null ? (
                      <>
                        {zona.napaCm} cm
                        {zona.napaCm < 60 && (
                          <span className="ml-1 text-risk-alto">
                            — a menos de 60 cm el lote escurre como grupo D
                          </span>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {zona.procedenciaNapa && <BadgeProcedencia procedencia={zona.procedenciaNapa} />}
                          {zona.antiguedadNapa && (
                            <BadgeAntiguedad antiguedad={zona.antiguedadNapa} medidoEn={zona.napaMedidaEn} />
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-ink-600">sin cargar</span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <ConfirmarBorrado
        abierto={aBorrar !== null}
        titulo="Borrar el sector de suelo"
        queSeBorra={
          aBorrar
            ? `el sector "${aBorrar.nombre}". Esa superficie del lote vuelve a calcularse con el supuesto regional.`
            : ""
        }
        borrando={borrar.isPending}
        onConfirmar={() => aBorrar && borrar.mutate(aBorrar.id)}
        onCerrar={() => setABorrar(null)}
      />

      {zonas.length > 0 && !anilloPendiente && !editando && (
        <button
          onClick={onPedirDibujo}
          className="mt-4 rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          + Otro sector
        </button>
      )}
    </section>
  );
}

function FormularioZona({
  loteId,
  anillo,
  zona,
  onCerrar,
}: {
  loteId: string;
  anillo: Coordenada[] | null;
  zona: ZonaSuelo | null;
  onCerrar: () => void;
}) {
  const { notificar } = useToast();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState(zona?.nombre ?? "");
  const [arena, setArena] = useState(zona?.arenaPct?.toString() ?? "");
  const [limo, setLimo] = useState(zona?.limoPct?.toString() ?? "");
  const [arcilla, setArcilla] = useState(zona?.arcillaPct?.toString() ?? "");
  const [napa, setNapa] = useState(zona?.napaCm?.toString() ?? "");
  const [procedenciaTextura, setProcedenciaTextura] = useState<ProcedenciaDato>(
    zona?.procedenciaTextura ?? "DECLARADA",
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const [texturaMedidaEn, setTexturaMedidaEn] = useState(zona?.texturaMedidaEn ?? hoy);
  const [napaMedidaEn, setNapaMedidaEn] = useState(zona?.napaMedidaEn ?? hoy);

  const geometria = zona?.geometria ?? anillo ?? [];
  const numero = (v: string) => (v.trim() === "" ? null : Number(v));

  const suma = [arena, limo, arcilla].every((v) => v.trim() !== "")
    ? Number(arena) + Number(limo) + Number(arcilla)
    : null;
  // Mismo criterio que el backend y el motor: no se normaliza en silencio, se avisa.
  const texturaInvalida = suma != null && Math.abs(suma - 100) > 2;
  const texturaIncompleta =
    [arena, limo, arcilla].some((v) => v.trim() !== "") &&
    [arena, limo, arcilla].some((v) => v.trim() === "");

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = {
        nombre: nombre.trim(),
        geometria,
        arenaPct: numero(arena),
        limoPct: numero(limo),
        arcillaPct: numero(arcilla),
        napaCm: numero(napa),
        procedenciaTextura: numero(arena) != null ? procedenciaTextura : null,
        texturaMedidaEn: numero(arena) != null ? texturaMedidaEn : null,
        procedenciaNapa: numero(napa) != null ? "DECLARADA" : null,
        napaMedidaEn: numero(napa) != null ? napaMedidaEn : null,
      };
      return zona
        ? api.put<ZonaSuelo>(`/lotes/${loteId}/zonas-suelo/${zona.id}`, cuerpo)
        : api.post<ZonaSuelo>(`/lotes/${loteId}/zonas-suelo`, cuerpo);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["zonas-suelo", loteId] });
      // El suelo cambia el número de curva: la simulación que hubiera en pantalla quedó vieja.
      void queryClient.invalidateQueries({ queryKey: ["simulacion"] });
      notificar("exito", "Sector guardado. El cálculo del lote ya lo está usando.");
      onCerrar();
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => guardar.mutate() : undefined);
    },
  });

  const puedeGuardar =
    nombre.trim() !== "" && geometria.length >= 3 && !texturaInvalida && !texturaIncompleta;

  return (
    <div>
      <label className="block text-xs text-ink-700">
        Nombre del sector
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="El bajo del molino"
          className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-ink-800">
          ¿Cómo es el suelo de este sector? <span className="font-normal text-ink-600">(30 segundos)</span>
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.nombre}
              type="button"
              onClick={() => {
                setArena(String(p.arena));
                setLimo(String(p.limo));
                setArcilla(String(p.arcilla));
                setProcedenciaTextura("DECLARADA");
              }}
              className="rounded-lg border border-paper-300 bg-paper-50 p-2.5 text-left transition-colors hover:border-brand-500"
            >
              <span className="block text-sm text-ink-900">{p.nombre}</span>
              <span className="block text-[11px] leading-tight text-ink-600">{p.descripcion}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-600">
          Es una estimación gruesa y el sistema la marca como declarada. Si tenés un análisis de
          laboratorio, cargá los porcentajes exactos abajo: vale bastante más.
        </p>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {([
          ["Arena %", arena, setArena],
          ["Limo %", limo, setLimo],
          ["Arcilla %", arcilla, setArcilla],
        ] as const).map(([etiqueta, valor, set]) => (
          <label key={etiqueta} className="block text-xs text-ink-700">
            {etiqueta}
            <input
              type="number"
              min={0}
              max={100}
              value={valor}
              onChange={(e) => set(e.target.value)}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900"
            />
          </label>
        ))}
      </div>

      {texturaInvalida && (
        <p className="mt-2 text-xs text-risk-alto">
          Arena, limo y arcilla tienen que sumar 100 % — suman {suma}. Revisá el análisis.
        </p>
      )}
      {texturaIncompleta && (
        <p className="mt-2 text-xs text-risk-alto">
          Faltan fracciones: con dos de las tres no se puede clasificar el suelo. Cargá las tres o
          ninguna.
        </p>
      )}

      {!texturaInvalida && !texturaIncompleta && arena.trim() !== "" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-ink-700">
            ¿De dónde sale este dato?
            <select
              value={procedenciaTextura}
              onChange={(e) => setProcedenciaTextura(e.target.value as ProcedenciaDato)}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900"
            >
              <option value="DECLARADA">Lo sé por conocer el campo</option>
              <option value="LABORATORIO">Análisis de laboratorio</option>
            </select>
          </label>
          <label className="block text-xs text-ink-700">
            ¿De cuándo es?
            <input
              type="date"
              max={hoy}
              value={texturaMedidaEn}
              onChange={(e) => setTexturaMedidaEn(e.target.value)}
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900"
            />
          </label>
        </div>
      )}

      <div className="mt-5 border-t border-paper-300 pt-4">
        <p className="text-xs font-medium text-ink-800">
          Profundidad de la napa <span className="font-normal text-brand-700">— el dato que más cambia el cálculo</span>
        </p>
        <p className="mt-1 text-[11px] text-ink-600">
          Si la freática está a menos de 60 cm, el sector escurre como el peor suelo posible aunque
          sea arenoso. Si medís un pozo, cargalo acá.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-ink-700">
            Profundidad (cm)
            <input
              type="number"
              min={0}
              max={5000}
              value={napa}
              onChange={(e) => setNapa(e.target.value)}
              placeholder="120"
              className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900"
            />
          </label>
          {napa.trim() !== "" && (
            <label className="block text-xs text-ink-700">
              ¿De cuándo es la lectura?
              <input
                type="date"
                max={hoy}
                value={napaMedidaEn}
                onChange={(e) => setNapaMedidaEn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900"
              />
            </label>
          )}
        </div>
        {napa.trim() !== "" && Number(napa) < 60 && (
          <p className="mt-2 text-xs text-risk-alto">
            Con la napa a {napa} cm este sector pasa a grupo hidrológico D: casi toda la lluvia va a
            correr en superficie.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => guardar.mutate()}
          disabled={!puedeGuardar || guardar.isPending}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-paper-50 transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {guardar.isPending ? "Guardando…" : "Guardar sector"}
        </button>
        <button
          onClick={onCerrar}
          className="rounded-full border border-paper-300 px-4 py-1.5 text-sm text-ink-700 hover:bg-paper-200"
        >
          Cancelar
        </button>
        <p className="w-full text-[11px] text-ink-600">
          Podés guardar con lo que tengas y completar el resto después: cada dato que agregues
          mejora la estimación.
        </p>
      </div>
    </div>
  );
}
