"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AuthResponse, Perfil } from "@/lib/types";

interface Sesion {
  email: string;
  nombre: string;
  perfil: Perfil;
  adminPlataforma: boolean;
}

function aSesion(auth: AuthResponse): Sesion {
  return { email: auth.email, nombre: auth.nombre, perfil: auth.perfil, adminPlataforma: auth.adminPlataforma };
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
    // Lo guardado puede estar viejo (sesiones de antes del cambio de roles, o un permiso de
    // plataforma que se quito): se refresca contra el servidor, que es quien decide.
    if (window.localStorage.getItem(STORAGE_KEY_TOKEN)) {
      api
        .get<AuthResponse>("/auth/me")
        .then((me) => {
          const actual = aSesion(me);
          window.localStorage.setItem(STORAGE_KEY_SESION, JSON.stringify(actual));
          setSesion(actual);
        })
        .catch((e) => {
          // 401: api.ts ya limpio el storage; aca se baja el estado. Otro error (red): queda la guardada.
          if (e instanceof ApiError && e.status === 401) setSesion(null);
        });
    }
  }, []);

  const iniciarSesion = useCallback((auth: AuthResponse) => {
    const nuevaSesion = aSesion(auth);
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
