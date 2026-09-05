/** Marca: curvas de nivel (isohipsas) que se "inundan" de abajo hacia arriba — el concepto central del producto, no un icono generico. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M2 22c4-3 7-3 10 0s6 3 10 0 6-3 8-1" stroke="var(--color-brand-600)" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 16c4-3 7-3 10 0s6 3 10 0 6-3 8-1" stroke="var(--color-brand-600)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M2 10c4-3 7-3 10 0s6 3 10 0 6-3 8-1" stroke="var(--color-clay-500)" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}
