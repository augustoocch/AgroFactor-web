import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Activo, Coordenada, EvaluacionRiesgo, Lote } from "@/lib/types";

/** Ultima evaluacion de riesgo por lote, para pintar el mapa. Un lote sin evaluacion todavia no rompe la vista. */
export function useScoresRiesgo(lotes: Lote[]) {
  const resultados = useQueries({
    queries: lotes.map((lote) => ({
      queryKey: ["evaluacion-riesgo", lote.id, "ultima"],
      queryFn: () => api.get<EvaluacionRiesgo>(`/lotes/${lote.id}/evaluaciones-riesgo/ultima`),
      retry: false,
      throwOnError: false,
    })),
  });

  const scorePorLote: Record<string, number> = {};
  lotes.forEach((lote, i) => {
    const data = resultados[i]?.data;
    if (data) scorePorLote[lote.id] = data.scoreSusceptibilidad;
  });
  return scorePorLote;
}

/**
 * Reubicar un activo arrastrando su pin en el mapa.
 *
 * El `loteId` que se manda es el que el activo YA tiene: arrastrar ajusta la posicion, nunca
 * reasigna el lote. La FK sale de la pantalla desde la que se cargo el activo, no de donde
 * cayo el marcador -por eso el backend, al no ver cambio de lote, respeta la coordenada tal
 * cual (ver ActivoService.actualizar).
 *
 * Es la primera mutacion optimista del proyecto, y aca hace falta: Leaflet deja el marcador
 * donde el usuario lo solto, asi que sin pisar la cache el pin volveria de un salto a la
 * posicion vieja en cuanto llegue la respuesta. Si el PUT falla, el rollback lo devuelve solo.
 */
export function useReubicarActivo(establecimientoId: string) {
  const queryClient = useQueryClient();
  const { notificar } = useToast();

  return useMutation({
    mutationFn: ({ activo, coordenada }: { activo: Activo; coordenada: Coordenada }) =>
      api.put<Activo>(`/activos/${activo.id}`, {
        loteId: activo.loteAsociadoId,
        nombre: activo.nombre,
        tipo: activo.tipo,
        movilidad: activo.movilidad,
        valorEstimado: activo.valorEstimado,
        ubicacion: coordenada,
      }),

    onMutate: async ({ activo, coordenada }) => {
      await queryClient.cancelQueries({ queryKey: ["activos"] });
      // Una refetch en vuelo que responda despues del optimista lo pisaria con la posicion vieja.
      const previos = queryClient.getQueriesData<Activo[]>({ queryKey: ["activos"] });
      previos.forEach(([clave, lista]) => {
        if (!lista) return;
        queryClient.setQueryData<Activo[]>(
          clave,
          lista.map((a) => (a.id === activo.id ? { ...a, ubicacion: coordenada } : a)),
        );
      });
      return { previos };
    },

    onError: (e, _variables, context) => {
      context?.previos.forEach(([clave, lista]) => queryClient.setQueryData(clave, lista));
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activos"] });
      // El activo movido cambia la exposicion del lote, y con ella su priorizacion.
      queryClient.invalidateQueries({ queryKey: ["plan-accion", establecimientoId] });
    },
  });
}
