"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/BrandMark";

const ETIQUETA_ROL: Record<string, string> = {
  PRODUCTOR: "Productor",
  ASESOR: "Asesor técnico",
  ADMINISTRADOR: "Administrador",
};

export function AppHeader() {
  const { sesion, cerrarSesion } = useAuth();
  const router = useRouter();

  if (!sesion) return null;

  return (
    <header className="border-b border-paper-300 bg-paper-50/90 backdrop-blur supports-[backdrop-filter]:bg-paper-50/70">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between px-6 py-3.5">
        <Link href="/establecimientos" className="flex items-center gap-2.5">
          <BrandMark className="h-7 w-7" />
          <span className="font-display text-[1.05rem] font-medium tracking-tight text-ink-950">
            AgroFactor
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-ink-950">{sesion.nombre}</p>
            <p className="text-xs uppercase tracking-wide text-brand-600">{ETIQUETA_ROL[sesion.rol]}</p>
          </div>
          <button
            onClick={() => {
              cerrarSesion();
              router.replace("/login");
            }}
            className="rounded-full border border-paper-300 px-3.5 py-1.5 text-sm text-ink-600 transition-colors hover:border-brand-500 hover:text-brand-700"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
