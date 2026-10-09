"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Campo, Opciones, Texto } from "@/components/CamposFormulario";
import { FormularioPaginado, type Paso } from "@/components/formularios/FormularioPaginado";
import { PanelFotosActivo } from "@/components/PanelFotosActivo";
import { api, clasificarError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import type { Activo, Coordenada, Lote, Movilidad, TipoActivo } from "@/lib/types";

/** Un galpón o un camino no se mudan de lote; hacienda y maquinaria sí. */
const MOVILIDAD_POR_DEFECTO: Record<TipoActivo, Movilidad> = {
  HACIENDA: "MOVIBLE",
  MAQUINARIA: "MOVIBLE",
  RESERVA_FORRAJERA: "MOVIBLE",
  INSTALACION: "FIJO",
  CAMINO_ACCESO: "FIJO",
};

const ETIQUETA_TIPO: Record<TipoActivo, string> = {
  HACIENDA: "Hacienda",
  MAQUINARIA: "Maquinaria",
  INSTALACION: "Instalación",
  RESERVA_FORRAJERA: "Reserva forrajera",
  CAMINO_ACCESO: "Camino / acceso",
};

/** Cómo se identifica cada tipo de bien ante una aseguradora. */
const AYUDA_IDENTIFICACION: Record<TipoActivo, string> = {
  HACIENDA: "RENSPA del establecimiento o caravana del rodeo.",
  MAQUINARIA: "Número de serie o patente del rodado.",
  INSTALACION: "Número de partida o identificación catastral.",
  RESERVA_FORRAJERA: "Identificación del silo o parva.",
  CAMINO_ACCESO: "Tramo o progresiva.",
};

/**
 * Subclasificación por tipo (ver Activo.java: categoria/material no aplican igual a todos los
 * tipos). Antes el formulario mostraba los mismos campos de "marca y modelo" / "año" para
 * cualquier tipo, incluida una instalación fija — el bug reportado de pedirle el año a una
 * Estancia. Cada tipo ahora ve solo lo que le corresponde.
 */
const CATEGORIA_POR_TIPO: Partial<Record<TipoActivo, { etiqueta: string; opciones: string[] }>> = {
  HACIENDA: { etiqueta: "Categoría animal", opciones: ["Vaca", "Vaquillona", "Novillo", "Ternero/a", "Toro", "Oveja", "Otra"] },
  RESERVA_FORRAJERA: { etiqueta: "Tipo de reserva", opciones: ["Rollo", "Fardo", "Silo bolsa", "Silo de planta entera", "Otra"] },
  INSTALACION: { etiqueta: "Tipo de construcción", opciones: ["Galpón", "Tinglado", "Corral", "Casco", "Molino", "Otra"] },
};

const MATERIAL_POR_TIPO: Partial<Record<TipoActivo, { etiqueta: string; opciones: string[] }>> = {
  INSTALACION: { etiqueta: "Material constructivo", opciones: ["Chapa", "Ladrillo", "Madera", "Mixto", "Otro"] },
  CAMINO_ACCESO: { etiqueta: "Tipo de superficie", opciones: ["Tierra", "Ripio", "Consolidado", "Asfalto"] },
};

/** "Marca y modelo" / "Año" solo tienen sentido para un bien con fabricante y año de fabricación. */
const TIENE_MARCA_Y_ANIO = (tipo: TipoActivo) => tipo === "MAQUINARIA";

/**
 * "Cantidad"/"Unidad" solo tienen sentido para un bien que se cuenta en una magnitud propia
 * (cabezas de hacienda, toneladas de reserva forrajera) — un tractor, un galpón o un tramo de
 * camino son un bien individual, no una cantidad de una unidad de medida. Antes se pedía para
 * cualquier tipo, lo que llevaba a preguntas sin sentido como "¿qué unidad tiene un tractor?".
 */
const TIENE_CANTIDAD = (tipo: TipoActivo) => tipo === "HACIENDA" || tipo === "RESERVA_FORRAJERA";

const CLASES_CAMPO =
  "mt-1 w-full rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm outline-none focus:border-brand-500";

/**
 * Alta y edición de un activo, paginada en tres pasos.
 *
 * El primero es el alta mínima; los otros dos son la ficha que un peritaje necesita para
 * individualizar el bien y valuarlo. Se completan con el tiempo: exigirlos al crear frenaría la
 * carga inicial, que es cuando el productor tiene menos paciencia.
 */
export function FormularioActivo({
  establecimientoId,
  loteId,
  lotes,
  ubicacionNueva,
  activoAEditar,
}: {
  establecimientoId: string;
  loteId: string;
  lotes: Lote[];
  ubicacionNueva: Coordenada | null;
  activoAEditar: Activo | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notificar } = useToast();
  const esEdicion = activoAEditar !== null;
  const volverA = `/establecimientos/${establecimientoId}/lotes/${loteId}/mapa`;

  const [paso, setPaso] = useState(0);

  const [campos, setCampos] = useState(() => ({
    nombre: activoAEditar?.nombre ?? "",
    tipo: activoAEditar?.tipo ?? ("HACIENDA" as TipoActivo),
    movilidad: activoAEditar?.movilidad ?? MOVILIDAD_POR_DEFECTO.HACIENDA,
    valorEstimado: activoAEditar ? String(activoAEditar.valorEstimado) : "",
    loteDestinoId: activoAEditar?.loteAsociadoId ?? loteId,
  }));

  const [ficha, setFicha] = useState(() => ({
    identificacion: activoAEditar?.identificacion ?? "",
    marcaModelo: activoAEditar?.marcaModelo ?? "",
    anio: activoAEditar?.anio != null ? String(activoAEditar.anio) : "",
    categoria: activoAEditar?.categoria ?? "",
    material: activoAEditar?.material ?? "",
    estadoConservacion: activoAEditar?.estadoConservacion ?? "",
    cantidad: activoAEditar?.cantidad != null ? String(activoAEditar.cantidad) : "",
    unidadCantidad: activoAEditar?.unidadCantidad ?? "",
    alturaSobreSueloCm: activoAEditar?.alturaSobreSueloCm != null ? String(activoAEditar.alturaSobreSueloCm) : "",
    aseguradora: activoAEditar?.aseguradora ?? "",
    polizaNumero: activoAEditar?.polizaNumero ?? "",
    polizaVence: activoAEditar?.polizaVence ?? "",
    valorReposicionArs: activoAEditar?.valorReposicionArs != null ? String(activoAEditar.valorReposicionArs) : "",
    observaciones: activoAEditar?.observaciones ?? "",
  }));

  const editar = (campo: keyof typeof ficha) => (valor: string) => setFicha((f) => ({ ...f, [campo]: valor }));

  const tieneMarcaYAnio = TIENE_MARCA_Y_ANIO(campos.tipo);
  const tieneCantidad = TIENE_CANTIDAD(campos.tipo);
  const categoriaTipo = CATEGORIA_POR_TIPO[campos.tipo];
  const materialTipo = MATERIAL_POR_TIPO[campos.tipo];
  const camposFichaAplicables: (keyof typeof ficha)[] = [
    "identificacion",
    ...(tieneMarcaYAnio ? (["marcaModelo", "anio"] as const) : []),
    ...(categoriaTipo ? (["categoria"] as const) : []),
    ...(materialTipo ? (["material"] as const) : []),
    "estadoConservacion",
    ...(tieneCantidad ? (["cantidad", "unidadCantidad"] as const) : []),
    "alturaSobreSueloCm",
  ];
  const contar = (claves: (keyof typeof ficha)[]) => claves.filter((k) => ficha[k] !== "").length;

  const puedeMoverse = campos.movilidad === "MOVIBLE";
  const identificacionCompleta = Boolean(campos.nombre && campos.valorEstimado);

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        nombre: campos.nombre,
        tipo: campos.tipo,
        movilidad: campos.movilidad,
        valorEstimado: Number(campos.valorEstimado),
        ubicacion: esEdicion ? activoAEditar!.ubicacion : ubicacionNueva,
        // Vacío va como null: "sin dato" y "cero" no son lo mismo en un peritaje.
        identificacion: ficha.identificacion || null,
        marcaModelo: tieneMarcaYAnio ? ficha.marcaModelo || null : null,
        anio: tieneMarcaYAnio && ficha.anio ? Number(ficha.anio) : null,
        categoria: categoriaTipo ? ficha.categoria || null : null,
        material: materialTipo ? ficha.material || null : null,
        estadoConservacion: ficha.estadoConservacion || null,
        aseguradora: ficha.aseguradora || null,
        polizaNumero: ficha.polizaNumero || null,
        polizaVence: ficha.polizaVence || null,
        valorReposicionArs: ficha.valorReposicionArs ? Number(ficha.valorReposicionArs) : null,
        alturaSobreSueloCm: ficha.alturaSobreSueloCm ? Number(ficha.alturaSobreSueloCm) : null,
        cantidad: ficha.cantidad ? Number(ficha.cantidad) : null,
        unidadCantidad: ficha.unidadCantidad || null,
        observaciones: ficha.observaciones || null,
      };
      return esEdicion
        ? api.put<Activo>(`/activos/${activoAEditar!.id}`, { ...datos, loteId: campos.loteDestinoId })
        : api.post<Activo>(`/lotes/${loteId}/activos`, datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activos"] });
      notificar("exito", esEdicion ? "Activo actualizado" : "Activo agregado al lote");
      router.push(volverA);
    },
    onError: (e) => {
      const { tipo, mensaje } = clasificarError(e);
      notificar(tipo, mensaje, tipo === "error-servicio" ? () => guardar.mutate() : undefined);
    },
  });

  return (
    <FormularioPaginado
      titulo={esEdicion ? "Editar activo" : "Nuevo activo en el lote"}
      subtitulo="Lo del primer paso alimenta la priorización. Lo demás es lo que una aseguradora necesita para individualizar y valuar el bien."
      volverA={volverA}
      pasoActivo={paso}
      onPaso={setPaso}
      onGuardar={() => guardar.mutate()}
      guardando={guardar.isPending}
      etiquetaGuardar={esEdicion ? "Guardar cambios" : "Agregar activo"}
      pasos={[
        {
          titulo: "Identificación",
          descripcion: "Qué es y cuánto vale. Con esto el sistema lo prioriza frente a un anegamiento.",
          obligatorio: true,
          completo: identificacionCompleta,
          contenido: (
            <>
              <Texto
                etiqueta="Nombre del activo"
                valor={campos.nombre}
                onChange={(v) => setCampos((c) => ({ ...c, nombre: v }))}
                placeholder="Ej. Rodeo potrero norte"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Tipo">
                  <select
                    value={campos.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as TipoActivo;
                      setCampos((c) => ({ ...c, tipo, movilidad: MOVILIDAD_POR_DEFECTO[tipo] }));
                      setFicha((f) => ({
                        ...f,
                        marcaModelo: "",
                        anio: "",
                        categoria: "",
                        material: "",
                        ...(TIENE_CANTIDAD(tipo) ? {} : { cantidad: "", unidadCantidad: "" }),
                      }));
                    }}
                    className={CLASES_CAMPO}
                  >
                    {(Object.keys(ETIQUETA_TIPO) as TipoActivo[]).map((t) => (
                      <option key={t} value={t}>
                        {ETIQUETA_TIPO[t]}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Texto
                  etiqueta="Valor estimado (USD)"
                  tipo="number"
                  valor={campos.valorEstimado}
                  onChange={(v) => setCampos((c) => ({ ...c, valorEstimado: v }))}
                />
              </div>

              <Campo
                etiqueta="Movilidad"
                ayuda={
                  puedeMoverse
                    ? "Un activo movible se puede pasar a otro lote y se puede arrastrar en el mapa."
                    : "Un activo fijo no se mueve de lote. Marcalo como movible si en realidad se traslada."
                }
              >
                <select
                  value={campos.movilidad}
                  onChange={(e) => setCampos((c) => ({ ...c, movilidad: e.target.value as Movilidad }))}
                  className={CLASES_CAMPO}
                >
                  <option value="MOVIBLE">Movible</option>
                  <option value="FIJO">Fijo</option>
                </select>
              </Campo>

              {esEdicion && puedeMoverse && (
                <Campo etiqueta="Lote" ayuda="Al cambiarlo de lote, la ubicación pasa al centro del lote destino.">
                  <select
                    value={campos.loteDestinoId}
                    onChange={(e) => setCampos((c) => ({ ...c, loteDestinoId: e.target.value }))}
                    className={CLASES_CAMPO}
                  >
                    {lotes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
            </>
          ),
        },
        {
          titulo: "Ficha técnica",
          descripcion: "Cómo se individualiza el bien. Sin esto la aseguradora no puede distinguirlo de otro igual.",
          completo: contar(camposFichaAplicables) === camposFichaAplicables.length,
          contenido: (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Texto
                  etiqueta="Identificación"
                  ayuda={AYUDA_IDENTIFICACION[campos.tipo]}
                  valor={ficha.identificacion}
                  onChange={editar("identificacion")}
                />
                {tieneMarcaYAnio && (
                  <>
                    <Texto etiqueta="Marca y modelo" valor={ficha.marcaModelo} onChange={editar("marcaModelo")} />
                    <Texto etiqueta="Año" tipo="number" valor={ficha.anio} onChange={editar("anio")} />
                  </>
                )}
                {categoriaTipo && (
                  <Opciones
                    etiqueta={categoriaTipo.etiqueta}
                    valor={ficha.categoria}
                    opciones={categoriaTipo.opciones}
                    onChange={editar("categoria")}
                  />
                )}
                {materialTipo && (
                  <Opciones
                    etiqueta={materialTipo.etiqueta}
                    valor={ficha.material}
                    opciones={materialTipo.opciones}
                    onChange={editar("material")}
                  />
                )}
                <Opciones
                  etiqueta="Estado de conservación"
                  valor={ficha.estadoConservacion}
                  opciones={["Nuevo", "Muy bueno", "Bueno", "Regular", "Malo"]}
                  onChange={editar("estadoConservacion")}
                />
                {tieneCantidad && (
                  <>
                    <Texto etiqueta="Cantidad" tipo="number" valor={ficha.cantidad} onChange={editar("cantidad")} />
                    <Opciones
                      etiqueta="Unidad"
                      ayuda="Dimensiona la pérdida."
                      valor={ficha.unidadCantidad}
                      opciones={campos.tipo === "HACIENDA" ? ["cabezas"] : ["toneladas", "kg", "rollos", "fardos"]}
                      onChange={editar("unidadCantidad")}
                    />
                  </>
                )}
              </div>

              <Texto
                etiqueta="Altura sobre el suelo (cm)"
                ayuda="Con este dato el sistema puede decir si una lámina de agua determinada alcanza a este activo."
                tipo="number"
                valor={ficha.alturaSobreSueloCm}
                onChange={editar("alturaSobreSueloCm")}
              />
            </>
          ),
        },
        {
          titulo: "Cobertura",
          descripcion: "Contra qué está asegurado y por cuánto. Es lo que se discute al momento de indemnizar.",
          completo: contar(["aseguradora", "polizaNumero", "polizaVence", "valorReposicionArs"]) === 4,
          contenido: (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Texto etiqueta="Aseguradora" valor={ficha.aseguradora} onChange={editar("aseguradora")} />
                <Texto etiqueta="Número de póliza" valor={ficha.polizaNumero} onChange={editar("polizaNumero")} />
                <Texto etiqueta="Vence" tipo="date" valor={ficha.polizaVence} onChange={editar("polizaVence")} />
                <Texto
                  etiqueta="Valor de reposición (ARS)"
                  ayuda="La indemnización se discute sobre este valor, no sobre el estimado."
                  tipo="number"
                  valor={ficha.valorReposicionArs}
                  onChange={editar("valorReposicionArs")}
                />
              </div>

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
        // Solo en edición: subir fotos requiere que el activo ya exista (necesita su id).
        ...(esEdicion
          ? [
              {
                titulo: "Fotos",
                descripcion: "Se adjuntan al informe de emergencia agropecuaria como respaldo del estado del activo.",
                contenido: <PanelFotosActivo activoId={activoAEditar!.id} />,
              } satisfies Paso,
            ]
          : []),
      ]}
    />
  );
}
