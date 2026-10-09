import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las pantallas se renombraron al separar responsabilidades: "Meteorologia" paso a ser
  // "Pronostico" (sin la simulacion, que tiene pantalla propia) y "Reportes" se dividio en
  // Declarar daños, Impacto economico e Informes. Los enlaces viejos siguen funcionando.
  async redirects() {
    return [
      { source: "/establecimientos/:id/meteorologia", destination: "/establecimientos/:id/pronostico", permanent: false },
      { source: "/establecimientos/:id/reportes", destination: "/establecimientos/:id/informes", permanent: false },
    ];
  },
  // App privada detras de login: headers basicos de endurecimiento. Sin CSP estricta porque el
  // mapa carga teselas de terceros y la API vive en otro origen configurable por entorno.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
