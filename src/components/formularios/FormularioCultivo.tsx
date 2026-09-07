"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Campo, Opciones, Texto } from "@/components/CamposFormulario";
import { FormularioPaginado } from "@/components/formularios/FormularioPaginado";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Coordenada, CultivoCatalogo, CultivoImplantado } from "@/lib/types";

const OTRO = "OTRO";

const ETIQUETA_TOLERANCIA: Record<string, string> = {
  BAJA: "poco tolerante al agua",
  MEDIA: "tolerancia media al agua",
  ALTA: "tolerante al agua",
};

const CLASES_CAMPO =
  "mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500";

/**
 * Alta y edicion de una zona de cultivo, paginada en tres pasos.
 *
 * Solo el primero es obligatorio: el cultivo y su estado salen del catalogo agronomico y con eso
 * el backend deriva el margen de accion. Los otros dos son la ficha que un peritaje exige, y se
 * completan a lo largo de la campana -exigirlos al dar de alta frenaria la carga inicial.
 */
export function FormularioCultivo({
  establecimientoId,
  loteId,
  anilloNuevo,
  cultivoAEditar,
}: {
  establecimientoId: string;
  loteId: string;
  anilloNuevo: Coordenada[] | null;
  cultivoAEditar: CultivoImplantado | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const esEdicion = cultivoAEditar !== null;
  const volverA = `/establecimientos/${establecimientoId}/lotes/${loteId}`;

  const [paso, setPaso] = useState(0);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["catalogo-cultivos"],
    queryFn: () => api.get<CultivoCatalogo[]>("/catalogo/cultivos"),
    staleTime: Infinity,
  });

  const [campos, setCampos] = useState(() => ({
    cultivoCodigo: cultivoAEditar?.cultivoCodigo ?? "",
    estadoFenologicoCodigo: cultivoAEditar?.estadoFenologicoCodigo ?? "",
    tipoCultivoLibre: cultivoAEditar?.cultivoCodigo ? "" : (cultivoAEditar?.tipoCultivo ?? ""),
    estadoFenologicoLibre: cultivoAEditar?.cultivoCodigo ? "" : (cultivoAEditar?.estadoFenologico ?? ""),
    fechaSiembra: cultivoAEditar?.fechaSiembra ?? "",
  }));

  const [ficha, setFicha] = useState(() => ({
    variedad: cultivoAEditar?.variedad ?? "",
    densidadSiembra: cultivoAEditar?.densidadSiembra != null ? String(cultivoAEditar.densidadSiembra) : "",
    unidadDensidad: cultivoAEditar?.unidadDensidad ?? "",
    fechaEsperadaCosecha: cultivoAEditar?.fechaEsperadaCosecha ?? "",
    rendimientoEsperadoQqHa:
      cultivoAEditar?.rendimientoEsperadoQqHa != null ? String(cultivoAEditar.rendimientoEsperadoQqHa) : "",
    rendimientoHistoricoQqHa:
      cultivoAEditar?.rendimientoHistoricoQqHa != null ? String(cultivoAEditar.rendimientoHistoricoQqHa) : "",
    condicionSanitaria: cultivoAEditar?.condicionSanitaria ?? "",
    alturaCultivoCm: cultivoAEditar?.alturaCultivoCm != null ? String(cultivoAEditar.alturaCultivoCm) : "",
    costoImplantacionArs:
      cultivoAEditar?.costoImplantacionArs != null ? String(cultivoAEditar.costoImplantacionArs) : "",
    observaciones: cultivoAEditar?.observaciones ?? "",
  }));

  const editar = (campo: keyof typeof ficha) => (valor: string) => setFicha((f) => ({ ...f, [campo]: valor }));

  const esOtro = campos.cultivoCodigo === OTRO;
  const cultivoElegido = catalogo.find((c) => c.codigo === campos.cultivoCodigo);
  const estadoElegido = cultivoElegido?.estados.find((e) => e.codigo === campos.estadoFenologicoCodigo);

  const identificacionCompleta = Boolean(
    campos.fechaSiembra &&
      (esOtro
        ? campos.tipoCultivoLibre && campos.estadoFenologicoLibre
        : cultivoElegido && campos.estadoFenologicoCodigo),
  );

  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        anillo: esEdicion ? cultivoAEditar!.anillo : anilloNuevo!,
        cultivoCodigo: cultivoElegido ? cultivoElegido.codigo : null,
        estadoFenologicoCodigo: cultivoElegido ? campos.estadoFenologicoCodigo : null,
        tipoCultivo: cultivoElegido ? cultivoElegido.nombre : campos.tipoCultivoLibre,
        estadoFenologico: estadoElegido ? estadoElegido.nombre : campos.estadoFenologicoLibre,
        fechaSiembra: campos.fechaSiembra,
        // Vacio va como null: "sin dato" y "cero" no son lo mismo en un peritaje.
        variedad: ficha.variedad || null,
        densidadSiembra: ficha.densidadSiembra ? Number(ficha.densidadSiembra) : null,
        unidadDensidad: ficha.unidadDensidad || null,
        fechaEsperadaCosecha: ficha.fechaEsperadaCosecha || null,
        rendimientoEsperadoQqHa: ficha.rendimientoEsperadoQqHa ? Number(ficha.rendimientoEsperadoQqHa) : null,
        rendimientoHistoricoQqHa: ficha.rendimientoHistoricoQqHa ? Number(ficha.rendimientoHistoricoQqHa) : null,
        condicionSanitaria: ficha.condicionSanitaria || null,
        alturaCultivoCm: ficha.alturaCultivoCm ? Number(ficha.alturaCultivoCm) : null,
        costoImplantacionArs: ficha.costoImplantacionArs ? Number(ficha.costoImplantacionArs) : null,
        observaciones: ficha.observaciones || null,
      };
      return esEdicion
        ? api.put<CultivoImplantado>(`/cultivos/${cultivoAEditar!.id}`, body)
        : api.post<CultivoImplantado>(`/lotes/${loteId}/cultivos`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivos", loteId] });
      notificar("exito", esEdicion ? "Zona de cultivo actualizada" : "Zona de cultivo guardada");
      router.push(volverA);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => guardar.mutate() : undefined);
    },
  });

  const contar = (claves: (keyof typeof ficha)[]) => claves.filter((k) => ficha[k] !== "").length;

  return (
    <FormularioPaginado
      titulo={esEdicion ? "Editar zona de cultivo" : "Nueva zona de cultivo"}
      subtitulo="Lo del primer paso alimenta el analisis de riesgo. Lo demas es la ficha que pide un peritaje y se puede completar despues."
      volverA={volverA}
      pasoActivo={paso}
      onPaso={setPaso}
      onGuardar={() => guardar.mutate()}
      guardando={guardar.isPending}
      etiquetaGuardar={esEdicion ? "Guardar cambios" : "Guardar cultivo"}
      pasos={[
        {
          titulo: "Identificacion",
          descripcion: "Que se sembro y cuando. Con esto el sistema deriva el margen de accion y el consumo de agua.",
          obligatorio: true,
          completo: identificacionCompleta,
          contenido: (
            <>
              <Campo etiqueta="Cultivo">
                <select
                  value={campos.cultivoCodigo}
                  onChange={(e) => setCampos((c) => ({ ...c, cultivoCodigo: e.target.value, estadoFenologicoCodigo: "" }))}
                  className={CLASES_CAMPO}
                >
                  <option value="">Elegí un cultivo...</option>
                  {catalogo.map((cultivo) => (
                    <option key={cultivo.codigo} value={cultivo.codigo}>
                      {cultivo.nombre}
                    </option>
                  ))}
                  <option value={OTRO}>Otro (no esta en la lista)</option>
                </select>
                {cultivoElegido && (
                  <p className="mt-1 text-[11px] leading-tight text-ink-600">
                    {ETIQUETA_TOLERANCIA[cultivoElegido.toleranciaAnegamiento]} · resiste unos{" "}
                    {cultivoElegido.diasToleranciaAnegamiento} dias con agua encima.
                  </p>
                )}
              </Campo>

              {esOtro && (
                <div className="space-y-3 rounded-xl border border-clay-500/40 bg-clay-100 p-3">
                  <p className="text-[11px] leading-tight text-clay-600">
                    Al estar fuera del catalogo no podemos calcular el margen de accion ni ajustar el consumo de agua
                    del cultivo. Se guarda igual, pero sin ese analisis.
                  </p>
                  <input
                    value={campos.tipoCultivoLibre}
                    onChange={(e) => setCampos((c) => ({ ...c, tipoCultivoLibre: e.target.value }))}
                    placeholder="Nombre del cultivo"
                    className="w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    value={campos.estadoFenologicoLibre}
                    onChange={(e) => setCampos((c) => ({ ...c, estadoFenologicoLibre: e.target.value }))}
                    placeholder="Estado fenologico"
                    className="w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {cultivoElegido && (
                <Campo etiqueta="Estado fenologico">
                  <select
                    value={campos.estadoFenologicoCodigo}
                    onChange={(e) => setCampos((c) => ({ ...c, estadoFenologicoCodigo: e.target.value }))}
                    className={CLASES_CAMPO}
                  >
                    <option value="">En que estado esta...</option>
                    {cultivoElegido.estados.map((estado) => (
                      <option key={estado.codigo} value={estado.codigo}>
                        {estado.codigo} — {estado.nombre}
                      </option>
                    ))}
                  </select>
                  {estadoElegido?.criticoAnegamiento && (
                    <p className="mt-1 text-[11px] font-medium leading-tight text-risk-alto">
                      Estado critico: un anegamiento en este momento compromete el rendimiento.
                    </p>
                  )}
                  {estadoElegido?.madurezFisiologica && (
                    <p className="mt-1 text-[11px] leading-tight text-brand-700">
                      El grano ya esta hecho: se puede adelantar la cosecha.
                    </p>
                  )}
                </Campo>
              )}

              <Texto
                etiqueta="Fecha de siembra"
                tipo="date"
                valor={campos.fechaSiembra}
                onChange={(v) => setCampos((c) => ({ ...c, fechaSiembra: v }))}
              />
            </>
          ),
        },
        {
          titulo: "Ficha agronomica",
          descripcion: "Lo que el tasador registra en campo. La fecha esperada de cosecha ubica el evento dentro del ciclo, que es el eje del calculo de perdida.",
          completo: contar(["variedad", "densidadSiembra", "unidadDensidad", "fechaEsperadaCosecha"]) === 4,
          contenido: (
            <div className="grid gap-3 sm:grid-cols-2">
              <Texto
                etiqueta="Variedad o hibrido"
                ayuda="Define el potencial de rinde."
                valor={ficha.variedad}
                onChange={editar("variedad")}
                placeholder="Ej. DM 4670"
              />
              <Texto
                etiqueta="Fecha esperada de cosecha"
                ayuda="Eje del calculo pericial de perdida."
                tipo="date"
                valor={ficha.fechaEsperadaCosecha}
                onChange={editar("fechaEsperadaCosecha")}
              />
              <Texto
                etiqueta="Densidad de siembra"
                tipo="number"
                valor={ficha.densidadSiembra}
                onChange={editar("densidadSiembra")}
              />
              <Opciones
                etiqueta="Unidad de densidad"
                valor={ficha.unidadDensidad}
                opciones={["plantas/ha", "kg/ha", "semillas/m", "kg/m2"]}
                onChange={editar("unidadDensidad")}
              />
            </div>
          ),
        },
        {
          titulo: "Rinde y estado",
          descripcion: "Lo que respalda el reclamo: cuanto se esperaba cosechar, cuanto se invirtio y como estaba el cultivo.",
          completo:
            contar(["rendimientoEsperadoQqHa", "rendimientoHistoricoQqHa", "condicionSanitaria", "alturaCultivoCm", "costoImplantacionArs"]) === 5,
          contenido: (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Texto
                  etiqueta="Rendimiento esperado (qq/ha)"
                  tipo="number"
                  valor={ficha.rendimientoEsperadoQqHa}
                  onChange={editar("rendimientoEsperadoQqHa")}
                />
                <Texto
                  etiqueta="Rendimiento historico (qq/ha)"
                  ayuda="Sin historico la aseguradora discute el esperado declarado."
                  tipo="number"
                  valor={ficha.rendimientoHistoricoQqHa}
                  onChange={editar("rendimientoHistoricoQqHa")}
                />
                <Opciones
                  etiqueta="Condicion sanitaria"
                  valor={ficha.condicionSanitaria}
                  opciones={["Sana", "Presion de malezas", "Presion de enfermedad", "Presion de plagas", "Dano previo"]}
                  onChange={editar("condicionSanitaria")}
                />
                <Texto
                  etiqueta="Altura del cultivo (cm)"
                  ayuda="La aseguradora la pide al denunciar el siniestro."
                  tipo="number"
                  valor={ficha.alturaCultivoCm}
                  onChange={editar("alturaCultivoCm")}
                />
              </div>

              <Texto
                etiqueta="Costo de implantacion (ARS)"
                ayuda="Lo ya invertido: es lo que se pierde si el cultivo no llega a cosecha."
                tipo="number"
                valor={ficha.costoImplantacionArs}
                onChange={editar("costoImplantacionArs")}
              />

              <Campo etiqueta="Observaciones">
                <textarea
                  value={ficha.observaciones}
                  onChange={(e) => editar("observaciones")(e.target.value)}
                  rows={3}
                  className={CLASES_CAMPO}
                />
              </Campo>
            </>
          ),
        },
      ]}
    />
  );
}
