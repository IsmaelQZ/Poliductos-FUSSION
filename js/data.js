// Fuente de datos de las rutas: un Google Sheet con una hoja "índice"
// (Ruta | URL_CSV) que apunta a una hoja publicada por ruta — ver
// js/sheet.js para el detalle del formato. Todo se lee vía
// data/config.json. Si no está configurado o falla el fetch (sin internet,
// URL vacía todavía), se usa data/routes.json como respaldo para que la
// app nunca se quede sin datos.
import { idbGet, idbSet } from './db.js';
import { csvToObjects } from './csv.js';
import { parseIndexRows, rowsToClients } from './sheet.js';

const ROUTES_KEY = 'routes';
const LAST_SYNC_KEY = 'lastSync';
const CONFIG_URL = 'data/config.json';
const SEED_URL = 'data/routes.json';

// Rutas que aparecen en el selector pero todavía no tienen coordenadas.
export const PENDING_ROUTES = [];

export async function loadRoutes() {
  const cached = await idbGet(ROUTES_KEY);
  if (cached) return cached;
  return syncRoutes();
}

export async function getLastSync() {
  return idbGet(LAST_SYNC_KEY);
}

// Fuerza una sincronización por red. Devuelve las rutas obtenidas (del
// Sheet si se pudo, o del respaldo semilla/caché si no).
export async function syncRoutes() {
  try {
    const routes = await fetchFromSheet();
    if (routes) {
      await idbSet(ROUTES_KEY, routes);
      await idbSet(LAST_SYNC_KEY, Date.now());
      return routes;
    }
  } catch (err) {
    console.warn('No se pudo sincronizar con Google Sheets, se usan datos de respaldo:', err);
  }

  const cached = await idbGet(ROUTES_KEY);
  if (cached) return cached; // hubo un sync previo exitoso; no lo pisamos con el seed

  const res = await fetch(SEED_URL);
  const routes = await res.json();
  await idbSet(ROUTES_KEY, routes);
  return routes;
}

async function fetchCsvRows(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return csvToObjects(await res.text());
}

async function fetchFromSheet() {
  const config = await fetch(CONFIG_URL).then(r => r.json());
  if (!config.routesIndexCsvUrl) return null;

  const indexRows = parseIndexRows(await fetchCsvRows(config.routesIndexCsvUrl));
  if (indexRows.length === 0) throw new Error('La hoja índice no tiene rutas válidas (Ruta | URL_CSV)');

  const routes = {};
  const results = await Promise.allSettled(
    indexRows.map(async ({ ruta, csvUrl }) => {
      const clients = rowsToClients(await fetchCsvRows(csvUrl));
      return { ruta, clients };
    })
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      routes[result.value.ruta] = result.value.clients;
    } else {
      console.warn(`No se pudo leer la hoja de "${indexRows[i].ruta}":`, result.reason);
    }
  });

  if (Object.keys(routes).length === 0) throw new Error('No se pudo leer ninguna hoja de ruta');
  return routes;
}
