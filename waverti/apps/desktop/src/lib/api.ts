import { native } from "./native";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Appel de l'API Waverti via le processus Rust (jeton d'appareil ajouté côté Rust). */
export async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: { status: number; body: unknown };
  try {
    res = await native.apiRequest(method, path, body);
  } catch (e) {
    throw new ApiError(0, "network", typeof e === "string" ? e : "Serveur Waverti injoignable.");
  }
  const data = (res.body ?? {}) as Record<string, unknown>;
  if (res.status >= 400) {
    throw new ApiError(
      res.status,
      String(data.error ?? "error"),
      String(data.message ?? "Une erreur est survenue."),
      Array.isArray(data.issues) ? (data.issues as Array<{ path: string; message: string }>) : [],
    );
  }
  return data as T;
}
