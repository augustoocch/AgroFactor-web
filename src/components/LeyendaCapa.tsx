"use client";

import { colorDeBanda } from "@/components/MapaMeteorologia";
import type { CapaMeteorologica, RegimenResolucion } from "@/lib/types";

/** Como se llama cada horizonte en la cabeza del productor, no en la del modelo. */
const ORIGEN: Record<CapaMeteorologica["horizonte"], string> = {
  OBSERVACION: "Observacion satelital de las ultimas horas",
  PRONOSTICO: "Pronostico de modelo",
  MODELO_TERRENO: "Modelo hidrologico sobre el terreno real",
};

const ETIQUETA_REGIMEN: Record<RegimenResolucion, string> = {
  SUB_CELDA: "una sola zona",
  MARGINAL: "unas pocas zonas",
  RESUELTO: "varias zonas",
};

const ESTILO_REGIMEN: Record<RegimenResolucion, string> = {
  SUB_CELDA: "border-clay-500 bg-clay-100 text-clay-600",
  MARGINAL: "border-risk-medio bg-risk-medio-bg text-risk-medio",
  RESUELTO: "border-risk-bajo bg-risk-bajo-bg text-risk-bajo",
};

export function LeyendaCapa({ capa }: { capa: CapaMeteorologica }) {
  return (
    <div className="space-y-3 rounded-2xl border border-paper-300 bg-paper-50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-medium text-ink-950">{capa.titulo}</h3>
        {capa.regimen && (
          // El regimen se declara, no se asume: es lo que hace creible al resto de la pestania.
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTILO_REGIMEN[capa.regimen]}`}>
            distingue {ETIQUETA_REGIMEN[capa.regimen]} sobre tu campo
          </span>
        )}
      </div>

      {/* La etiqueta de origen no es opcional: no es lo mismo lo que se midio que lo que se espera. */}
      <p className="text-xs text-ink-600">
        {ORIGEN[capa.horizonte]}
        {capa.fuente && <> · {capa.fuente}</>}
        {capa.resolucionKm != null && (
          <>
            {" "}
            · detalle medido de {capa.resolucionKm} km
            {capa.razonResolucion != null && <> (el campo mide {capa.razonResolucion} veces eso)</>}
          </>
        )}
      </p>

      {capa.disponible ? (
        <p className="text-sm text-ink-700">{capa.mensaje}</p>
      ) : (
        <p className="text-sm text-ink-700">{capa.motivoNoDisponible}</p>
      )}

      {capa.bandas.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-800">
            Cada banda representa {capa.horizonte === "MODELO_TERRENO" ? "el agua acumulada" : "la lluvia"} en{" "}
            {capa.unidad}
          </p>
          <div className="flex flex-wrap gap-2">
            {capa.bandas.map((banda, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs text-ink-700">
                <span
                  className="inline-block h-3 w-6 rounded-sm border border-ink-400/30"
                  style={{ background: colorDeBanda(i, capa.bandas.length), opacity: 0.75 }}
                />
                {banda.desde}–{banda.hasta}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lo que el modelo NO puede decir, dicho donde el usuario lo va a leer. */}
      {capa.horizonte === "MODELO_TERRENO" && capa.bandas.length > 0 && (
        <p className="border-t border-paper-300 pt-2.5 text-xs text-ink-600">
          El relieve pampeano es del mismo orden que el error del sensor satelital que mide la altura del terreno. Por
          eso esta capa es confiable para decir <strong>cuanta</strong> agua se junta y <strong>cuando</strong>, y no
          para senalar el punto exacto.
        </p>
      )}
    </div>
  );
}
