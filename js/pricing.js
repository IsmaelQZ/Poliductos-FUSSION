// Lista de precios por cliente: un Google Sheet publicado como CSV con
// columnas ID_Cliente | Producto | Precio (una fila por producto). Se
// referencia vía data/config.json (`pricingCsvUrl`). Mientras no esté
// configurado, loadPricing()/syncPricing() devuelven {} sin error — la
// ficha de info del cliente muestra un estado vacío en vez de romperse.
import { idbGet, idbSet } from './db.js';
import { csvToObjects } from './csv.js';
import { field } from './sheet.js';

const PRICING_KEY = 'pricing';
const CONFIG_URL = 'data/config.json';

export async function loadPricing() {
  const cached = await idbGet(PRICING_KEY);
  if (cached) return cached;
  return syncPricing();
}

export async function syncPricing() {
  try {
    const config = await fetch(CONFIG_URL).then(r => r.json());
    if (!config.pricingCsvUrl) return (await idbGet(PRICING_KEY)) || {};

    const res = await fetch(config.pricingCsvUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`No se pudo leer la hoja de precios (${res.status})`);

    const pricing = rowsToPricing(csvToObjects(await res.text()));
    await idbSet(PRICING_KEY, pricing);
    return pricing;
  } catch (err) {
    console.warn('No se pudo sincronizar precios, se usa lo último guardado:', err);
    return (await idbGet(PRICING_KEY)) || {};
  }
}

function rowsToPricing(rows) {
  const pricing = {};
  rows.forEach(row => {
    const id = field(row, 'ID_Cliente').trim();
    const producto = field(row, 'Producto').trim();
    const precio = field(row, 'Precio').trim();
    if (!id || !producto) return;
    if (!pricing[id]) pricing[id] = [];
    pricing[id].push({ producto, precio });
  });
  return pricing;
}
