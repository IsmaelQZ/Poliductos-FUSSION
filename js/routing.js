// Cálculo del trazo real por calles. Hoy usa el servidor demo público de
// OSRM (igual que el prototipo). Pendiente evaluar para producción un motor
// propio/autohospedado (ver resumen del proyecto) — el resto de la app solo
// depende de getRouteGeometry(), así que el motor se puede cambiar aquí.
import { idbGet, idbSet } from './db.js';

// La clave incluye el orden y la identidad de los clientes (no solo el
// nombre de la ruta): si se agrega/quita un cliente o se cambia el orden
// de visita, la huella cambia y se vuelve a calcular en vez de servir un
// trazo viejo desde la caché.
function geometryKey(routeName, clients) {
  const fingerprint = clients.map(c => c.id || `${c.lat},${c.lng}`).join('|');
  return `geometry:${routeName}:${fingerprint}`;
}

// clients: [{lat, lng}, ...] en el orden de visita. force:true se salta la
// caché aunque la huella coincida (se usa al tocar "Actualizar datos", para
// no depender solo de que la huella detecte el cambio correctamente).
export async function getRouteGeometry(routeName, clients, { force = false } = {}) {
  const key = geometryKey(routeName, clients);
  if (!force) {
    const cached = await idbGet(key);
    if (cached) return cached;
  }

  const coordStr = clients.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error('OSRM: ' + data.code);

  const geo = data.routes[0];
  await idbSet(key, geo);
  return geo;
}
