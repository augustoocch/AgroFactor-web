import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";

/** Herramienta global (no de un establecimiento): barra superior simple, como el listado. */
export default function CalibracionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppHeader />
      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </RequireAuth>
  );
}
