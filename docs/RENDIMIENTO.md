# Rendimiento en un Android modesto

Medido el 2026-11-12 con `npm run rendimiento` (`scripts/rendimiento.mjs`) sobre la demo construida. Mediana de 3 cargas en frío por ruta.

## Resultados

| Ruta | FCP | LCP | CLS | Interactivo (aprox.) | Transferido | JS transferido | Peticiones |
|---|---|---|---|---|---|---|---|
| `/#/g/navidad` | 1,64 s | 1,74 s | 0,248 ⚠ | 1,64 s | 476,4 KB | 193,6 KB (658,8 KB sin comprimir) | 10 |
| `/#/l/l-mama` | 1,62 s | 1,83 s | 0,001 | 1,70 s | 565,6 KB | 193,6 KB (658,8 KB sin comprimir) | 11 |

**JS total con gzip:** 347,9 KB en 2 ficheros ⚠; lo que se descarga al abrir estas rutas, 192,9 KB. Límites: LCP ≤ 2,5 s, CLS ≤ 0,1 y JS ≤ 300 KB con gzip. **Algo pasa del límite** (⚠): ver las causas abajo.

### Ficheros de `dist-demo/assets`

| Fichero | En disco | Con gzip | Se descarga al abrir |
|---|---|---|---|
| `index-BsDoZjQi.js` | 658,8 KB | 192,9 KB | sí |
| `xlsx-DR4W_luh.js` | 480,5 KB | 155,0 KB | no |
| `nunito-latin-wght-normal-BzFMHfZw.woff2` | 38,2 KB | 38,2 KB | sí |
| `nunito-latin-ext-wght-normal-CXYtwYOx.woff2` | 34,8 KB | 34,8 KB | no |
| `nunito-cyrillic-ext-wght-normal-D4X5GqEv.woff2` | 28,3 KB | 28,3 KB | no |
| `young-serif-latin-400-normal-DIMmNPI9.woff2` | 26,4 KB | 26,4 KB | sí |
| `young-serif-latin-400-normal-D1tz0Z9s.woff` | 21,7 KB | 21,7 KB | no |
| `nunito-cyrillic-wght-normal-CY6AOgYE.woff2` | 20,3 KB | 20,3 KB | no |
| `young-serif-latin-ext-400-normal-DzElnxZw.woff2` | 16,9 KB | 16,9 KB | sí |
| `young-serif-latin-ext-400-normal-4arC2Gh9.woff` | 14,4 KB | 14,3 KB | no |
| `nunito-vietnamese-wght-normal-U01xdrZh.woff2` | 12,8 KB | 12,8 KB | no |
| `index-B4U6leIx.css` | 39,2 KB | 8,8 KB | sí |

## Metodología

- `npm run build:demo` y `npx vite preview` en un puerto entre 5900 y 5999 (sin caché y sin service worker).
- Chromium de Playwright, sin cabeza, con un contexto móvil de 360×740 (DPR 2, táctil) y la persona de la demo «Alberto».
- CDP: `Emulation.setCPUThrottlingRate` 4× y `Network.emulateNetworkConditions` con 150 ms de latencia, 1,6 Mbps de bajada y 750 kbps de subida («Fast 3G»). Caché desactivada (`Network.setCacheDisabled`).
- Cada carga en un navegador nuevo. Tras `load` y `networkidle` se esperan 3 s y se leen los datos.
- **LCP**, **CLS**, **FCP** y tareas largas con `PerformanceObserver` (`buffered: true`) instalado antes de cargar la página. El CLS es la suma de todos los desplazamientos sin interacción, no la peor ventana de sesión: es igual o peor que el oficial.
- **Interactivo (aprox.)**: el mayor de FCP, `domContentLoadedEventEnd` y el final de la última tarea larga (> 50 ms) tras el FCP. No es el TTI de Lighthouse, pero sirve para comparar versiones.
- **Transferido** y **JS transferido**: suma de `transferSize` de `performance.getEntriesByType('navigation' | 'resource')`. Si Chromium da 0 (pasa con fuentes e imágenes), se usa `encodedBodySize`. `vite preview` sirve con gzip, como Caddy en producción (`encode zstd gzip`). Incluye las fotos de la demo.
- **JS con gzip**: cada fichero de `dist-demo/assets` comprimido con gzip (nivel 9). «Se descarga al abrir» es lo que pidió alguna de las dos rutas.

## Causas y arreglos propuestos

Análisis del 2026-11-12. Son propuestas: no se han aplicado, porque la app la tocan otras ramas. Hay dos cosas por encima del límite: el **CLS de `/#/g/navidad`** (0,25) y el **JS total con gzip** (348 KB). El LCP está por debajo de 2 s en las dos rutas, y el JS que se descarga al abrir (unos 193 KB) también está dentro del límite.

