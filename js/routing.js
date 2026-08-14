// Cálculo del trazo real por calles. Hoy usa el servidor demo público de
// OSRM (igual que el prototipo). Pendiente evaluar para producción un motor
// propio/autohospedado (ver resumen del proyecto) — el resto de la app solo
// depende de getRouteGeometry(), así que el motor se puede cambiar aquí.
import { idbGet, idbSet } from './db.js';

function geometryKey(routeName) {
  return `geometry:${routeName}`;
}

// clients: [{lat, lng}, ...] en el orden de visita
export async function getRouteGeometry(routeName, clients) {
  const cached = await idbGet(geometryKey(routeName));
  if (cached) return cached;

  const coordStr = clients.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('OSRM: ' + data.code);

  const geo = data.routes[0];
  await idbSet(geometryKey(routeName), geo);
  return geo;
}
