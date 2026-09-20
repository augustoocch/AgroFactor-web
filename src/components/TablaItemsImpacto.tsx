"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { BadgeOrigenItem } from "@/components/BadgeOrigenItem";
import { InfoModal } from "@/components/InfoModal";
import type { Activo, CategoriaDala, CultivoImplantado, InformeImpactoEconomico, ItemImpactoEconomico, Lote } from "@/lib/types";

const CLAVE = (establecimientoId: string) => ["impacto-economico", establecimientoId];

const ETIQUETA_CATEGORIA: Record<CategoriaDala, string> = {
  DANO: "Daños",
  PERDIDA: "Pérdidas de producción",
  COSTO_RECUPERACION: "Costos de recuperación",
};

const CATEGORIAS: CategoriaDala[] = ["DANO", "PERDIDA", "COSTO_RECUPERACION"];

function totalDe(informe: InformeImpactoEconomico, categoria: CategoriaDala): number {
  return categoria === "DANO"
    ? informe.totalDanoUsd
    : categoria === "PERDIDA"
      ? informe.totalPerdidaUsd
      : informe.totalCostoRecuperacionUsd;
}

function aNumeroONull(s: string): number | null {
  return s.trim() === "" ? null : Number(s);
}

/** Ningún monto/cantidad de este informe tiene sentido en negativo — se rechaza en el origen. */
function esNegativo(v: string): boolean {
  return v.includes("-");
}

