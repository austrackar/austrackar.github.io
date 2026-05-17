const CACHE_NAME = 'rutasegura-v6';
const STATIC_ASSETS = [
  '/', '/index.html',
  '/css/styles.css',
  '/js/app.js', '/js/map.js', '/js/ui.js',
  '/data/datos.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Cache map tiles
  if (url.href.includes('basemaps.cartocdn.com') || url.href.includes('tile.openstreetmap.org') || url.href.includes('tiles.stadiamaps.com')) {
    e.respondWith(
      caches.open('map-tiles').then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // Cache OSRM/Nominatim API calls
  if (url.href.includes('router.project-osrm.org') || url.href.includes('nominatim.openstreetmap.org')) {
    e.respondWith(
      caches.open('api-cache').then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached || new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } }));
        })
      )
    );
    return;
  }

  // Static assets: cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Receive messages from main thread
self.addEventListener('message', e => {
  if (e.data.type === 'CACHE_ROUTE') {
    const { urls } = e.data;
    caches.open('downloaded-routes').then(cache => {
      urls.forEach(url => fetch(url).then(res => { if (res.ok) cache.put(url, res); }).catch(() => {}));
    });
  }
});
