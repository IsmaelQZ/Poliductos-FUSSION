import { loadRoutes, syncRoutes, getLastSync, PENDING_ROUTES } from './data.js';
import { renderMarkersAndList, drawRealRoute, enableLiveLocation } from './map.js';
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

async function main() {
  const select = document.getElementById('routeSelect');
  const downloadBtn = document.getElementById('downloadBtn');
  const syncBtn = document.getElementById('syncBtn');
  const syncStatus = document.getElementById('syncStatus');

  let routes = await loadRoutes();
  populateSelect(select, routes);
  syncStatus.textContent = `Datos actualizados: ${fmtSyncTime(await getLastSync())}`;

  let currentRouteName = null;

  function loadRoute(routeName) {
    currentRouteName = routeName;
    const clients = routes[routeName];
    renderMarkersAndList(routeName, clients);
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
      routes = await syncRoutes();
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
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.error('No se pudo registrar el service worker', err);
    });
  });
}
