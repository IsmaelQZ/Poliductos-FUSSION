import { loadRoutes, syncRoutes, getLastSync, PENDING_ROUTES } from './data.js';
import { loadPricing, syncPricing } from './pricing.js';
import { renderMarkersAndList, drawRealRoute, enableLiveLocation, addClientsButton } from './map.js';
import { downloadRouteForOffline } from './offline.js';

function populateSelect(select, routes) {
  const previous = select.value;
  select.innerHTML = '';
  Object.keys(routes).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${routes[name].length})`;
    select.appendChild(opt);
  });
  PENDING_ROUTES.forEach(name => {
    const opt = document.createElement('option');
    opt.value = '__pending__' + name;
    opt.textContent = `${name} (pendiente coordenadas)`;
    opt.disabled = true;
    select.appendChild(opt);
  });
  if (routes[previous]) select.value = previous;
}

function fmtSyncTime(ts) {
  if (!ts) return 'nunca';
  const d = new Date(ts);
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function openSheet(el) { el.classList.add('open'); }
function closeSheet(el) { el.classList.remove('open'); }

function setupSheet(el) {
  el.querySelectorAll('[data-close]').forEach(trigger => {
    trigger.addEventListener('click', () => closeSheet(el));
  });
}

function renderClientInfo(client, pricing) {
  document.getElementById('infoName').textContent = client.nombre;

  const phoneEl = document.getElementById('infoPhone');
  phoneEl.innerHTML = client.telefono
    ? `<a href="tel:${client.telefono}">📞 ${client.telefono}</a>`
    : '<span class="no-phone">Sin teléfono registrado</span>';

  const pricingEl = document.getElementById('infoPricing');
  const items = pricing[client.id];
  if (!items || items.length === 0) {
    pricingEl.innerHTML = '<div class="empty-state">Aún no hay lista de precios configurada para este cliente.</div>';
    return;
  }
  const rows = items.map(p => `<tr><td>${p.producto}</td><td>${p.precio}</td></tr>`).join('');
  pricingEl.innerHTML = `
    <table class="price-table">
      <thead><tr><th>Producto</th><th>Precio</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function main() {
  const select = document.getElementById('routeSelect');
  const downloadBtn = document.getElementById('downloadBtn');
  const syncBtn = document.getElementById('syncBtn');
  const syncStatus = document.getElementById('syncStatus');
  const clientsSheet = document.getElementById('clientsSheet');
  const infoSheet = document.getElementById('infoSheet');
  setupSheet(clientsSheet);
  setupSheet(infoSheet);

  let [routes, pricing] = await Promise.all([loadRoutes(), loadPricing()]);
  populateSelect(select, routes);
  syncStatus.textContent = `Datos actualizados: ${fmtSyncTime(await getLastSync())}`;

  let currentRouteName = null;

  function loadRoute(routeName) {
    currentRouteName = routeName;
    const clients = routes[routeName];
    renderMarkersAndList(routeName, clients, {
      onLocate: () => closeSheet(clientsSheet),
      onInfo: client => {
        renderClientInfo(client, pricing);
        openSheet(infoSheet);
      },
    });
    drawRealRoute(routeName, clients);
  }

  select.addEventListener('change', () => {
    if (select.value.startsWith('__pending__')) return;
    loadRoute(select.value);
  });

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    const originalLabel = syncBtn.textContent;
    syncBtn.textContent = 'Actualizando…';
    try {
      [routes, pricing] = await Promise.all([syncRoutes(), syncPricing()]);
      populateSelect(select, routes);
      syncStatus.textContent = `Datos actualizados: ${fmtSyncTime(await getLastSync())}`;
      if (!routes[currentRouteName]) currentRouteName = null;
      loadRoute(currentRouteName || Object.keys(routes)[0]);
      syncBtn.textContent = '✓ Datos al día';
    } catch (err) {
      syncBtn.textContent = 'No se pudo actualizar';
    } finally {
      setTimeout(() => {
        syncBtn.textContent = originalLabel;
        syncBtn.disabled = false;
      }, 3000);
    }
  });

  downloadBtn.addEventListener('click', async () => {
    if (!currentRouteName) return;
    downloadBtn.disabled = true;
    const originalLabel = downloadBtn.textContent;
    downloadBtn.textContent = 'Descargando mapa… 0%';
    try {
      await downloadRouteForOffline(currentRouteName, routes[currentRouteName], (done, total) => {
        downloadBtn.textContent = `Descargando mapa… ${Math.round((done / total) * 100)}%`;
      });
      downloadBtn.textContent = '✓ Lista para uso sin conexión';
    } catch (err) {
      downloadBtn.textContent = 'No se pudo descargar, reintenta con internet';
    } finally {
      setTimeout(() => {
        downloadBtn.textContent = originalLabel;
        downloadBtn.disabled = false;
      }, 3000);
    }
  });

  loadRoute(Object.keys(routes)[0]);
  enableLiveLocation();
  addClientsButton(() => openSheet(clientsSheet));
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.error('No se pudo registrar el service worker', err);
    });
  });
}
