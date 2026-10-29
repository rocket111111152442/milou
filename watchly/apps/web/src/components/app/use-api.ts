"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@watchly/ui";

export interface ApiErrorBody {
  error?: string;
  message?: string;
  issues?: Array<{ path: string; message: string }>;
}

export async function apiCall<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody }> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "POST",
      headers: { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
    if (!res.ok) return { ok: false, status: res.status, error: data };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: { message: "Connexion impossible. Vérifiez votre réseau." } };
  }
}

/** Action API avec état de chargement, toasts et rafraîchissement des Server Components. */
export function useApiAction() {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T,>(url: string, body?: unknown, opts: { method?: string; success?: string; refresh?: boolean } = {}) => {
      setPending(true);
      const r = await apiCall<T>(url, { method: opts.method, body });
      setPending(false);
      if (!r.ok) {
        push({ tone: "error", title: "Action impossible", description: r.error.message ?? "Une erreur est survenue." });
        return null;
      }
      if (opts.success) push({ tone: "success", title: opts.success });
      if (opts.refresh !== false) router.refresh();
      return r.data;
    },
    [push, router],
  );
  return { run, pending };
}
