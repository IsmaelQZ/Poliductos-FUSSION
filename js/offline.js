// Descarga proactiva de todo lo necesario para usar una ruta sin conexión:
// la geometría del trazo real (vía routing.js, se guarda en IndexedDB) y
// los tiles del mapa que cubren la zona de esa ruta (el service worker los
// cachea automáticamente al pasar por su fetch handler, ver sw.js).
import { getRouteGeometry } from './routing.js';

const TILE_URL_TEMPLATE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SUBDOMAINS = ['a', 'b', 'c'];
const MIN_ZOOM = 11;
const MAX_ZOOM = 15; // z16 multiplica el volumen ~x3 sin aportar mucho: el
                      // detalle fino de navegación lo da Google Maps/Waze.
const CONCURRENCY = 6;
const PADDING_DEG = 0.03; // margen alrededor del cliente más externo

function lonToTileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

function boundsFromClients(clients) {
  const lats = clients.map(c => c.lat);
  const lngs = clients.map(c => c.lng);
  return {
    north: Math.max(...lats) + PADDING_DEG,
    south: Math.min(...lats) - PADDING_DEG,
    east: Math.max(...lngs) + PADDING_DEG,
    west: Math.min(...lngs) - PADDING_DEG,
  };
}

function tileUrlsForBounds(bounds) {
  const urls = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const xMin = lonToTileX(bounds.west, z);
    const xMax = lonToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const s = SUBDOMAINS[(x + y) % SUBDOMAINS.length];
        urls.push(TILE_URL_TEMPLATE.replace('{s}', s).replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return urls;
}

async function fetchWithConcurrency(urls, limit, onProgress) {
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        await fetch(url);
      } catch (err) {
        // se reintentará en la próxima descarga; no debe frenar al resto
      }
      done++;
      if (onProgress) onProgress(done, urls.length);
    }
  }
  const workers = Array.from({ length: Math.min(limit, urls.length) }, worker);
  await Promise.all(workers);
}

// clients: [{lat, lng, ...}]; onProgress(done, total) opcional
export async function downloadRouteForOffline(routeName, clients, onProgress) {
  if (clients.length >= 2) {
    await getRouteGeometry(routeName, clients);
  }
  if (clients.length === 0) return;

  const urls = tileUrlsForBounds(boundsFromClients(clients));
  await fetchWithConcurrency(urls, CONCURRENCY, onProgress);
}
