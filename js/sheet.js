// Traduce las hojas del Google Sheet a la forma { nombreRuta: [cliente, ...] }
// que usa el resto de la app. El libro tiene dos tipos de hoja:
//
// 1. Una hoja "índice" con columnas `Ruta | URL_CSV`: una fila por cada
//    ruta, con el link de esa hoja ya publicada como CSV.
// 2. Una hoja por ruta, con columnas: ID_Cliente | Nombre_Cliente |
//    Orden_Visita | Latitud | Longitud | Direccion | Telefono | Notas |
//    Activo (SI/NO) — un cliente por fila.
//
// Agregar una ruta nueva es: duplicar una hoja de ruta, llenarla, publicarla
// (Archivo > Compartir > Publicar en la web > esa hoja > CSV) y agregar su
// fila en la hoja índice. Nada de esto toca el código de la app.
const COORD_PAIR_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

// Lectura de columnas insensible a mayúsculas/minúsculas: cada quien
// termina escribiendo los encabezados un poco distinto entre hojas.
function field(row, name) {
  const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? row[key] : '';
}

export function parseIndexRows(rows) {
  return rows
    .map(row => ({
      ruta: field(row, 'Ruta').trim(),
      csvUrl: field(row, 'URL_CSV').trim(),
    }))
    .filter(r => r.ruta && r.csvUrl);
}

// A veces, al copiar coordenadas desde Google Maps, el par "lat, lng" queda
// pegado en una sola celda (columna Latitud) y Longitud queda vacía.
function parseCoords(row) {
  let lat = field(row, 'Latitud');
  let lng = field(row, 'Longitud');
  if (!lng.trim() && COORD_PAIR_RE.test(lat)) {
    const m = lat.match(COORD_PAIR_RE);
    lat = m[1];
    lng = m[2];
  }
  return { lat: parseFloat(lat), lng: parseFloat(lng) };
}

export function rowsToClients(rows) {
  const clients = rows
    .filter(row => (field(row, 'Activo') || 'SI').trim().toUpperCase() !== 'NO')
    .map(row => {
      const nombre = field(row, 'Nombre_Cliente').trim();
      const { lat, lng } = parseCoords(row);
      const orden = field(row, 'Orden_Visita');
      return {
        id: field(row, 'ID_Cliente').trim(),
        nombre,
        lat,
        lng,
        direccion: field(row, 'Direccion').trim(),
        telefono: field(row, 'Telefono').trim(),
        notas: field(row, 'Notas').trim(),
        _orden: orden !== '' ? Number(orden) : Infinity,
      };
    })
    .filter(c => c.nombre && Number.isFinite(c.lat) && Number.isFinite(c.lng));

  clients.sort((a, b) => a._orden - b._orden);
  clients.forEach(c => delete c._orden);
  return clients;
}
