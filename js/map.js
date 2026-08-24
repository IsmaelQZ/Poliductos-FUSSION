import { getRouteGeometry } from './routing.js';

const map = L.map('map').setView([20.3, -99.35], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let routeLine = null;

// Leaflet mide el contenedor una sola vez al iniciar. En una PWA instalada
// en iOS el layout final (zonas seguras, barra de estado) a veces no está
// asentado todavía en ese momento, y el mapa se queda con un tamaño viejo
// aunque el contenedor sí mida bien — hay que forzar que se recalcule.
function refreshMapSize() { map.invalidateSize(); }
window.addEventListener('load', refreshMapSize);
window.addEventListener('resize', refreshMapSize);
window.addEventListener('orientationchange', () => setTimeout(refreshMapSize, 250));
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshMapSize(); });
setTimeout(refreshMapSize, 300);

// Ubicación en vivo del vendedor. Usa el GPS del dispositivo (navigator.geolocation),
// que no depende de internet, así que también funciona en modo offline.
let userMarker = null;
let userAccuracyCircle = null;

function ensureUserLayers() {
  if (!userMarker) {
    userAccuracyCircle = L.circle([0, 0], {
      radius: 0, color: '#3B82F6', weight: 1, fillColor: '#3B82F6', fillOpacity: 0.12,
    });
    userMarker = L.circleMarker([0, 0], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#3B82F6', fillOpacity: 1,
    });
  }
}

export function enableLiveLocation() {
  const locateBtn = L.control({ position: 'bottomright' });
  locateBtn.onAdd = () => {
    const el = L.DomUtil.create('button', 'locate-btn');
    el.type = 'button';
    el.title = 'Centrar en mi ubicación';
    el.textContent = '📍';
    L.DomEvent.disableClickPropagation(el);
    el.addEventListener('click', () => {
      if (userMarker) {
        map.setView(userMarker.getLatLng(), Math.max(map.getZoom(), 15));
        return;
      }
      el.classList.add('locate-btn-pending');
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude, accuracy } = pos.coords;
          ensureUserLayers();
          userAccuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy).addTo(map);
          userMarker.setLatLng([latitude, longitude]).addTo(map);
          map.setView([latitude, longitude], 15);
          el.classList.remove('locate-btn-pending');
        },
        err => {
          console.warn('No se pudo obtener la ubicación:', err.message);
          el.classList.remove('locate-btn-pending');
        },
        { enableHighAccuracy: true, timeout: 20000 }
      );
    });
    return el;
  };
  locateBtn.addTo(map);

  if (!('geolocation' in navigator)) return;

  navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, accuracy } = pos.coords;
      ensureUserLayers();
      userAccuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy).addTo(map);
      userMarker.setLatLng([latitude, longitude]).addTo(map);
    },
    err => {
      console.warn('No se pudo obtener la ubicación:', err.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
}

const CONTACTS_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <circle cx="9" cy="8" r="3.3"/>
  <path d="M2.5 19c0-3.3 2.9-5.7 6.5-5.7s6.5 2.4 6.5 5.7v.6H2.5V19z"/>
  <circle cx="17" cy="7.5" r="2.6" opacity=".55"/>
  <path d="M14.8 12.6c.9-.5 2-.8 3.2-.8 3.1 0 5.5 2 5.5 4.7v.5h-7.2c0-1.7-.6-3.2-1.5-4.4z" opacity=".55"/>
</svg>`;

// Botón flotante para abrir la lista de clientes de la ruta (junto al de
// ubicación). onOpen la controla app.js — este módulo solo dibuja el botón.
export function addClientsButton(onOpen) {
  const btn = L.control({ position: 'bottomright' });
  btn.onAdd = () => {
    const el = L.DomUtil.create('button', 'clients-btn');
    el.type = 'button';
    el.title = 'Ver clientes de la ruta';
    el.innerHTML = CONTACTS_ICON;
    L.DomEvent.disableClickPropagation(el);
    el.addEventListener('click', onOpen);
    return el;
  };
  btn.addTo(map);
}

function numIcon(n) {
  return L.divIcon({ className: '', html: `<div class="marker-num">${n}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
}

function fmtCoord(c) {
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

// onLocate(client) y onInfo(client) son callbacks de app.js: onLocate se
// dispara al tocar el nombre de un cliente (después de centrar el mapa
// aquí mismo), onInfo al tocar "Info" (la ficha la arma app.js).
export function renderMarkersAndList(routeName, clients, { onLocate, onInfo } = {}) {
  markersLayer.clearLayers();
  const listEl = document.getElementById('stopsList');
  document.getElementById('panelHead').textContent = `Orden de visita — ${routeName} (${clients.length} clientes)`;
  listEl.innerHTML = '';

  if (clients.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Esta ruta aún no tiene clientes con coordenadas completas.</div>';
    return;
  }

  clients.forEach((s, i) => {
    const n = i + 1;
    L.marker([s.lat, s.lng], { icon: numIcon(n) }).addTo(markersLayer)
      .bindPopup(`<b>${n}. ${s.nombre}</b><br>${fmtCoord(s)}`);
    const row = document.createElement('div');
    row.className = 'stop';
    row.innerHTML = `
      <div class="badge">${n}</div>
      <div class="stop-info">
        <div class="stop-name">${s.nombre}</div>
        <div class="stop-addr">${fmtCoord(s)}</div>
      </div>
      <div class="stop-actions">
        <button class="info-btn">Info</button>
        <button class="nav-btn" data-lat="${s.lat}" data-lng="${s.lng}">Ir →</button>
      </div>`;

    row.addEventListener('click', () => {
      map.setView([s.lat, s.lng], 17);
      onLocate?.(s);
    });
    row.querySelector('.info-btn').addEventListener('click', e => {
      e.stopPropagation();
      onInfo?.(s);
    });
    row.querySelector('.nav-btn').addEventListener('click', e => {
      e.stopPropagation();
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, '_blank');
    });

    listEl.appendChild(row);
  });
}

function drawStraightFallback(clients) {
  const latlngs = clients.map(c => [c.lat, c.lng]);
  routeLine = L.polyline(latlngs, { color: '#C23B2A', weight: 3, dashArray: '6,6', opacity: 0.85 }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
}

export async function drawRealRoute(routeName, clients) {
  const banner = document.getElementById('statusBanner');
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (clients.length < 2) return;

  banner.className = 'status-banner loading';
  banner.innerHTML = '<span class="dot"></span> Calculando ruta por calles…';

  try {
    const geo = await getRouteGeometry(routeName, clients);
    const coords = geo.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    routeLine = L.polyline(coords, { color: '#F4700D', weight: 4, opacity: 0.9 }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });

    const km = (geo.distance / 1000).toFixed(1);
    const hrs = Math.floor(geo.duration / 3600);
    const mins = Math.round((geo.duration % 3600) / 60);
    banner.className = 'status-banner ok';
    banner.innerHTML = `<span class="dot"></span> Ruta real por calles — ${km} km, ~${hrs}h ${mins}min de manejo.`;
  } catch (err) {
    drawStraightFallback(clients);
    banner.className = 'status-banner warn';
    banner.innerHTML = '<span class="dot" style="background:var(--warn)"></span> No se pudo calcular la ruta por calles ahora, mostrando líneas rectas como referencia.';
  }
}
