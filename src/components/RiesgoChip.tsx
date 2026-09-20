import { Tooltip } from "@/components/Tooltip";
import { nivelRiesgo } from "@/lib/explicar-riesgo";

/**
 * El nivel de riesgo del lote, en una palabra.
 *
 * Antes mostraba tambien el valor crudo (`0.72 · riesgo alto`). Ese numero ordena lotes entre si
 * dentro del sistema, pero no tiene unidad ni escala conocida para quien lo lee: nadie hace algo
 * distinto con 0,72 que con 0,68. La palabra es lo unico que se usa para decidir; el tooltip dice
 * que implica, que es lo que el numero nunca dijo.
 */
const ESTILO: Record<"alto" | "medio" | "bajo", { bg: string; fg: string; ayuda: string }> = {
  alto: {
    bg: "var(--color-risk-alto-bg)",
    fg: "var(--color-risk-alto)",
    ayuda: "Este lote es de los primeros del campo en juntar agua: conviene mirarlo antes que el resto.",
  },
  medio: {
    bg: "var(--color-risk-medio-bg)",
    fg: "var(--color-risk-medio)",
    ayuda: "Este lote se anega con lluvias importantes, no con cualquiera.",
  },
  bajo: {
    bg: "var(--color-risk-bajo-bg)",
    fg: "var(--color-risk-bajo)",
    ayuda: "Hace falta una lluvia excepcional para que este lote junte agua.",
  },
};

export function RiesgoChip({ score }: { score: number }) {
  const label = nivelRiesgo(score);
  const { bg, fg, ayuda } = ESTILO[label];
  return (
    <Tooltip texto={ayuda} subrayado={false}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: bg, color: fg }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fg }} />
        Riesgo {label}
      </span>
    </Tooltip>
  );
}
