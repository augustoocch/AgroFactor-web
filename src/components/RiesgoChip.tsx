function nivel(score: number): { label: string; bg: string; fg: string } {
  if (score >= 0.66) return { label: "alto", bg: "var(--color-risk-alto-bg)", fg: "var(--color-risk-alto)" };
  if (score >= 0.33) return { label: "medio", bg: "var(--color-risk-medio-bg)", fg: "var(--color-risk-medio)" };
  return { label: "bajo", bg: "var(--color-risk-bajo-bg)", fg: "var(--color-risk-bajo)" };
}

export function RiesgoChip({ score }: { score: number }) {
  const { label, bg, fg } = nivel(score);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fg }} />
      {score.toFixed(2)} · riesgo {label}
    </span>
  );
}
