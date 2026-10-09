"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api, clasificarError, descargarArchivo } from "@/lib/api";
import { easeOutExpo } from "@/lib/motion";
import { useToast } from "@/lib/toast-context";
import Link from "next/link";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { InfoAside } from "@/components/InfoAside";
import { boton, enlace } from "@/lib/estilos";
import { rutaDe } from "@/lib/navegacion";
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
    <div>
      <EncabezadoPantalla
        segmento="impacto"
        titulo="Impacto económico"
        descripcion="Daños, producción perdida y costos de recuperación, en dólares y a precio de mercado del día. Es un borrador que podés corregir antes de confirmarlo."
        ayuda={
          <InfoAside titulo="Cómo se arma este informe" etiqueta="De dónde salen los precios">
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
            </InfoAside>
        }
        acciones={
          <button onClick={() => generar.mutate()} disabled={generar.isPending} className={informe ? boton.sutil : boton.primario}>
            {generar.isPending ? "Generando..." : informe ? "Generar de nuevo" : "Generar borrador"}
          </button>
        }
      />

      {!informe && (
        <div className="rounded-xl border border-dashed border-paper-300 px-6 py-10 text-center">
          <p className="font-display text-lg text-ink-950">Todavía no hay un borrador</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
            Se arma con el porcentaje de daño declarado en cultivos y activos. Si todavía no declaraste nada,{" "}
            <Link href={rutaDe(establecimientoId, "danos")} className={enlace}>
              empezá por ahí
            </Link>
            .
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

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-paper-300 pt-5">
              <div className="border-l-2 border-clay-500 pl-4">
                <p className="font-display text-3xl font-medium tabular-nums text-ink-950">
                  USD {informe.totalGeneralUsd.toLocaleString("es-AR")}
                </p>
                <p className="text-sm text-ink-600">total estimado</p>
              </div>
              <div className="flex items-center gap-2">
                {informe.estado === "BORRADOR" ? (
                  <button
                    onClick={() => confirmar.mutate()}
                    disabled={hayItemsSinMonto || confirmar.isPending}
                    title={hayItemsSinMonto ? "Completá el monto de todos los ítems antes de confirmar" : undefined}
                    className={boton.secundario}
                  >
                    Confirmar informe
                  </button>
                ) : (
                  <span className="rounded-full bg-risk-bajo-bg px-3 py-1 text-xs font-medium text-risk-bajo-ink">Confirmado</span>
                )}
                <button
                  onClick={() => generarPdf.mutate()}
                  disabled={informe.estado !== "CONFIRMADO" || generarPdf.isPending}
                  title={informe.estado !== "CONFIRMADO" ? "Confirmá el informe antes de descargarlo" : undefined}
                  className={boton.primario}
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
