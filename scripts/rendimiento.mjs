// Rendimiento de la demo en un Android modesto: CPU 4× más lenta, red «Fast 3G» (150 ms, ~1,6 Mbps) y 360×740.
// Uso (en WSL): npm run rendimiento            → construye la demo, la sirve con vite preview y escribe docs/RENDIMIENTO.md
//               npm run rendimiento -- --sin-build   → reutiliza dist-demo/
// La sección «## Causas y arreglos propuestos» del documento se escribe a mano y se conserva al volver a medir.
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist-demo');
const DOC = join(ROOT, 'docs', 'RENDIMIENTO.md');
const PORT = 5900 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = ['/#/g/navidad', '/#/l/l-marta'];
const RUNS = 3;
const LIMITS = { lcp: 2500, cls: 0.1, jsGzip: 300 * 1024 };
const NET = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

if (!process.argv.includes('--sin-build')) execSync('npm run build:demo', { cwd: ROOT, stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-demo', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    if (i > 100) throw new Error('vite preview no arranca');
  }
  await new Promise((r) => setTimeout(r, 200));
}

// Observadores instalados antes de que cargue nada (buffered: también lo que pasó antes de registrarse).
function observe() {
  const p = (window.__perf = { lcp: 0, cls: 0, longtasks: [], fcp: 0 });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (p.lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
  // ponytail: CLS como suma total de desplazamientos sin interacción, no por ventanas de sesión; igual o peor que el oficial.
  new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (p.cls += e.value))).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => p.longtasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => e.name === 'first-contentful-paint' && (p.fcp = e.startTime))).observe({ type: 'paint', buffered: true });
}

async function measure(route) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('lazo:inicio')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:explicado', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
  });
  await ctx.addInitScript(observe);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', NET);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(BASE + '/' + route, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // LCP y desplazamientos tardíos
  const r = await page.evaluate(() => {
    const p = window.__perf;
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const js = res.filter((e) => e.initiatorType === 'script' || /\.m?js(\?|$)/.test(e.name));
    // Chromium da transferSize 0 a fuentes e imágenes en algunas cargas: entonces vale el cuerpo codificado.
    const size = (e) => e.transferSize || e.encodedBodySize;
    // TTI aproximado: fin de la última tarea larga (>50 ms) tras el primer pintado, o el DOMContentLoaded si es más tarde.
    const lastLong = p.longtasks.filter(([s]) => s >= p.fcp).reduce((m, [s, d]) => Math.max(m, s + d), 0);
    return {
      fcp: p.fcp,
      lcp: p.lcp,
      cls: p.cls,
      tti: Math.max(p.fcp, nav.domContentLoadedEventEnd, lastLong),
      bytes: nav.transferSize + res.reduce((s, e) => s + size(e), 0),
      jsBytes: js.reduce((s, e) => s + size(e), 0),
      files: res.map((e) => new URL(e.name).pathname.split('/').pop()),
      jsDecoded: js.reduce((s, e) => s + e.decodedBodySize, 0),
      requests: res.length + 1,
    };
  });
  await browser.close();
  return r;
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const results = {};
const loaded = new Set();
try {
  for (const route of ROUTES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(route));
    runs[0].files.forEach((f) => loaded.add(f));
    results[route] = Object.fromEntries(Object.keys(runs[0]).filter((k) => k !== 'files').map((k) => [k, median(runs.map((r) => r[k]))]));
    console.log(route, results[route]);
  }
} finally {
  stop();
}

// Peso de cada fichero de dist-demo/assets, en crudo y con gzip (lo que llega con un servidor que comprime).
const assets = readdirSync(join(DIST, 'assets')).map((f) => {
  const buf = readFileSync(join(DIST, 'assets', f));
  return { f, raw: buf.length, gz: gzipSync(buf, { level: 9 }).length };
});
const js = assets.filter((a) => a.f.endsWith('.js')).sort((a, b) => b.gz - a.gz);
const jsGzip = js.reduce((s, a) => s + a.gz, 0);
const jsInitial = js.filter((a) => loaded.has(a.f)).reduce((s, a) => s + a.gz, 0);

