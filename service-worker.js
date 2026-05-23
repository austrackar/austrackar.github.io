const CACHE = 'ruta-segura-v1';
const PRECACHE = [
  '/',
  'index.html',
  'login.html',
  'track.html',
  'css/styles.css',
  'css/mobile.css',
  'data/datos.js',
  'data/export.json',
  'js/app.js',
  'js/auth.js',
  'js/map.js',
  'js/ui.js',
  'js/flota.js',
  'js/data-fetcher.js',
  'js/firebase-config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
