# Progreso — App de Rutas Comerciales (PWA)

Referencia: [resumen_proyecto_app_rutas.md](../PRIMERA%20PRUEBA%20APP%20EN%20CLAUDE%20CODE/resumen_proyecto_app_rutas.md) y `prototipo_rutas_v3.html` (carpeta "PRIMERA PRUEBA APP EN CLAUDE CODE").

## Estado: funcional de punta a punta, conectado a datos reales

- Estructura del proyecto (vanilla JS + módulos ES, sin build tool — no hay Node.js instalado en esta máquina).
- Cacheo offline: service worker (`sw.js`) precachea el app shell + Leaflet (vendorizado en `vendor/leaflet/`) y cachea tiles de OpenStreetMap en tiempo de ejecución. Botón "Descargar ruta sin conexión" precarga tiles (z11–z15) + geometría real de la ruta activa.
- Sincronización de datos: conectada al Google Sheet real del usuario. Esquema de dos niveles:
  - Hoja índice (`Ruta | URL_CSV`) — URL ya configurada en `data/config.json` (`routesIndexCsvUrl`).
  - Una hoja por ruta (`ID_Cliente | Nombre_Cliente | Orden_Visita | Latitud | Longitud | Direccion | Telefono | Notas | Activo`).
  - Botón "Actualizar datos" fuerza re-sync; se guarda `lastSync` y se muestra en la UI.
  - Si una hoja de ruta falla, las demás igual sincronizan (no se cae todo).
  - Respaldo a `data/routes.json` (datos semilla) si no hay Sheet configurado o falla la red.
- Íconos de marca: `icons/icon-192.png` / `icon-512.png` generados a partir de la imagen que compartió el usuario (camión + pin de ruta + logo "F"), recortada a sangre completa. Fuente original en `icons/brand-icon-source.webp`.

## Decisiones tomadas

- Sin framework ni bundler (coherente con no tener Node.js instalado; app se sirve como archivos estáticos).
- Sincronización vía Google Sheets publicado como CSV (no API de Google, no import manual) — ver pregunta respondida por el usuario.
- Estructura de Sheet: una hoja por ruta + hoja índice, para que agregar una ruta nueva no requiera tocar código (solo Google Sheets).

## Cómo correr localmente

Un service worker y `fetch()` a `data/*.json` no funcionan con `file://`, hace falta un server local:

```bash
python -m http.server 8080
```

Luego abrir `http://localhost:8080/`.

## Pendiente (no bloqueante, para retomar)

1. **Desplegar** a un hosting real (GitHub Pages / Netlify / etc.) para poder instalar la PWA en un celular real y probar modo avión de verdad (en el navegador de pruebas del sandbox no se pudo simular offline real).
2. **Orden óptimo automático** (TSP) en vez de manual por `Orden_Visita` — mencionado como posible siguiente paso en el resumen original.
3. Mostrar `Direccion` / `Telefono` / `Notas` en la lista de paradas (ya vienen en los datos del Sheet, la UI actual solo muestra nombre y coordenadas).
4. Repo sin inicializar en git todavía — evaluar si se quiere versionar.

## Notas técnicas para la próxima sesión

- Cada vez que se edite un archivo del app shell (`css/`, `js/`, `data/config.json`, `index.html`, `icons/`), hay que subir `SHELL_CACHE` en `sw.js` (va en `rutas-shell-v7`) para que el service worker no sirva versiones viejas desde caché.
- Los encabezados de columnas del Sheet se leen sin distinguir mayúsculas/minúsculas (por la hoja índice del usuario, que usa `RUTA` en mayúsculas).
