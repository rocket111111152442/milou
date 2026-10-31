/*
 * Service worker de Waverti (PWA).
 *
 * Règles de confidentialité :
 * - aucune page de l'espace client, aucune réponse d'API et aucune donnée personnelle n'est mise en cache ;
 * - seuls les fichiers statiques publics (scripts et styles versionnés de Next.js, icônes, polices)
 *   et la page « hors ligne » sont conservés ;
 * - la surveillance ne s'exécute jamais dans le téléphone : elle est faite par les serveurs de Waverti.
 */
const VERSION = "waverti-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/hors-ligne";
const PRECACHE = [OFFLINE_URL, "/brand/icon-192.png", "/brand/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || /\.(?:woff2|png|svg|ico)$/.test(url.pathname)) &&
    !url.pathname.startsWith("/api/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations : toujours le réseau (données à jour, session vérifiée). Hors connexion : page dédiée.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? new Response("Hors ligne", { status: 503 })),
    );
    return;
  }

  // Fichiers statiques versionnés : cache d'abord (ils ne changent jamais pour une même adresse).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      }),
    );
  }
  // Tout le reste (API, pages privées) : réseau uniquement, sans cache.
});

// À la déconnexion, la page demande l'effacement des caches.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "waverti:clear-caches") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

// Notifications push (préparation) : affichées uniquement si le serveur en envoie, ce qui n'est pas encore activé.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Waverti", body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" ? data.title.slice(0, 120) : "Waverti";
  const body = typeof data.body === "string" ? data.body.slice(0, 300) : "";
  const target = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/app/alertes";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: target },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app/alertes";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
