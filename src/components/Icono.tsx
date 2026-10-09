/**
 * Set de iconos propio, trazo de 1.5 sobre una grilla de 24.
 *
 * Existe en vez de sumar una libreria porque la navegacion necesita una docena de glifos y
 * todos tienen que hablar el mismo idioma que la marca (curvas de nivel, agua, lote): un set
 * generico de 1.500 iconos trae el riesgo contrario, que cada pantalla elija uno de otra familia.
 * Van siempre acompañados de texto salvo en el menu contraido, donde el nombre sale en el tooltip.
 */
const TRAZOS = {
  panorama: (
    <>
      <path d="M3 17c3-2.2 5.5-2.2 8.5 0s6 2.2 9.5 0" />
      <path d="M3 12c3-2.2 5.5-2.2 8.5 0s6 2.2 9.5 0" opacity=".55" />
      <circle cx="12" cy="6" r="2" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 4 21 19.5H3L12 4Z" strokeLinejoin="round" />
      <path d="M12 10v4.5M12 17v.01" />
    </>
  ),
  pronostico: (
    <>
      <path d="M7 15.5a4 4 0 1 1 1.2-7.8A5 5 0 0 1 17.5 9 3.3 3.3 0 0 1 17 15.5H7Z" strokeLinejoin="round" />
      <path d="M9 18.5 8.3 20M13 18.5l-.7 1.5M17 18.5l-.7 1.5" />
    </>
  ),
  plan: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 5.5 5 5v3M4 11h2l-2 2h2M4 17h2l-1 1 1 1H4" strokeLinejoin="round" />
    </>
  ),
  simulador: (
    <>
      <path d="M3 18c2.5-1.6 4.5-1.6 7 0s4.5 1.6 7 0 3-1 4-.5" />
      <path d="M12 3.5c2.4 3 3.6 5.1 3.6 6.7a3.6 3.6 0 1 1-7.2 0c0-1.6 1.2-3.7 3.6-6.7Z" strokeLinejoin="round" />
    </>
  ),
  danos: (
    <>
      <path d="M6 3.5h8l4 4v13H6v-17Z" strokeLinejoin="round" />
      <path d="M14 3.5v4h4M9 13h6M9 16.5h4" />
    </>
  ),
  impacto: (
    <>
      <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
    </>
  ),
  informe: (
    <>
      <path d="M6 3.5h12v17H6v-17Z" strokeLinejoin="round" />
      <path d="M9 8h6M9 11.5h6M9 15h3" />
    </>
  ),
  lotes: (
    <>
      <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20V6.5Z" strokeLinejoin="round" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  activos: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5V20h-17v-9.5Z" strokeLinejoin="round" />
      <path d="M9.5 20v-5.5h5V20" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  historico: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 4.5v3h3" strokeLinejoin="round" />
      <path d="M12 8.5V12l2.5 1.5" strokeLinejoin="round" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  contraer: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M15 10l-2 2 2 2" strokeLinejoin="round" />
    </>
  ),
  expandir: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M13 10l2 2-2 2" strokeLinejoin="round" />
    </>
  ),
  salir: (
    <>
      <path d="M14 4.5H5.5v15H14" strokeLinejoin="round" />
      <path d="M10 12h10M17 9l3 3-3 3" strokeLinejoin="round" />
    </>
  ),
  cambiar: <path d="M7 10 12 5l5 5M7 14l5 5 5-5" strokeLinejoin="round" />,
  derecha: <path d="m9.5 6 6 6-6 6" strokeLinejoin="round" />,
  izquierda: <path d="m14.5 6-6 6 6 6" strokeLinejoin="round" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.01" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinejoin="round" />,
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = "h-5 w-5" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
