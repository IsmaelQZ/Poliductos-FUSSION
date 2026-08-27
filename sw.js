// Service worker: cachea el "app shell" (HTML/CSS/JS/vendor propios) para
// que la app abra sin conexión, y cachea en tiempo de ejecución los tiles
// del mapa (OpenStreetMap) a medida que se piden — ya sea navegando el mapa
// o por la descarga proactiva de js/offline.js. La geometría de ruta real
// (OSRM) se cachea aparte, en IndexedDB, ver js/routing.js.
const SHELL_CACHE = 'rutas-shell-v17';
const TILE_CACHE = 'rutas-tiles-v1';
const MAX_TILE_ENTRIES = 8000; // cubre ambas rutas (z11–15) con margen
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/data.js',
  'js/db.js',
  'js/map.js',
  'js/routing.js',
  'js/offline.js',
  'js/csv.js',
  'js/sheet.js',
  'js/pricing.js',
  'data/routes.json',
  'data/config.json',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/marker-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const KNOWN_CACHES = [SHELL_CACHE, TILE_CACHE];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => !KNOWN_CACHES.includes(key)).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isMapTile(url) {
  return /\.tile\.openstreetmap\.org$/.test(url.hostname);
}

async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - MAX_TILE_ENTRIES;
  if (excess > 0) {
    await Promise.all(keys.slice(0, excess).map(key => cache.delete(key)));
  }
}

async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trimTileCache(); // no bloquea la respuesta
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isMapTile(url)) {
    event.respondWith(handleTileRequest(request));
    return;
  }

  if (url.origin !== self.location.origin) return; // p.ej. OSRM: ver js/routing.js

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
