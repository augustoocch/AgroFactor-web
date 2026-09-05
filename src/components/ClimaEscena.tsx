import type { CondicionClimatica } from "@/lib/types";

/**
 * Fondo decorativo del hero de clima: sol/nubes/lluvia/tormenta segun la condicion real del dia,
 * con @keyframes puros en globals.css (lluvia-cae, nube-deriva, sol-pulso, rayo-flash).
 * aria-hidden + pointer-events-none: es puramente decorativo, nunca interfiere con la lectura
 * ni con clicks; se apaga solo con prefers-reduced-motion (ver globals.css).
 */
export function ClimaEscena({ condicion }: { condicion: CondicionClimatica }) {
  const gotas = condicion === "LLUVIA" || condicion === "TORMENTA";
  const sol = condicion === "SOL";
  const rayo = condicion === "TORMENTA";

  return (
    <div aria-hidden className="clima-escena pointer-events-none absolute inset-0 overflow-hidden">
      {sol && (
        <div
          className="absolute -right-6 -top-6 h-28 w-28 rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(85% 0.15 85 / 0.9), oklch(85% 0.15 85 / 0) 70%)",
            animation: "sol-pulso 3.5s ease-in-out infinite",
          }}
        />
      )}

      {condicion !== "SOL" && (
        <>
          <div
            className="absolute left-[8%] top-4 h-10 w-32 rounded-full bg-paper-50/40 blur-md"
            style={{ animation: "nube-deriva 9s ease-in-out infinite alternate" }}
          />
          <div
            className="absolute right-[12%] top-10 h-8 w-24 rounded-full bg-paper-50/30 blur-md"
            style={{ animation: "nube-deriva 12s ease-in-out infinite alternate-reverse" }}
          />
        </>
      )}

      {gotas &&
        Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 block h-6 w-px bg-brand-200/70"
            style={{
              left: `${(i * 7.3) % 100}%`,
              animation: `lluvia-cae ${0.6 + (i % 5) * 0.15}s linear infinite`,
              animationDelay: `${(i % 7) * 0.2}s`,
            }}
          />
        ))}

      {rayo && (
        <div className="absolute inset-0 bg-paper-50/60" style={{ animation: "rayo-flash 4s ease-in-out infinite" }} />
      )}
    </div>
  );
}
