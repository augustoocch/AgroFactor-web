"use client";

import Link from "next/link";
import { use } from "react";
import { EncabezadoPantalla } from "@/components/EncabezadoPantalla";
import { InfoAside } from "@/components/InfoAside";
import { PanelDeclaracionDanos } from "@/components/PanelDeclaracionDanos";
import { boton, enlace } from "@/lib/estilos";
import { rutaDe } from "@/lib/navegacion";

/**
 * Primer paso despues del evento (user flow 3): el % de daño por cultivo y por activo. Es el dato
 * que alimenta el impacto economico y el informe de la Ley 26.509, por eso va primero en el grupo.
 */
export default function DanosPage({ params }: PageProps<"/establecimientos/[id]/danos">) {
  const { id } = use(params);

  return (
    <div>
      <EncabezadoPantalla
        segmento="danos"
        titulo="Declarar daños"
        descripcion="Cuánto se perdió en cada cultivo y en cada activo. El número es tuyo: el sistema propone uno cuando tiene con qué calcularlo, pero no lo escribe ni lo corrige."
        ayuda={
          <InfoAside titulo="Para qué se usa esta declaración" etiqueta="Qué dice la Ley 26.509">
            <p>
              La Ley 26.509 considera <strong>emergencia agropecuaria</strong> un daño de al menos el 50% sobre la
              producción, y <strong>desastre agropecuario</strong> desde el 80%.
            </p>
            <p>
              El porcentaje que declares acá va al informe de emergencia y queda como respaldo de la declaración jurada
              que se presenta ante la autoridad provincial. También es la base del informe de impacto económico.
            </p>
            <p>
              Si declarás daño sobre un lote donde el sistema no registró agua, el informe lo marca. No bloquea nada: es
              la primera pregunta que va a hacer una aseguradora, y conviene tener la respuesta.
            </p>
          </InfoAside>
        }
        acciones={
          <Link href={rutaDe(id, "impacto")} className={enlace}>
            Siguiente: impacto económico
          </Link>
        }
      />

      <PanelDeclaracionDanos
        establecimientoId={id}
        vacio={
          <div className="rounded-xl border border-dashed border-paper-300 px-6 py-10 text-center">
            <p className="font-display text-lg text-ink-950">No hay nada cargado para declarar</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
              Los daños se declaran sobre los cultivos y los activos de cada lote.
            </p>
            <Link href={rutaDe(id, "lotes")} className={`${boton.secundario} mt-4`}>
              Ir a lotes
            </Link>
          </div>
        }
      />
    </div>
  );
}
