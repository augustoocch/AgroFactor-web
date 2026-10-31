import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "AgroFactor · Riesgo de anegamiento por lote",
  description:
    "Qué lote se anega, cuánto cuesta y qué proteger primero. Simulación de anegamiento a escala de lote para la Cuenca del Salado con relieve, suelo INTA, humedad ERA5 y pronóstico.",
  openGraph: {
    title: "AgroFactor · Riesgo de anegamiento por lote",
    description: "Qué lote se anega, cuánto cuesta y qué proteger primero.",
    locale: "es_AR",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AgroFactor",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "es-AR",
  description:
    "Sistema de riesgo de anegamiento para establecimientos agropecuarios: simula dónde se junta el agua en cada lote, estima el impacto económico y prioriza qué proteger.",
  areaServed: "Cuenca del Salado, Buenos Aires, Argentina",
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Landing />
    </>
  );
}
