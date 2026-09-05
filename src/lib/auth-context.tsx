"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthResponse, Rol } from "@/lib/types";

interface Sesion {
  email: string;
  nombre: string;
  rol: Rol;
}

interface AuthContextValue {
  sesion: Sesion | null;
  cargando: boolean;
  iniciarSesion: (auth: AuthResponse) => void;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY_TOKEN = "elagua.token";
const STORAGE_KEY_SESION = "elagua.sesion";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Lectura unica de la sesion persistida al montar en el cliente: null en SSR y en el
    // primer render evita un mismatch de hidratacion; `cargando` gatea a los consumidores
    // (RequireAuth) hasta que este efecto corre, asi que la cascada de renders es intencional.
    const guardada = window.localStorage.getItem(STORAGE_KEY_SESION);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (guardada) setSesion(JSON.parse(guardada));
    setCargando(false);
  }, []);

  const iniciarSesion = useCallback((auth: AuthResponse) => {
    const nuevaSesion: Sesion = { email: auth.email, nombre: auth.nombre, rol: auth.rol };
    window.localStorage.setItem(STORAGE_KEY_TOKEN, auth.token);
    window.localStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(nuevaSesion));
    setSesion(nuevaSesion);
  }, []);

  const cerrarSesion = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY_TOKEN);
    window.localStorage.removeItem(STORAGE_KEY_SESION);
    setSesion(null);
  }, []);

  const value = useMemo(
    () => ({ sesion, cargando, iniciarSesion, cerrarSesion }),
    [sesion, cargando, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
