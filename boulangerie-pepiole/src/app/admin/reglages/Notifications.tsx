"use client";

import { useEffect, useState } from "react";
import { SHOPS, type ShopId } from "@/lib/shops";
import { subscribeDevice, unsubscribeDevice } from "../actions";

type State = "chargement" | "non-supporte" | "ios-ecran-accueil" | "refuse" | "inactif" | "actif";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function Notifications({ configured, vapidKey, devices }: { configured: boolean; vapidKey: string; devices: number }) {
  const [state, setState] = useState<State>("chargement");
  const [shops, setShops] = useState<ShopId[]>(SHOPS.map((s) => s.id));
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-ecran-accueil" : "non-supporte");
        return;
      }
      if (Notification.permission === "denied") return setState("refuse");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "actif" : "inactif");
    })().catch(() => setState("non-supporte"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("refuse");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await subscribeDevice({ endpoint: json.endpoint, keys: json.keys }, shops, label || navigator.platform || "Appareil");
      setState("actif");
      setMessage(res.sent ? "C'est activé ! Une notification de test vient d'être envoyée." : "Activé. (La notification de test n'a pas pu être envoyée.)");
    } catch (e) {
      setMessage(`Impossible d'activer : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeDevice(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("inactif");
      setMessage("Notifications désactivées sur cet appareil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-[1.75rem] bg-cafe p-6 text-creme sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="font-script text-2xl text-dore">Ne ratez aucune commande</p>
          <h2 className="font-display text-2xl">Notifications sur cet appareil</h2>
          <p className="mt-2 text-sm text-creme/70">
            Activez-les sur le téléphone ou l&apos;ordinateur de chaque boutique : une alerte arrive dès qu&apos;un client
            commande, même si le site est fermé. {devices > 0 && <strong className="text-dore">{devices} appareil{devices > 1 ? "s" : ""} déjà enregistré{devices > 1 ? "s" : ""}.</strong>}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${state === "actif" ? "bg-olive text-creme" : "bg-creme/10 text-creme/70"}`}>
          {state === "actif" ? "Activées ici" : state === "chargement" ? "…" : "Désactivées ici"}
        </span>
      </div>

      {!configured ? (
        <p className="mt-5 rounded-2xl bg-creme/10 px-4 py-3 text-sm">Les clés de notification ne sont pas configurées sur le serveur (VAPID).</p>
      ) : state === "ios-ecran-accueil" ? (
        <div className="mt-5 rounded-2xl bg-creme/10 px-4 py-3 text-sm leading-relaxed">
          <strong>Sur iPhone / iPad</strong>, il faut d&apos;abord installer l&apos;espace boutiques : dans Safari, touchez{" "}
          <strong>Partager</strong> puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>. Ouvrez ensuite l&apos;icône
          « Commandes » et revenez ici pour activer les notifications (iOS 16.4 minimum).
        </div>
      ) : state === "non-supporte" ? (
        <p className="mt-5 rounded-2xl bg-creme/10 px-4 py-3 text-sm">Ce navigateur ne gère pas les notifications. Utilisez Chrome, Edge, Firefox ou Safari récent.</p>
      ) : state === "refuse" ? (
        <p className="mt-5 rounded-2xl bg-creme/10 px-4 py-3 text-sm">
          Les notifications ont été bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône à gauche de l&apos;adresse), puis rechargez la page.
        </p>
      ) : state === "actif" ? (
        <button type="button" onClick={disable} disabled={busy} className="mt-5 h-11 rounded-full border border-creme/25 px-5 text-sm font-semibold transition hover:bg-creme/10 disabled:opacity-50">
          Désactiver sur cet appareil
        </button>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            {SHOPS.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={shops.includes(s.id)}
                  onChange={(e) => setShops((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
                  className="h-5 w-5 accent-dore"
                />
                Commandes de {s.short}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nom de l'appareil (ex. Tablette comptoir Sanary)"
              className="h-11 min-w-0 flex-1 rounded-full border border-creme/20 bg-creme/10 px-4 text-sm text-creme placeholder:text-creme/40 outline-none focus:border-dore"
            />
            <button type="button" onClick={enable} disabled={busy || shops.length === 0} className="h-11 rounded-full bg-dore px-6 text-sm font-semibold text-torref transition hover:bg-creme disabled:opacity-50">
              {busy ? "Activation…" : "🔔 Activer les notifications"}
            </button>
          </div>
        </div>
      )}
      {message && <p className="mt-4 text-sm text-dore">{message}</p>}
    </section>
  );
}
