// Service worker : l'interface se charge instantanément (cache), les données passent toujours par le réseau.
const VERSION = 'netdex-v11';
const SHELL = ['/', '/app.css', '/js/app.js', '/js/core.js', '/js/views.js', '/js/chart.js', '/js/fun.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Stale-while-revalidate : on sert le cache tout de suite et on le met à jour en arrière-plan.
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(key);
    const network = fetch(e.request).then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
