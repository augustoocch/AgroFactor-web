"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api, clasificarError, descargarArchivo } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import { InfoModal } from "@/components/InfoModal";
import { TablaItemsImpacto } from "@/components/TablaItemsImpacto";
import type { InformeImpactoEconomico, Reporte } from "@/lib/types";

const CLAVE = (establecimientoId: string) => ["impacto-economico", establecimientoId];

/**
 * Informe de impacto economico post-evento: dano, perdida de produccion y costo de recuperacion
 * (metodologia DALA, CEPAL/FAO). Responde el hallazgo mas unanime de la encuesta a productores
 * (3/3 nunca pudieron estimar cuanto dinero estaba en riesgo durante el evento real) — el sistema
 * ya calculaba un valor en riesgo pre-evento (ver PlanAccion) pero nunca llegaba a ningun lado.
 *
 * El pre-analisis llega con numero cerrado donde hay un precio de mercado real que lo respalde:
 * hacienda del Mercado Agroganadero de Cañuelas y granos de la pizarra de la BCR (ver
 * risk-engine/app/precios_mercado.py). Sigue siendo un borrador editable -el productor conoce su
 * campo mejor que el promedio del mercado- pero ya no es una lista de casilleros vacios.
 */
export function PanelImpactoEconomico({ establecimientoId }: { establecimientoId: string }) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  const { data: informe } = useQuery({
    queryKey: CLAVE(establecimientoId),
    queryFn: () => api.get<InformeImpactoEconomico>(`/establecimientos/${establecimientoId}/impacto-economico/ultimo`),
    retry: false,
  });

  const generar = useMutation({
    mutationFn: () => api.post<InformeImpactoEconomico>(`/establecimientos/${establecimientoId}/impacto-economico/pre-analisis`),
    onSuccess: (nuevo) => queryClient.setQueryData(CLAVE(establecimientoId), nuevo),
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => generar.mutate() : undefined);
    },
  });

  const confirmar = useMutation({
    mutationFn: () =>
      api.post<InformeImpactoEconomico>(`/establecimientos/${establecimientoId}/impacto-economico/${informe!.id}/confirmar`),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(CLAVE(establecimientoId), actualizado);
      notificar("exito", "Informe confirmado");
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const generarPdf = useMutation({
    mutationFn: () => api.post<Reporte>(`/establecimientos/${establecimientoId}/impacto-economico/${informe!.id}/generar-pdf`),
    onSuccess: async (reporte) => {
      queryClient.invalidateQueries({ queryKey: ["reportes", establecimientoId] });
      try {
        await descargarArchivo(`/establecimientos/${establecimientoId}/reportes/${reporte.id}/archivo`, "impacto-economico.pdf");
      } catch (e) {
        const { tipo, mensaje } = clasificarError(e);
        notificar(tipo, mensaje);
      }
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },
  });

  const hayItemsSinMonto = informe?.items.some((i) => i.montoUsd == null) ?? false;

  return (
    <div className="space-y-5 rounded-2xl border border-paper-300 bg-paper-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm uppercase tracking-wide text-brand-600">Después de un evento</p>
            <InfoModal titulo="Cómo se arma este informe">
              <p>
                El sistema junta lo que ya declaraste (% de daño en activos y cultivos) y calcula cada fila con una
                fórmula auditable que podés abrir línea por línea. La hacienda se valúa al precio de la categoría en el
                Mercado Agroganadero de Cañuelas, y la producción no obtenida al precio de pizarra de la Bolsa de
                Comercio de Rosario: los dos son mercados de referencia y publican todos los días.
              </p>
              <p>
                Quedan sin monto solo las filas que ningún mercado puede responder: la reparación de una máquina sale
                del presupuesto del taller, el costo de la resiembra de tu presupuesto de insumos, y el forraje no
                tiene pizarra. Esas son tuyas para completar. El resto llega con un número, y lo podés ajustar si
                conocés mejor tu caso.
              </p>
            </InfoModal>
          </div>
          <h2 className="font-display text-lg font-medium text-ink-950">Impacto económico</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-600">
            Daños, pérdidas de producción y costos de recuperación, todo en dólares y a precio de mercado del día.
            Un borrador editable, no un número cerrado.
          </p>
        </div>
        <button
          onClick={() => generar.mutate()}
          disabled={generar.isPending}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {generar.isPending ? "Generando..." : informe ? "Generar de nuevo" : "Generar pre-análisis"}
        </button>
      </div>

      {!informe && (
        <div className="rounded-xl border border-dashed border-paper-300 p-6 text-center">
          <p className="text-sm text-ink-700">Todavía no generaste un informe de impacto económico.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-600">
            Se arma con el % de daño que ya declaraste en activos y cultivos. Si no declaraste nada todavía, hacelo
            arriba, en &quot;Declaración de daños&quot;.
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {informe && (
          <motion.div
            key={informe.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="space-y-5"
          >
            {/* Con que precios se armo el informe. No es letra chica de auditoria: es la
                diferencia entre un total que el productor puede llevar a discutir con su asesor o
                con la aseguradora, y un numero que tiene que creer porque si. */}
            <div className="space-y-0.5 text-xs text-ink-600">
              {informe.tipoCambioBcraUsado != null && (
                <p>
                  Dólar oficial (BCRA) para convertir montos en pesos: {informe.tipoCambioBcraUsado.toLocaleString("es-AR")}
                  {informe.tipoCambioFecha && ` (${new Date(informe.tipoCambioFecha).toLocaleDateString("es-AR")})`} — editable por fila.
                </p>
              )}
              {informe.fuentePreciosHacienda && <p>Precios de hacienda: {informe.fuentePreciosHacienda}</p>}
              {informe.fuentePreciosGranos && <p>Precios de granos: {informe.fuentePreciosGranos}</p>}
              {informe.preciosSonReferencia && (
                <p className="text-clay-600">
                  Alguno de los dos mercados no respondió y se usó una tabla de referencia: revisá esos montos contra el
                  mercado antes de confirmar.
                </p>
              )}
            </div>

            <TablaItemsImpacto establecimientoId={establecimientoId} informe={informe} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-300 pt-4">
              <p className="font-display text-xl font-medium text-ink-950">
                Total: <span className="font-mono">USD {informe.totalGeneralUsd.toLocaleString("es-AR")}</span>
              </p>
              <div className="flex items-center gap-2">
                {informe.estado === "BORRADOR" ? (
                  <button
                    onClick={() => confirmar.mutate()}
                    disabled={hayItemsSinMonto || confirmar.isPending}
                    title={hayItemsSinMonto ? "Completá el monto de todos los ítems antes de confirmar" : undefined}
                    className="rounded-full border border-brand-500 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
                  >
                    Confirmar informe
                  </button>
                ) : (
                  <span className="rounded-full bg-risk-bajo-bg px-3 py-1 text-xs font-medium text-risk-bajo">Confirmado</span>
                )}
                <button
                  onClick={() => generarPdf.mutate()}
                  disabled={informe.estado !== "CONFIRMADO" || generarPdf.isPending}
                  title={informe.estado !== "CONFIRMADO" ? "Confirmá el informe antes de descargarlo" : undefined}
                  className="rounded-full bg-clay-500 px-3.5 py-1.5 text-sm font-medium text-paper-50 transition-colors hover:bg-clay-600 disabled:opacity-50"
                >
                  {generarPdf.isPending ? "Generando PDF..." : "Descargar informe"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