const kb = (n) => `${(n / 1024).toFixed(1).replace('.', ',')} KB`;
const s = (ms) => `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
const flag = (bad) => (bad ? ' ⚠' : '');
const rowsTable = ROUTES.map((r) => {
  const x = results[r];
  return `| \`${r}\` | ${s(x.fcp)} | ${s(x.lcp)}${flag(x.lcp > LIMITS.lcp)} | ${x.cls.toFixed(3).replace('.', ',')}${flag(x.cls > LIMITS.cls)} | ${s(x.tti)} | ${kb(x.bytes)} | ${kb(x.jsBytes)} (${kb(x.jsDecoded)} sin comprimir) | ${x.requests} |`;
}).join('\n');
const over = ROUTES.some((r) => results[r].lcp > LIMITS.lcp || results[r].cls > LIMITS.cls) || jsGzip > LIMITS.jsGzip;

const old = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
const manual = /## Causas y arreglos propuestos[\s\S]*?(?=\n## Modelos y su función|$)/.exec(old)?.[0].trimEnd();
const today = new Date().toISOString().slice(0, 10);

writeFileSync(
  DOC,
  `# Rendimiento en un Android modesto

Medido el ${today} con \`npm run rendimiento\` (\`scripts/rendimiento.mjs\`) sobre la demo construida. Mediana de ${RUNS} cargas en frío por ruta.

## Resultados

| Ruta | FCP | LCP | CLS | Interactivo (aprox.) | Transferido | JS transferido | Peticiones |
|---|---|---|---|---|---|---|---|
${rowsTable}

**JS total con gzip:** ${kb(jsGzip)} en ${js.length} ficheros${flag(jsGzip > LIMITS.jsGzip)}; lo que se descarga al abrir estas rutas, ${kb(jsInitial)}${flag(jsInitial > LIMITS.jsGzip)}. Límites: LCP ≤ 2,5 s, CLS ≤ 0,1 y JS ≤ 300 KB con gzip. ${over ? '**Algo pasa del límite** (⚠): ver las causas abajo.' : 'Todo dentro de los límites.'}

### Ficheros de \`dist-demo/assets\`

| Fichero | En disco | Con gzip | Se descarga al abrir |
|---|---|---|---|
${assets
  .sort((a, b) => b.gz - a.gz)
  .map((a) => `| \`${a.f}\` | ${kb(a.raw)} | ${kb(a.gz)} | ${loaded.has(a.f) ? 'sí' : 'no'} |`)
  .join('\n')}

## Metodología

- \`npm run build:demo\` y \`npx vite preview\` en un puerto entre 5900 y 5999 (sin caché y sin service worker).
- Chromium de Playwright, sin cabeza, con un contexto móvil de 360×740 (DPR 2, táctil) y la persona de la demo «Alberto».
- CDP: \`Emulation.setCPUThrottlingRate\` 4× y \`Network.emulateNetworkConditions\` con 150 ms de latencia, 1,6 Mbps de bajada y 750 kbps de subida («Fast 3G»). Caché desactivada (\`Network.setCacheDisabled\`).
- Cada carga en un navegador nuevo. Tras \`load\` y \`networkidle\` se esperan 3 s y se leen los datos.
- **LCP**, **CLS**, **FCP** y tareas largas con \`PerformanceObserver\` (\`buffered: true\`) instalado antes de cargar la página. El CLS es la suma de todos los desplazamientos sin interacción, no la peor ventana de sesión: es igual o peor que el oficial.
- **Interactivo (aprox.)**: el mayor de FCP, \`domContentLoadedEventEnd\` y el final de la última tarea larga (> 50 ms) tras el FCP. No es el TTI de Lighthouse, pero sirve para comparar versiones.
- **Transferido** y **JS transferido**: suma de \`transferSize\` de \`performance.getEntriesByType('navigation' | 'resource')\`. Si Chromium da 0 (pasa con fuentes e imágenes), se usa \`encodedBodySize\`. \`vite preview\` sirve con gzip, como Caddy en producción (\`encode zstd gzip\`). Incluye las fotos de la demo.
- **JS con gzip**: cada fichero de \`dist-demo/assets\` comprimido con gzip (nivel 9). «Se descarga al abrir» es lo que pidió alguna de las dos rutas.

${manual || '## Causas y arreglos propuestos\n\nSin analizar todavía.'}

## Modelos y su función

| Modelo | Qué hizo |
|---|---|
| Claude Opus 5.5 | El script de medida, la ejecución y el análisis de causas |
`,
);
console.log(`Escrito ${DOC}${over ? ' — hay valores por encima del límite' : ''}`);
process.exit(0);
