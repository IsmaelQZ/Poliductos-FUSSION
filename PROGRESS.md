# Progreso — App de Rutas Comerciales (PWA)

Referencia: [resumen_proyecto_app_rutas.md](../PRIMERA%20PRUEBA%20APP%20EN%20CLAUDE%20CODE/resumen_proyecto_app_rutas.md) y `prototipo_rutas_v3.html` (carpeta "PRIMERA PRUEBA APP EN CLAUDE CODE").

## Estado: publicada, instalada, con precios reales conectados

- **Repo**: https://github.com/IsmaelQZ/Poliductos-FUSSION — **Live**: https://ismaelqz.github.io/Poliductos-FUSSION/
- Estructura del proyecto (vanilla JS + módulos ES, sin build tool — no hay Node.js instalado en esta máquina).
- Cacheo offline: service worker (`sw.js`) precachea el app shell + Leaflet (vendorizado en `vendor/leaflet/`) y cachea tiles de OpenStreetMap en tiempo de ejecución. Botón "Descargar ruta sin conexión" precarga tiles (z11–z15) + geometría real de la ruta activa. **Confirmado: instalada en celular real, funciona offline.**
- Sincronización de **rutas/ubicaciones**: hoja índice (`Ruta | URL_CSV` en `data/config.json` → `routesIndexCsvUrl`) + una hoja por ruta (`ID_Cliente | Nombre_Cliente | Orden_Visita | Latitud | Longitud | Direccion | Telefono | Notas | Activo`). Si una hoja falla, las demás igual sincronizan. Respaldo a `data/routes.json` si no hay Sheet o falla la red.
- Sincronización de **precios**: mismo esquema de índice, `pricingIndexCsvUrl` en `data/config.json`, ya configurado con datos reales (2 rutas: Ixmiquilpan e La Carretera, esta última con precios reales cargados). Cada hoja de ruta es una tabla **ancha**: columna `Cliente` (nombre) + una columna por producto, precio en la celda o vacía. El cruce con los clientes de ruta es **por nombre normalizado** (trim + lowercase, ver `normalizeClientName` en `js/pricing.js`), no por ID — esta hoja no trae ID. El usuario va agregando rutas progresivamente; las que faltan simplemente no tienen fila en el índice de precios todavía.
- Íconos y colores de marca: logo real de la empresa (`icons/icon-192.png` / `icon-512.png`, fuente en `icons/brand-logo-source.png`) y paleta CSS tomada de los colores del logo (`--navy:#0C0943`, `--navy-soft:#2A3D8F`, `--amber:#F4700D` — ver `:root` en `css/styles.css`). El trazo real de ruta y los marcadores numerados usan `--amber`; el punto de "mi ubicación" se dejó en azul estándar (`#3B82F6`, convención universal de mapas) para no confundirse con el trazo — por eso el trazo NO es azul.
- Ubicación en vivo: botón 📍 (bottomright) usa `navigator.geolocation.watchPosition` (GPS del dispositivo, funciona offline) para mostrar un punto azul + círculo de precisión; centra el mapa al tocarlo. `enableLiveLocation()` en `js/map.js`.
- Panel de clientes: el mapa ocupa toda la pantalla; botón 👥 azul (bottomright, junto al de ubicación) abre una hoja deslizable con la lista. Tocar el nombre de un cliente centra el mapa en su marcador (zoom 17) y cierra la hoja. Cada cliente tiene botones **Info** (teléfono con enlace `tel:` + tabla de precios) e **Ir →** (Google Maps).
- Fix de "espacio desperdiciado" abajo en iOS: no era el `100dvh` (eso también se corrigió pero no era la causa real) — Leaflet mide su contenedor una sola vez al iniciar y en una PWA instalada ese cálculo puede quedar desactualizado. Se agregó `map.invalidateSize()` en load/resize/orientationchange/visibilitychange (`js/map.js`).

## Decisiones tomadas

- Sin framework ni bundler (coherente con no tener Node.js instalado; app se sirve como archivos estáticos).
- Sincronización vía Google Sheets publicado como CSV (no API de Google, no import manual).
- Estructura de Sheet: una hoja por ruta + hoja índice — mismo patrón para ubicaciones y para precios, dos índices independientes en `data/config.json`. Agregar una ruta nueva (de cualquiera de los dos tipos) no requiere tocar código.
- Hosting: GitHub Pages (repo público, rama `main`, carpeta raíz). Todas las rutas del proyecto son relativas para que funcione bien bajo el subpath `/Poliductos-FUSSION/`.

## Cómo correr localmente

Un service worker y `fetch()` a `data/*.json` no funcionan con `file://`, hace falta un server local (usar un puerto libre — a veces hay otro proceso ya escuchando en 8080 en esta máquina que no se puede cerrar, revisar con `netstat -ano | grep LISTENING` si el service worker no registra):

```bash
python -m http.server 8099
```

Luego abrir `http://localhost:8099/`.

**Nota del sandbox de pruebas de Claude Code**: el navegador de vista previa de este entorno tiene una limitación conocida donde el registro del service worker falla siempre con "unknown error fetching the script" — confirmado que no es un bug de la app (hasta un SW mínimo de una línea falla igual ahí). La app real (GitHub Pages, instalada en el celular) sí registra el SW correctamente.

## Pendiente

1. **Confirmar con el usuario** que la corrección del "espacio desperdiciado" (invalidateSize) sí resolvió el problema en su celular — el intento anterior (100dvh → position:fixed) no fue suficiente.
2. Ir agregando más rutas a ambos índices (ubicaciones y precios) conforme el usuario las tenga listas — es trabajo 100% en Google Sheets, sin tocar código.
3. **Orden óptimo automático** (TSP) en vez de manual por `Orden_Visita` — mencionado como posible siguiente paso en el resumen original.
4. Mostrar `Direccion` / `Notas` en la ficha de info del cliente (ya vienen en los datos del Sheet, no se muestran todavía).

## Notas técnicas

- Cada vez que se edite un archivo del app shell (`css/`, `js/`, `data/config.json`, `index.html`, `icons/`), hay que subir `SHELL_CACHE` en `sw.js` (va en `rutas-shell-v16`) para que el service worker no sirva versiones viejas desde caché.
- Los encabezados de columnas del Sheet se leen sin distinguir mayúsculas/minúsculas (`field()` en `js/sheet.js`, reusado por `js/pricing.js`).
- El ícono de pantalla de inicio en iOS **no se auto-actualiza**: si se vuelve a cambiar el logo, hay que decirle al usuario que borre el ícono y lo vuelva a agregar.
- Identidad de git para commits: no la configuro yo (tengo prohibido tocar `git config`); si hace falta, pedirle al usuario que corra `git config user.email/user.name` él mismo.
