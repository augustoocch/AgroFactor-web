"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";

/**
 * Un 4xx es una respuesta, no una falla transitoria: el establecimiento no existe (404) o no
 * es accesible (403), y reintentar da lo mismo tres veces mas tarde. Con el default de React
 * Query esos casos tardaban ~7s en llegar a status "error"; el usuario veia el estado de carga
 * todo ese tiempo. Los 5xx y las caidas de red si se reintentan, que es para lo que sirve.
 */
function reintentar(cantidadDeFallos: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return cantidadDeFallos < 3;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: reintentar } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
