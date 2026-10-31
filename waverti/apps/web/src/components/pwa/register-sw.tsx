"use client";
import { useEffect } from "react";

/**
 * Enregistre le service worker (installation sur l'écran d'accueil, page hors ligne).
 * Production uniquement : en développement, le cache gênerait le rechargement à chaud.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}

/** Efface les caches du service worker (appelé à la déconnexion, appareil partagé). */
export function clearServiceWorkerCaches() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "waverti:clear-caches" });
}
