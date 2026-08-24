# Progreso — App de Rutas Comerciales (PWA)

Referencia: [resumen_proyecto_app_rutas.md](../PRIMERA%20PRUEBA%20APP%20EN%20CLAUDE%20CODE/resumen_proyecto_app_rutas.md) y `prototipo_rutas_v3.html` (carpeta "PRIMERA PRUEBA APP EN CLAUDE CODE").

## Estado: publicada, instalada y funcionando offline en un celular real

- **Repo**: https://github.com/IsmaelQZ/Poliductos-FUSSION — **Live**: https://ismaelqz.github.io/Poliductos-FUSSION/
- Estructura del proyecto (vanilla JS + módulos ES, sin build tool — no hay Node.js instalado en esta máquina).
- Cacheo offline: service worker (`sw.js`) precachea el app shell + Leaflet (vendorizado en `vendor/leaflet/`) y cachea tiles de OpenStreetMap en tiempo de ejecución. Botón "Descargar ruta sin conexión" precarga tiles (z11–z15) + geometría real de la ruta activa. **Confirmado por el usuario: instalada en celular real, funciona offline.**
- Sincronización de datos: conectada al Google Sheet real del usuario. Esquema de dos niveles:
  - Hoja índice (`Ruta | URL_CSV`) — URL ya configurada en `data/config.json` (`routesIndexCsvUrl`).
  - Una hoja por ruta (`ID_Cliente | Nombre_Cliente | Orden_Visita | Latitud | Longitud | Direccion | Telefono | Notas | Activo`).
  - Botón "Actualizar datos" fuerza re-sync; se guarda `lastSync` y se muestra en la UI.
  - Si una hoja de ruta falla, las demás igual sincronizan (no se cae todo).
  - Respaldo a `data/routes.json` (datos semilla) si no hay Sheet configurado o falla la red.
- Íconos de marca: `icons/icon-192.png` / `icon-512.png` a partir de la imagen del usuario (camión + pin de ruta + logo "F"). Fuente original en `icons/brand-icon-source.webp`.
- Ubicación en vivo: botón 📍 (bottomright) usa `navigator.geolocation.watchPosition` (GPS del dispositivo, funciona offline) para mostrar un punto azul + círculo de precisión; el botón centra el mapa en la posición actual. Código en `enableLiveLocation()` / `js/map.js`.
- **Panel de clientes rediseñado** (recién agregado, pendiente de que el usuario confirme en su celular):
  - El mapa ahora ocupa toda la pantalla; la lista de clientes ya no está siempre visible.
  - Botón 👥 "Ver clientes de la ruta" (bottomright, junto al de ubicación) abre una hoja deslizable (`#clientsSheet`) con la lista.
  - Tocar el nombre de un cliente centra el mapa en su marcador (zoom 17) y cierra la hoja.
  - Cada cliente tiene botones **Info** (nuevo) y **Ir →** (existente, abre Google Maps).
  - **Info** abre otra hoja (`#infoSheet`) con teléfono (enlace `tel:` para llamar directo) y una tabla de productos/precios.
  - La tabla de precios viene de un Sheet **aparte**, aún no configurado: `data/config.json` tiene `pricingCsvUrl` en `""`. Mientras esté vacío, la ficha de info muestra "Aún no hay lista de precios configurada" en vez de fallar. Columnas esperadas cuando el usuario comparta el link: `ID_Cliente | Producto | Precio` (una fila por producto; un mismo `ID_Cliente` puede repetirse en varias filas). Ver `js/pricing.js`.

## Decisiones tomadas

- Sin framework ni bundler (coherente con no tener Node.js instalado; app se sirve como archivos estáticos).
- Sincronización vía Google Sheets publicado como CSV (no API de Google, no import manual).
- Estructura de Sheet: una hoja por ruta + hoja índice, para que agregar una ruta nueva no requiera tocar código (solo Google Sheets). Mismo patrón pensado para precios: un Sheet aparte, no mezclado con los datos de ruta.
- Hosting: GitHub Pages (repo público, rama `main`, carpeta raíz). Todas las rutas del proyecto son relativas para que funcione bien bajo el subpath `/Poliductos-FUSSION/`.

## Cómo correr localmente

Un service worker y `fetch()` a `data/*.json` no funcionan con `file://`, hace falta un server local (usar un puerto libre — a veces hay otro proceso ya escuchando en 8080 en esta máquina que no se puede cerrar, revisar con `netstat -ano | grep LISTENING` si el service worker no registra):

```bash
python -m http.server 8099
```

Luego abrir `http://localhost:8099/`.

**Nota del sandbox de pruebas de Claude Code**: el navegador de vista previa de este entorno tiene una limitación conocida donde el registro del service worker falla siempre con "unknown error fetching the script" — se confirmó que no es un bug de la app (hasta un service worker mínimo de una línea falla igual ahí). No bloquea nada: la app real (GitHub Pages, instalada en el celular) sí registra el SW correctamente.

## Pendiente

1. **Confirmar con el usuario** que el nuevo panel de clientes / botón Info se ve y funciona bien en su celular real (recién subido, no probado fuera del sandbox todavía).
2. **Pricing Sheet**: el usuario va a compartir el link de un Google Sheet (mismo mecanismo de "publicar como CSV") con columnas `ID_Cliente | Producto | Precio`. Cuando lo dé, solo hay que pegarlo en `data/config.json` → `pricingCsvUrl` y bumpear `SHELL_CACHE`.
3. **Orden óptimo automático** (TSP) en vez de manual por `Orden_Visita` — mencionado como posible siguiente paso en el resumen original.
4. Mostrar `Direccion` / `Notas` en la ficha de info del cliente (ya vienen en los datos del Sheet, no se muestran todavía — se agregó teléfono pero no dirección/notas).

## Notas técnicas

- Cada vez que se edite un archivo del app shell (`css/`, `js/`, `data/config.json`, `index.html`, `icons/`), hay que subir `SHELL_CACHE` en `sw.js` (va en `rutas-shell-v9`) para que el service worker no sirva versiones viejas desde caché.
- Los encabezados de columnas del Sheet se leen sin distinguir mayúsculas/minúsculas (`field()` en `js/sheet.js`, reusado por `js/pricing.js`).
- Identidad de git para commits: no la configuro yo (tengo prohibido tocar `git config`); si hace falta, pedirle al usuario que corra `git config user.email/user.name` él mismo.
