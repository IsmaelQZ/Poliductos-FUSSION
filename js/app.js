import { loadRoutes, syncRoutes, getLastSync, PENDING_ROUTES } from './data.js';
import { loadPricing, syncPricing, normalizeClientName } from './pricing.js';
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

// Aviso corto tipo "toast": confirma acciones sin cambiar el texto de los botones de la tarjeta.
// sticky:true lo deja visible (p. ej. progreso de descarga) hasta el siguiente aviso.
let toastTimer = null;
function showToast(message, { sticky = false } = {}) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// Los controles de Leaflet de arriba (zoom, brújula) deben quedar debajo de la tarjeta flotante;
// su altura cambia (el chip de estado puede ocupar una o dos líneas), así que se mide.
function trackHudHeight() {
  const hud = document.querySelector('.hud');
  const apply = () => document.documentElement.style.setProperty('--hud-h', Math.ceil(hud.getBoundingClientRect().height) + 'px');
  apply();
  if ('ResizeObserver' in window) new ResizeObserver(apply).observe(hud);
  else window.addEventListener('resize', apply);
}

function openSheet(el) { el.classList.add('open'); }
function closeSheet(el) {
  el.classList.remove('open', 'searching');
  // Si la hoja tiene buscador, que empiece limpio la próxima vez que se abra.
  const search = el.querySelector('.client-search');
  if (search) {
    search.blur();
    if (search.value) {
      search.value = '';
      search.dispatchEvent(new Event('input'));
    }
  }
}

function setupSheet(el) {
  el.querySelectorAll('[data-close]').forEach(trigger => {
    trigger.addEventListener('click', () => closeSheet(el));
  });
}

function normalizeSearchText(s) {
  // Quita acentos (NFD separa la letra de su diacrítico, luego se descarta
  // el diacrítico) para que buscar "ferreteria" encuentre "Ferretería".
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function setupClientSearch() {
  const input = document.getElementById('clientSearch');
  const list = document.getElementById('stopsList');
  const sheet = document.getElementById('clientsSheet');

  // Al buscar, el teclado del celular tapa la parte de abajo de la pantalla y la hoja
  // (anclada abajo) quedaba escondida detrás. Mientras se escribe, la hoja se pega ARRIBA
  // del área visible (visualViewport = pantalla menos teclado) y los resultados quedan arriba.
  const vv = window.visualViewport;
  const syncViewport = () => {
    if (!vv) return;
    sheet.style.setProperty('--vv-top', vv.offsetTop + 'px');
    sheet.style.setProperty('--vv-h', vv.height + 'px');
  };
  if (vv) { vv.addEventListener('resize', syncViewport); vv.addEventListener('scroll', syncViewport); }
  input.addEventListener('focus', () => { syncViewport(); sheet.classList.add('searching'); });
  input.addEventListener('blur', () => { if (!input.value.trim()) sheet.classList.remove('searching'); });

  input.addEventListener('input', () => {
    list.scrollTop = 0; // los que coinciden se ven desde arriba
    const q = normalizeSearchText(input.value.trim());
    const rows = list.querySelectorAll('.stop');
    let anyVisible = false;
    rows.forEach(row => {
      const name = row.querySelector('.stop-name')?.textContent || '';
      const match = !q || normalizeSearchText(name).includes(q);
      row.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });

    let noResults = list.querySelector('.no-results');
    if (rows.length > 0 && !anyVisible) {
      if (!noResults) {
        noResults = document.createElement('div');
        noResults.className = 'empty-state no-results';
        noResults.textContent = 'No se encontró ningún cliente con ese nombre.';
        list.appendChild(noResults);
      }
    } else if (noResults) {
      noResults.remove();
    }
  });
}

function renderClientInfo(client, pricing) {
  document.getElementById('infoName').textContent = client.nombre;

  const phoneEl = document.getElementById('infoPhone');
  phoneEl.innerHTML = client.telefono
    ? `<a href="tel:${client.telefono}">📞 ${client.telefono}</a>`
    : '<span class="no-phone">Sin teléfono registrado</span>';

  const pricingEl = document.getElementById('infoPricing');
  const items = pricing[normalizeClientName(client.nombre)];
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
  setupClientSearch();
  trackHudHeight();

  let [routes, pricing] = await Promise.all([loadRoutes(), loadPricing()]);
  populateSelect(select, routes);
  syncStatus.textContent = `Actualizado: ${fmtSyncTime(await getLastSync())}`;

  let currentRouteName = null;

  function loadRoute(routeName, { force = false } = {}) {
    currentRouteName = routeName;
    const clients = routes[routeName];
    renderMarkersAndList(routeName, clients, {
      onLocate: () => closeSheet(clientsSheet),
      onInfo: client => {
        renderClientInfo(client, pricing);
        openSheet(infoSheet);
      },
    });
    drawRealRoute(routeName, clients, { force });
  }

  select.addEventListener('change', () => {
    if (select.value.startsWith('__pending__')) return;
    loadRoute(select.value);
  });

  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.classList.add('busy');
    showToast('Actualizando datos…', { sticky: true });
    try {
      [routes, pricing] = await Promise.all([syncRoutes(), syncPricing()]);
      populateSelect(select, routes);
      syncStatus.textContent = `Actualizado: ${fmtSyncTime(await getLastSync())}`;
      if (!routes[currentRouteName]) currentRouteName = null;
      loadRoute(currentRouteName || Object.keys(routes)[0], { force: true });
      showToast('✓ Datos al día');
    } catch (err) {
      showToast('No se pudo actualizar. Revisa tu conexión.');
    } finally {
      syncBtn.disabled = false;
      syncBtn.classList.remove('busy');
    }
  });

  downloadBtn.addEventListener('click', async () => {
    if (!currentRouteName) return;
    downloadBtn.disabled = true;
    downloadBtn.classList.add('busy');
    showToast('Descargando mapa… 0%', { sticky: true });
    try {
      await downloadRouteForOffline(currentRouteName, routes[currentRouteName], (done, total) => {
        showToast(`Descargando mapa… ${Math.round((done / total) * 100)}%`, { sticky: true });
      });
      showToast('✓ Ruta lista para usar sin conexión');
    } catch (err) {
      showToast('No se pudo descargar. Reintenta con internet.');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.classList.remove('busy');
    }
  });

  loadRoute(Object.keys(routes)[0]);
  enableLiveLocation();
  addClientsButton(() => openSheet(clientsSheet));
}

// Quita la pantalla de carga con el logo, pero no antes de MIN_SPLASH_MS desde
// que abrió la página, para que la animación de aparición alcance a verse.
const MIN_SPLASH_MS = 2200;
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const wait = Math.max(0, MIN_SPLASH_MS - performance.now());
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 600);
  }, wait);
}

main().catch(err => console.error('Error al iniciar la app', err)).finally(hideSplash);

if ('serviceWorker' in navigator) {
  // Actualización automática: si ya había un service worker controlando la página
  // y aparece uno nuevo (controllerchange), se recarga una sola vez para mostrar la
  // versión nueva sin tener que cerrar y abrir la app varias veces. En la primera
  // instalación (sin controlador previo) no se recarga.
  const hadController = !!navigator.serviceWorker.controller;
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadedForUpdate) return;
    reloadedForUpdate = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      // Una PWA instalada suele reanudarse desde segundo plano sin recargar la página:
      // al volver a primer plano se busca si hay versión nueva.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(err => {
      console.error('No se pudo registrar el service worker', err);
    });
  });
}
