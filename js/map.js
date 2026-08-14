import { getRouteGeometry } from './routing.js';

const map = L.map('map').setView([20.3, -99.35], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let routeLine = null;

function numIcon(n) {
  return L.divIcon({ className: '', html: `<div class="marker-num">${n}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
}

function fmtCoord(c) {
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

export function renderMarkersAndList(routeName, clients) {
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
      <button class="nav-btn" data-lat="${s.lat}" data-lng="${s.lng}">Ir →</button>`;
    listEl.appendChild(row);
  });

  listEl.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${btn.dataset.lat},${btn.dataset.lng}`, '_blank');
    });
  });
}

function drawStraightFallback(clients) {
  const latlngs = clients.map(c => [c.lat, c.lng]);
  routeLine = L.polyline(latlngs, { color: '#B4552F', weight: 3, dashArray: '6,6', opacity: 0.85 }).addTo(map);
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
    routeLine = L.polyline(coords, { color: '#E8963C', weight: 4, opacity: 0.9 }).addTo(map);
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
