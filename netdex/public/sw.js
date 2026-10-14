const VERSION = 'netdex-v25';
const SHELL = ['/', '/app.css', '/js/app.js', '/js/core.js', '/js/views.js', '/js/chart.js', '/js/fun.js', '/js/shops.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Réseau d'abord : toujours la dernière version quand il y a du réseau, le cache ne sert qu'hors connexion.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(key, res.clone());
      return res;
    } catch {
      return (await cache.match(key)) || Response.error();
    }
  }));
});
