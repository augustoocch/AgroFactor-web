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

/**
 * Un 401 significa "esta sesion ya no es valida" (token vencido o corrupto) — distinto de un 403,
 * que la app usa a proposito cuando estas logueado pero el recurso no es tuyo (ver
 * AccesoNoAutorizadoException). Antes ambos volvian 403 y no se podian distinguir: una sesion
 * vencida dejaba la pantalla de establecimientos sin cargar, sin ninguna pista de por que.
 */
function manejarSesionVencida() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("elagua.token");
  window.localStorage.removeItem("elagua.sesion");
  if (window.location.pathname !== "/login") {
    // Fuera de un componente no hay useRouter; una recarga dura tambien garantiza que no quede
    // estado de React (queries en cache, etc.) de la sesion vieja dando vueltas.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenActual();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    manejarSesionVencida();
  }

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

/**
 * Descarga un archivo de la API y dispara el guardado en el navegador.
 *
 * No alcanza con un `<a href>`: la API va autenticada por header y un link plano no lo lleva.
 * Se pide con fetch, se arma un blob y se dispara la descarga con el nombre que manda el
 * servidor en Content-Disposition.
 */
export async function descargarArchivo(path: string, nombrePorDefecto: string): Promise<void> {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem("elagua.token");
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (response.status === 401) manejarSesionVencida();
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(body.error ?? "No se pudo descargar el archivo", response.status);
  }

  const nombreDelServidor = response.headers
    .get("content-disposition")
    ?.match(/filename="?([^"]+)"?/)?.[1];

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreDelServidor ?? nombrePorDefecto;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  // Sin esto el blob queda retenido en memoria mientras viva la pestania.
  URL.revokeObjectURL(url);
}

/**
 * Trae una imagen autenticada y devuelve un object URL para usar en <img src>.
 * Un <img src="/activos/.../fotos/...) plano no manda el header Authorization.
 * Quien la use es responsable de revocar el URL (URL.revokeObjectURL) cuando ya no se muestra.
 */
export async function obtenerImagenUrl(path: string): Promise<string> {
  const token = tokenActual();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (response.status === 401) manejarSesionVencida();
  if (!response.ok) {
    throw new ApiError("No se pudo cargar la imagen", response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Sube un archivo multipart. Sin Content-Type manual: el browser arma el boundary solo. */
export async function subirArchivo<T>(path: string, formData: FormData): Promise<T> {
  const token = tokenActual();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", body: formData, headers });
  if (response.status === 401) manejarSesionVencida();
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(body.error ?? "No se pudo subir el archivo", response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
