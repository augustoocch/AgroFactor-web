import { InfoModal } from "@/components/InfoModal";
import type { Establecimiento } from "@/lib/types";

const ETIQUETAS: { key: keyof Establecimiento["pesosPrioridad"]; label: string; color: string }[] = [
  { key: "impacto", label: "Impacto", color: "var(--color-brand-600)" },
  { key: "urgencia", label: "Urgencia", color: "var(--color-risk-alto)" },
  { key: "recursos", label: "Recursos", color: "var(--color-clay-500)" },
  { key: "reversibilidad", label: "Reversibilidad", color: "var(--color-risk-medio)" },
];

/** Muestra los pesos que rigen el ranking de este establecimiento — el hallazgo de la Encuesta B de que la prioridad cambia segun el perfil productivo, visible en la UI. */
export function PesosPrioridadCard({ establecimiento }: { establecimiento: Establecimiento }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-100/30 p-5">
      <div className="flex items-center gap-1.5">
        <p className="text-sm uppercase tracking-wide text-brand-600">Perfil {establecimiento.perfilProductivo.toLowerCase()}</p>
        <InfoModal titulo="Por que estos pesos y no otros">
          <p>
            Tres asesores relevados en la investigacion dijeron, sin que se les preguntara directamente, que el
            orden de prioridad de activos cambia segun el tipo de establecimiento: en un tambo los caminos son
            prioridad maxima, en uno ganadero la hacienda y las reservas, en uno agricola la maquinaria y los
            depositos.
          </p>
          <p>Por eso los pesos no son un numero fijo: se definen por perfil productivo y se pueden ajustar por establecimiento si el contexto local lo justifica.</p>
        </InfoModal>
      </div>
      <p className="mt-0.5 text-sm text-ink-700">Pesos del motor de priorizacion para este establecimiento</p>
      <div className="mt-4 space-y-2.5">
        {ETIQUETAS.map((e) => {
          const valor = establecimiento.pesosPrioridad[e.key];
          return (
            <div key={e.key} className="flex items-center gap-2.5">
              <span className="w-24 shrink-0 text-xs text-ink-600">{e.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-50">
                <div className="h-full rounded-full" style={{ width: `${valor * 100}%`, backgroundColor: e.color }} />
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-xs text-ink-600">{valor.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