function usd(valor: number): string {
  return valor.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/**
 * De qué activo o cultivo salió la fila. En la planilla no es un grupo con título propio sino la
 * segunda línea de la celda de descripción: agrupar en tarjetas obligaba a leer el encabezado de
 * cada bloque para saber de qué tractor hablaba cada ítem, y con una fila por máquina el contexto
 * entra en la propia fila.
 */
function contextoDe(
  item: ItemImpactoEconomico,
  activos: Activo[],
  cultivos: CultivoImplantado[],
  lotes: Lote[],
): string | null {
  if (item.activoId) {
    const activo = activos.find((a) => a.id === item.activoId);
    if (!activo) return "Activo eliminado";
    return activo.identificacion ? `${activo.nombre} · ${activo.identificacion}` : activo.nombre;
  }
  if (item.cultivoImplantadoId) {
    const cultivo = cultivos.find((c) => c.id === item.cultivoImplantadoId);
    if (!cultivo) return "Cultivo eliminado";
    const lote = lotes.find((l) => l.id === cultivo.loteId);
    return lote ? `${cultivo.tipoCultivo} · Lote ${lote.nombre}` : cultivo.tipoCultivo;
  }
  return null;
}

/** Estado editable de una fila: separado del ItemImpactoEconomico real para no mandar al server en cada tecla. */
type BorradorItem = {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  moneda: "USD" | "ARS";
  montoOriginalArs: string;
  tipoCambioAplicado: string;
  montoUsd: string;
};

function borradorDe(item: ItemImpactoEconomico, tipoCambioSugerido: number | null): BorradorItem {
  return {
    descripcion: item.descripcion,
    cantidad: item.cantidad != null ? String(item.cantidad) : "",
    precioUnitario: item.precioUnitario != null ? String(item.precioUnitario) : "",
    moneda: item.moneda,
    montoOriginalArs: item.montoOriginalArs != null ? String(item.montoOriginalArs) : "",
    tipoCambioAplicado:
      item.tipoCambioAplicado != null ? String(item.tipoCambioAplicado) : tipoCambioSugerido != null ? String(tipoCambioSugerido) : "",
    montoUsd: item.montoUsd != null ? String(item.montoUsd) : "",
  };
}

/** Vista previa del subtotal con la misma lógica que ItemImpactoEconomico#recalcularMontoUsd en el
 * backend — es solo para que el usuario vea el número antes de guardar; el valor real siempre lo
 * devuelve el server. */
function previsualizarMontoUsd(b: BorradorItem): number | null {
  const numero = (s: string) => (s.trim() === "" ? null : Number(s));
  if (b.moneda === "ARS") {
    const ars = numero(b.montoOriginalArs);
    const tc = numero(b.tipoCambioAplicado);
    if (ars != null && tc != null && tc > 0) return Math.round((ars / tc) * 100) / 100;
    return null;
  }
  const cantidad = numero(b.cantidad);
  const precio = numero(b.precioUnitario);
  if (cantidad != null && precio != null) return Math.round(cantidad * precio * 100) / 100;
  return numero(b.montoUsd);
}

const CELDA_NUMERICA =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-right font-mono text-sm tabular-nums text-ink-900 outline-none hover:border-paper-300 focus:border-brand-500 focus:bg-paper-50 disabled:opacity-70";

/**
 * Una fila de la planilla: categoría (en el encabezado del bloque), descripción, cantidad, precio
 * unitario y subtotal. El subtotal es calculado cuando hay cantidad y precio, y editable directo
 * cuando no los hay — que es exactamente el caso de la reparación de una máquina, donde el número
 * no se compone de nada: sale del presupuesto del taller.
 */
function FilaItemImpacto({
  establecimientoId,
  informe,
  item,
  contexto,
}: {
  establecimientoId: string;
  informe: InformeImpactoEconomico;
  item: ItemImpactoEconomico;
  contexto: string | null;
}) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [borrador, setBorrador] = useState(() => borradorDe(item, informe.tipoCambioBcraUsado));
  const [enPesos, setEnPesos] = useState(() => item.moneda === "ARS");

  const original = borradorDe(item, informe.tipoCambioBcraUsado);
  const cambio = JSON.stringify(borrador) !== JSON.stringify(original);
  // Mientras la fila no se toca manda el monto que calculo el servidor. Recalcularlo en el
  // cliente sobre el precio unitario ya redondeado a dos decimales daba una fila de USD 519.206
  // debajo de un subtotal de categoria de USD 519.150: dos numeros distintos para lo mismo.
  const preview = cambio ? previsualizarMontoUsd(borrador) : item.montoUsd;
  const soloLectura = informe.estado === "CONFIRMADO";
  // Si la fila se compone de cantidad x precio, el subtotal es resultado y no se tipea encima.
  const subtotalCalculado = borrador.moneda === "USD" && borrador.cantidad.trim() !== "" && borrador.precioUnitario.trim() !== "";
  const falta = preview == null;

  const guardar = useMutation({
    mutationFn: () =>
      api.put<InformeImpactoEconomico>(`/establecimientos/${establecimientoId}/impacto-economico/${informe.id}/items/${item.id}`, {
        categoriaDala: item.categoriaDala,
        descripcion: borrador.descripcion,
        cantidad: aNumeroONull(borrador.cantidad),
        unidad: item.unidad,
        precioUnitario: aNumeroONull(borrador.precioUnitario),
        moneda: borrador.moneda,
        montoOriginalArs: aNumeroONull(borrador.montoOriginalArs),
        tipoCambioAplicado: aNumeroONull(borrador.tipoCambioAplicado),
        montoUsd: aNumeroONull(borrador.montoUsd),
      }),
    onSuccess: (actualizado) => queryClient.setQueryData(CLAVE(establecimientoId), actualizado),
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const eliminar = useMutation({
    mutationFn: () =>
      api.delete<InformeImpactoEconomico>(`/establecimientos/${establecimientoId}/impacto-economico/${informe.id}/items/${item.id}`),
    onSuccess: (actualizado) => queryClient.setQueryData(CLAVE(establecimientoId), actualizado),
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  return (
    <>
      <tr className={`border-b border-paper-200 align-top ${falta ? "bg-clay-500/[0.04]" : ""}`}>
        <td className="px-2 py-1.5">
          <input
            value={borrador.descripcion}
            disabled={soloLectura}
            onChange={(e) => setBorrador((b) => ({ ...b, descripcion: e.target.value }))}
            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink-900 outline-none hover:border-paper-300 focus:border-brand-500 focus:bg-paper-50 disabled:opacity-80"
          />
          <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-0.5">
            {contexto && <span className="text-[11px] text-ink-600">{contexto}</span>}
            <BadgeOrigenItem origen={item.origen} />
            {item.formulaOrigen && (
              <InfoModal titulo="Cómo se calculó esta fila">
                <p>{item.formulaOrigen}</p>
              </InfoModal>
            )}
            {item.loteSinRegistroDeAgua && (
              <InfoModal titulo="El lote de esta fila no registró agua" etiqueta="sin agua registrada">
                <p>
                  La simulación no encontró agua en ese lote durante el evento, pero la fila declara daño. Puede ser
                  correcto: el desnivel de un lote pampeano es más chico de lo que el terreno del modelo distingue, y
                  el agua que sube desde abajo no siempre deja lámina arriba.
                </p>
                <p>
                  Lo marcamos porque es lo primero que va a preguntar una aseguradora o la autoridad provincial. El
                  porcentaje es una declaración jurada tuya (Ley 26.509): si el daño es real tené el respaldo a mano,
                  y si quedó un dato viejo corregilo en &ldquo;Declaración de daños&rdquo; y volvé a generar.
                </p>
              </InfoModal>
            )}
            {!soloLectura && (
              <button
                onClick={() => {
                  const proximo = !enPesos;
                  setEnPesos(proximo);
                  setBorrador((b) => ({ ...b, moneda: proximo ? "ARS" : "USD" }));
                }}
                className="rounded-full border border-paper-300 px-1.5 py-px text-[11px] text-ink-600 hover:border-brand-500 hover:text-brand-700"
              >
                {enPesos ? "volver a dólares" : "cargar en pesos"}
              </button>
            )}
          </div>
        </td>

        <td className="w-36 px-2 py-1.5">
          {enPesos ? (
            <span className="block px-1.5 py-1 text-right text-xs text-ink-500">—</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <input
                type="number"
                min={0}
                disabled={soloLectura}
                value={borrador.cantidad}
                onChange={(e) => !esNegativo(e.target.value) && setBorrador((b) => ({ ...b, cantidad: e.target.value }))}
                placeholder="—"
                className={CELDA_NUMERICA}
              />
              {item.unidad && <span className="shrink-0 text-[11px] text-ink-500">{item.unidad}</span>}
            </div>
          )}
        </td>

        <td className="w-36 px-2 py-1.5">
          {enPesos ? (
            <div className="flex items-baseline gap-1">
              <span className="shrink-0 text-[11px] text-ink-500">ARS</span>
              <input
                type="number"
                min={0}
                disabled={soloLectura}
                value={borrador.montoOriginalArs}
                onChange={(e) => !esNegativo(e.target.value) && setBorrador((b) => ({ ...b, montoOriginalArs: e.target.value }))}
                placeholder="—"
                className={CELDA_NUMERICA}
              />
            </div>
          ) : (
            <input
              type="number"
              min={0}
              disabled={soloLectura}
              value={borrador.precioUnitario}
              onChange={(e) => !esNegativo(e.target.value) && setBorrador((b) => ({ ...b, precioUnitario: e.target.value }))}
              placeholder="—"
              className={CELDA_NUMERICA}
            />
          )}
        </td>

        <td className="w-36 px-2 py-1.5">
          {subtotalCalculado || enPesos ? (
            <span className="block px-1.5 py-1 text-right font-mono text-sm tabular-nums text-ink-900">
              {preview != null ? usd(preview) : "—"}
            </span>
          ) : (
            <input
              type="number"
              min={0}
              disabled={soloLectura}
              value={borrador.montoUsd}
              onChange={(e) => !esNegativo(e.target.value) && setBorrador((b) => ({ ...b, montoUsd: e.target.value }))}
              placeholder="cargar"
              className={`${CELDA_NUMERICA} border-paper-300 bg-paper-50`}
            />
          )}
        </td>

        <td className="w-24 px-2 py-1.5 text-right">
          {!soloLectura && cambio && (
            <button
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending}
              className="rounded-full border border-brand-500 px-2 py-0.5 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
            >
              Guardar
            </button>
          )}
          {!soloLectura && !cambio && (
            <button
              onClick={() => eliminar.mutate()}
              disabled={eliminar.isPending}
              aria-label="Borrar fila"
              title="Borrar fila"
              className="rounded-full border border-paper-300 px-2 py-0.5 text-[11px] text-ink-500 transition-colors hover:border-risk-alto hover:text-risk-alto disabled:opacity-50"
            >
              ✕
            </button>
          )}
        </td>
      </tr>

      {enPesos && !soloLectura && (
        <tr className="border-b border-paper-200">
          <td />
          <td colSpan={4} className="px-2 pb-2">
            <label className="flex items-baseline justify-end gap-1.5">
              <span className="text-[11px] text-ink-600">Tipo de cambio</span>
              <input
                type="number"
                min={0}
                value={borrador.tipoCambioAplicado}
                onChange={(e) => !esNegativo(e.target.value) && setBorrador((b) => ({ ...b, tipoCambioAplicado: e.target.value }))}
                className="w-24 rounded border border-paper-300 bg-paper-50 px-1.5 py-1 text-right font-mono text-sm tabular-nums outline-none focus:border-brand-500"
              />
            </label>
          </td>
        </tr>
      )}
    </>
  );
}

function FilaNuevoItem({
  establecimientoId,
  informe,
  categoria,
}: {
  establecimientoId: string;
  informe: InformeImpactoEconomico;
  categoria: CategoriaDala;
}) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [montoUsd, setMontoUsd] = useState("");

  const agregar = useMutation({
    mutationFn: () =>
      api.post<InformeImpactoEconomico>(`/establecimientos/${establecimientoId}/impacto-economico/${informe.id}/items`, {
        categoriaDala: categoria,
        descripcion,
        cantidad: null,
        unidad: null,
        precioUnitario: null,
        moneda: "USD",
        montoOriginalArs: null,
        tipoCambioAplicado: null,
        montoUsd: aNumeroONull(montoUsd),
        activoId: null,
        cultivoImplantadoId: null,
      }),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(CLAVE(establecimientoId), actualizado);
      setDescripcion("");
      setMontoUsd("");
      setAbierto(false);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  if (!abierto) {
    return (
      <tr className="border-b border-paper-200">
        <td colSpan={5} className="px-2 py-1">
          <button
            onClick={() => setAbierto(true)}
            className="text-xs font-medium text-ink-600 transition-colors hover:text-brand-700"
          >
            + Agregar fila
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-paper-200">
      <td className="px-2 py-1.5">
        <input
          autoFocus
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción"
          className="w-full rounded border border-paper-300 bg-paper-50 px-1.5 py-1 text-sm outline-none focus:border-brand-500"
        />
      </td>
      <td />
      <td />
      <td className="px-2 py-1.5">
        <input
          type="number"
          min={0}
          value={montoUsd}
          onChange={(e) => !esNegativo(e.target.value) && setMontoUsd(e.target.value)}
          placeholder="USD"
          className={`${CELDA_NUMERICA} border-paper-300 bg-paper-50`}
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <button
          onClick={() => agregar.mutate()}
          disabled={descripcion.trim() === "" || agregar.isPending}
          className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-medium text-paper-50 disabled:opacity-50"
        >
          Agregar
        </button>
        <button onClick={() => setAbierto(false)} className="ml-1 text-[11px] text-ink-600">
          Cancelar
        </button>
      </td>
    </tr>
  );
}

/**
 * El informe como planilla de cálculo: una fila por ítem y una columna por dato (categoría en el
 * encabezado del bloque, descripción, cantidad, precio unitario, subtotal en USD). Reemplaza las
 * tarjetas agrupadas anteriores, donde cada ítem era una tarjeta con su monto escondido a la
 * derecha y los números no quedaban alineados entre sí: para saber cuánto pesaba cada línea había
 * que recorrer bloques en vez de leer una columna.
 */
export function TablaItemsImpacto({ establecimientoId, informe }: { establecimientoId: string; informe: InformeImpactoEconomico }) {
  // Mismas queries que ya usa PanelDeclaracionDanos en esta pantalla: React Query las sirve del
  // cache sin pegarle de nuevo al servidor. Sirven solo para el CONTEXTO de cada fila (de qué
  // activo o lote salió) — no para ningún cálculo.
  const { data: activos = [] } = useQuery({
    queryKey: ["activos", establecimientoId],
    queryFn: () => api.get<Activo[]>(`/establecimientos/${establecimientoId}/activos`),
  });
  const { data: cultivos = [] } = useQuery({
    queryKey: ["cultivos", establecimientoId],
    queryFn: () => api.get<CultivoImplantado[]>(`/establecimientos/${establecimientoId}/cultivos`),
  });
  const { data: lotes = [] } = useQuery({
    queryKey: ["lotes", establecimientoId],
    queryFn: () => api.get<Lote[]>(`/establecimientos/${establecimientoId}/lotes`),
  });

  const filasSinMonto = informe.items.filter((i) => i.montoUsd == null).length;
  const filasSinAgua = informe.items.filter((i) => i.loteSinRegistroDeAgua).length;

  return (
    <div className="space-y-2">
      {filasSinMonto > 0 && (
        <p className="text-xs text-ink-600">
          {filasSinMonto === 1 ? "Queda 1 fila" : `Quedan ${filasSinMonto} filas`} sin monto, resaltadas abajo. Son las que
          ninguna fuente de mercado puede responder: el presupuesto del taller, el de la resiembra y el precio del forraje.
        </p>
      )}

      {filasSinAgua > 0 && (
        <p className="text-xs text-clay-600">
          {filasSinAgua === 1 ? "Hay 1 fila que declara" : `Hay ${filasSinAgua} filas que declaran`} daño sobre un lote
          que no registró agua durante el evento. No las bloquea, pero revisalas antes de presentar el informe.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-paper-300">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-paper-300 bg-paper-100 text-[11px] uppercase tracking-wide text-ink-600">
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium">Precio unitario</th>
              <th className="px-3 py-2 text-right font-medium">Subtotal USD</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map((categoria) => {
              const items = informe.items.filter((i) => i.categoriaDala === categoria);
              return (
                <Fragment key={categoria}>
                  <tr className="border-b border-paper-300 bg-paper-100/60">
                    <th colSpan={3} className="px-3 py-1.5 text-left text-xs font-semibold text-ink-900">
                      {ETIQUETA_CATEGORIA[categoria]}
                    </th>
                    <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-ink-800">
                      {usd(totalDe(informe, categoria))}
                    </td>
                    <td />
                  </tr>
                  {items.length === 0 ? (
                    <tr className="border-b border-paper-200">
                      <td colSpan={5} className="px-3 py-1.5 text-xs text-ink-600">
                        Sin filas en esta categoría.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <FilaItemImpacto
                        key={item.id}
                        establecimientoId={establecimientoId}
                        informe={informe}
                        item={item}
                        contexto={contextoDe(item, activos, cultivos, lotes)}
                      />
                    ))
                  )}
                  {informe.estado === "BORRADOR" && (
                    <FilaNuevoItem
                      establecimientoId={establecimientoId}
                      informe={informe}
                      categoria={categoria}
                    />
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-paper-300 bg-paper-100">
              <th colSpan={3} className="px-3 py-2 text-left text-sm font-medium text-ink-900">
                Total
              </th>
              <td className="px-3 py-2 text-right font-mono text-sm font-medium tabular-nums text-ink-950">
                {usd(informe.totalGeneralUsd)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
