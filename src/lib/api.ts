const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function tokenActual(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("elagua.token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenActual();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(body.error ?? "Error inesperado", response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Distingue error de validacion (400/404/403, mensaje del backend tal cual) de error de
 * servicio (502 cuando el risk-engine no responde, o la red cae) que admite reintentar.
 */
export function clasificarError(e: unknown): { tipo: "error-validacion" | "error-servicio"; mensaje: string } {
  if (e instanceof ApiError) {
    if (e.status === 502) return { tipo: "error-servicio", mensaje: e.message };
    return { tipo: "error-validacion", mensaje: e.message };
  }
  return { tipo: "error-servicio", mensaje: "No se pudo conectar con el servidor" };
}