Para repartir el `index-*.js` entre paquetes se construyó una vez la demo con `codeSplitting.groups` en una carpeta temporal, sin tocar `vite.config.ts`. Cifras con gzip:

| Trozo | Con gzip |
|---|---|
| `xlsx` (ya es carga diferida) | 155,0 KB |
| `react-dom` + `scheduler` | 65,7 KB |
| Pantallas (`src/ui/screens`, todas a la vez) | 37,8 KB |
| `@phosphor-icons/react` | 28,1 KB |
| `zod` | 24,2 KB |
| `pocketbase` | 10,3 KB |
| Datos de la demo (`src/api/demo.ts` + `seed.ts`) | 8,3 KB |
| `qrcode-generator` (solo para imprimir) | 7,3 KB |
| Resto de `src` | 6,8 KB |
| Catálogo de ideas (`src/ai/catalog.ts`) | 4,9 KB |

### 1. La cabecera de la página aparece después que el contenido (CLS 0,25 en el grupo)

- **Dato:** a 1,9 s, la cuadrícula `.members` (320×620) baja de y = 120 a y = 343,5. Encima se ha metido `div.page-head`, de 200 px de alto, con el nombre del grupo y la fecha. Ese desplazamiento solo ya vale 0,246.
- **Por qué:** `src/App.tsx:88` pinta la cabecera solo `{t.name && …}`. El título lo pone cada pantalla con `onTitle` dentro de un `useEffect` (`src/ui/screens/Group.tsx:29-39`), y ese efecto se ejecuta después de pintar. El navegador pinta primero el contenido sin cabecera y, en el fotograma siguiente, la cabecera lo empuja hacia abajo.
- **Arreglo:** cambiar ese `useEffect` por `useLayoutEffect` en `Group.tsx` (y en `List.tsx:59`, que sigue el mismo patrón). Así la cabecera y el contenido salen en el mismo fotograma. Otra opción es reservar el hueco de `.page-head` con un `min-height` mientras `t.name` está vacío en las rutas `g` y `l`. Lo esperable es bajar el CLS por debajo de 0,01.

### 2. `xlsx` pesa 155 KB con gzip (es el 45 % de todo el JS)

- **Dato:** `xlsx-*.js` ocupa 480,5 KB en disco y 155,0 KB con gzip. Ya va en carga diferida (`src/ui/screens/Import.tsx:44`, `await import('xlsx')`), así que no frena la carga de estas rutas, pero sí cuenta en el total y se descarga entero la primera vez que alguien importa un Excel en un móvil con 3G (unos 0,8 s solo de red).
- **Arreglo:** usar la versión mínima de SheetJS (`xlsx/dist/xlsx.mini.min.js`: solo XLSX y CSV, sin formatos antiguos), que es más pequeña. Hay que medirla antes de cambiar. Si además se lee solo la primera hoja como filas, sobra con eso. Otra opción es aceptar CSV además de Excel y cargar `xlsx` solo cuando el fichero sea `.xlsx`.

### 3. Todo lo demás va en un solo trozo de 193 KB, incluido lo que casi nadie usa al abrir

- **Dato:** `index-*.js` ocupa 658,8 KB en disco. De ese trozo, 24,2 KB son de `zod`, que solo usa `src/ai/provider.ts` (la IA, apagada por defecto); 28,1 KB son de iconos, con los 6 pesos de cada icono de Phosphor aunque se usen 2 o 3; 7,3 KB son de `qrcode-generator`, que solo usa la pantalla de imprimir; 4,9 KB son del catálogo de ideas, y 37,8 KB son de todas las pantallas a la vez, porque `src/App.tsx:10-19` las importa todas.
- **Arreglo:**
  - Cargar en diferido, con `React.lazy`, las pantallas que no son de entrada: Imprimir y la lista compartida (que se llevan `qrcode`), Importar, Ideas, Ajustes, Sorteo, Hucha y Recibido.
  - Cargar `src/ai/*` y `zod` solo al usar la IA.
  - Importar los iconos de uno en uno (`@phosphor-icons/react/dist/csr/Gift` y similares) o limitarse a los pesos que se usan.
  - Con eso, lo que se descarga al abrir bajaría unos 60-70 KB con gzip, hasta unos 125-135 KB. Supone menos red y menos tiempo de CPU para analizar el JS, que en un móvil 4× más lento es lo que más pesa.
- **Las fotos de la demo** (`public/demo/fotos/*.webp`, unos 200 KB en `/#/g/navidad`) son la mayor parte de lo transferido después del JS. No empeoran el LCP, porque ya llevan `loading="lazy"`, pero convendría servirlas a 360 px de ancho en el móvil (`srcset`).

## Modelos y su función

| Modelo | Qué hizo |
|---|---|
| Claude Opus 5.5 | El script de medida, la ejecución y el análisis de causas |
