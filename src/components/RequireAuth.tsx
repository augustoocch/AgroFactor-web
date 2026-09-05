"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

/** Guarda de rutas del lado del cliente: no hay SSR de datos privados, todo se pide a api-core con el JWT en localStorage. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { sesion, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !sesion) router.replace("/login");
  }, [cargando, sesion, router]);

  if (cargando || !sesion) return null;
  return <>{children}</>;
}
