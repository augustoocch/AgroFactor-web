import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";

export default function EstablecimientosLayout({ children }: LayoutProps<"/establecimientos">) {
  return (
    <RequireAuth>
      <AppHeader />
      <main className="mx-auto w-full max-w-[90rem] flex-1 px-6 py-8">{children}</main>
    </RequireAuth>
  );
}
