// Lista de precios por cliente: mismo esquema de dos niveles que las rutas
// (una hoja índice `Ruta | URL_CSV` que apunta a una hoja por ruta — ver
// js/sheet.js), pero cada hoja de precios es una tabla "ancha": primera
// columna `Cliente` (el nombre, tal cual aparece en la hoja de ubicaciones)
// y una columna por producto, con el precio en la celda o vacía si a ese
// cliente no se le vende ese producto.
//
// El cruce con los datos de ruta es por NOMBRE de cliente (normalizado:
// sin espacios sobrantes, sin distinguir mayúsculas/minúsculas), no por
// ID_Cliente — esta hoja no trae ID.
import { idbGet, idbSet } from './db.js';
import { csvToObjects } from './csv.js';
import { parseIndexRows, field } from './sheet.js';

const PRICING_KEY = 'pricing';
const CONFIG_URL = 'data/config.json';

export function normalizeClientName(name) {
  return (name || '').trim().toLowerCase();
}

export async function loadPricing() {
  const cached = await idbGet(PRICING_KEY);
  if (cached) return cached;
  return syncPricing();
}

export async function syncPricing() {
  try {
    const config = await fetch(CONFIG_URL).then(r => r.json());
    if (!config.pricingIndexCsvUrl) return (await idbGet(PRICING_KEY)) || {};

    const indexRows = parseIndexRows(await fetchCsvRows(config.pricingIndexCsvUrl));
    const results = await Promise.allSettled(indexRows.map(({ csvUrl }) => fetchCsvRows(csvUrl)));

    const pricing = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        Object.assign(pricing, rowsToPricing(result.value));
      } else {
        console.warn(`No se pudo leer la hoja de precios de "${indexRows[i].ruta}":`, result.reason);
      }
    });

    await idbSet(PRICING_KEY, pricing);
    return pricing;
  } catch (err) {
    console.warn('No se pudo sincronizar precios, se usa lo último guardado:', err);
    return (await idbGet(PRICING_KEY)) || {};
  }
}

async function fetchCsvRows(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return csvToObjects(await res.text());
}

function rowsToPricing(rows) {
  const pricing = {};
  rows.forEach(row => {
    const nombre = field(row, 'Cliente').trim();
    if (!nombre) return;

    const items = Object.keys(row)
      .filter(key => key.trim().toLowerCase() !== 'cliente')
      .map(key => ({ producto: key.trim(), precio: (row[key] || '').trim() }))
      .filter(item => item.precio !== '');

    if (items.length > 0) pricing[normalizeClientName(nombre)] = items;
  });
  return pricing;
}
