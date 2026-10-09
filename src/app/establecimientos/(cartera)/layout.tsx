import { AppHeader } from "@/components/AppHeader";

/** Pantallas fuera de un establecimiento (el listado y el alta): barra superior simple, sin menu lateral. */
export default function CarteraLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[76rem] flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </>
  );
}
