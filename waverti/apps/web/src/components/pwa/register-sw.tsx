"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Enregistre le service worker (installation sur l'écran d'accueil, page hors ligne) et propose de recharger
 * quand une nouvelle version du site est disponible. Production uniquement : en développement, le cache
 * gênerait le rechargement à chaud.
 */
export function RegisterServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Recharge uniquement après un clic sur « Recharger » : à la toute première installation, la prise de
    // contrôle par le service worker (clients.claim) déclenche aussi « controllerchange », et recharger à ce
    // moment effacerait un formulaire en cours de saisie.
    const onControllerChange = () => {
      try {
        if (sessionStorage.getItem("waverti:sw-reload") !== "1") return;
        sessionStorage.removeItem("waverti:sw-reload");
      } catch {
        return;
      }
      window.location.reload();
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        // Vérifie régulièrement l'existence d'une nouvelle version (application laissée ouverte).
        const timer = window.setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
        return () => window.clearInterval(timer);
      })
      .catch(() => undefined);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  if (!waiting) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3 text-sm shadow-lg">
      <RefreshCw className="size-4 shrink-0 text-blue" aria-hidden="true" />
      <p className="flex-1">Une nouvelle version de Waverti est disponible.</p>
      <button
        type="button"
        className="rounded-lg bg-ink px-3 py-1.5 font-medium text-white"
        onClick={() => {
          try {
            sessionStorage.setItem("waverti:sw-reload", "1");
          } catch {
            // Stockage indisponible : rechargement manuel ci-dessous.
          }
          waiting.postMessage({ type: "waverti:skip-waiting" });
          window.setTimeout(() => window.location.reload(), 3000);
        }}
      >
        Recharger
      </button>
    </div>
  );
}

/** Efface les caches du service worker (appelé à la déconnexion, appareil partagé). */
export function clearServiceWorkerCaches() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "waverti:clear-caches" });
}
