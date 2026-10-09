import { RequireAuth } from "@/components/RequireAuth";

/**
 * Solo la sesion. El armazon visual lo pone cada rama: el listado y el alta llevan la barra
 * superior (`(cartera)/layout.tsx`); un establecimiento abierto, el menu lateral (`[id]/layout.tsx`).
 */
export default function EstablecimientosLayout({ children }: LayoutProps<"/establecimientos">) {
  return <RequireAuth>{children}</RequireAuth>;
}
