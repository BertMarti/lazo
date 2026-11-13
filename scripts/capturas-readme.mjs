// Capturas del README (guía de usuario): recorre la demo en un móvil de 390 × 844 (Pixel 7), en modo claro.
// Uso (en WSL): node scripts/capturas-readme.mjs                 → arranca la demo con Vite en el puerto 5513
//               LAZO_URL=http://127.0.0.1:5173 node scripts/capturas-readme.mjs   → usa una demo que ya está en marcha
// Escribe docs/capturas/*.png. La pantalla de bienvenida de Android no se captura.
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs', 'capturas');
const PORT = Number(process.env.PORT || 5513);
const BASE = (process.env.LAZO_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
mkdirSync(OUT, { recursive: true });

let server;
if (!process.env.LAZO_URL) {
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, VITE_DEMO: '1' } });
  process.on('exit', () => server.kill());
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      if (i > 150) throw new Error('La demo no arranca');
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

// --lang: los campos de fecha, en formato español.
const browser = await chromium.launch({ args: ['--lang=es-ES'], env: { ...process.env, LANG: 'es_ES.UTF-8', LANGUAGE: 'es' } });

/** Un móvil recién estrenado: la demo desde cero, viendo como `who`. */
async function phone(who = 'alberto', { explained = false, clock } = {}) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  await ctx.addInitScript(([w, e]) => {
    if (sessionStorage.getItem('capturas')) return;
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', w);
    if (e) localStorage.setItem('lazo:vista-explicada', '1');
    sessionStorage.setItem('lazo:inicio', '1');
    sessionStorage.setItem('capturas', '1');
  }, [who, explained]);
  const page = await ctx.newPage();
  if (clock) await page.clock.setFixedTime(clock);
  return page;
}

async function open(page, hash) {
  await page.goto(`${BASE}/#${hash}`);
  await settle(page);
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

/** Sin avisos breves a medio irse ni anillos de foco: solo lo que enseña la captura. */
async function shot(page, name) {
  await page.locator('.toast').waitFor({ state: 'detached', timeout: 10_000 });
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await settle(page);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`docs/capturas/${name}.png`);
}

const asViewer = (page, who) => page.getByRole('region', { name: 'Demo' }).getByLabel('Ver como').selectOption(who);

// 1 y 2. Crear el grupo e invitar.
{
  const page = await phone();
  await open(page, '/');
  await page.getByRole('button', { name: 'Crear otro grupo' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Nombre', { exact: true }).fill('Cumpleaños de Papá');
  await sheet.getByRole('combobox').selectOption('cumpleanos');
  await sheet.locator('input[type=date]').fill('2027-02-20');
  await sheet.getByRole('textbox', { name: /Quiénes sois/ }).fill('Marta\nJavier\nSamira');
  await sheet.getByRole('textbox', { name: /Quiénes sois/ }).blur();
  await shot(page, '01-grupo');
  await sheet.getByRole('button', { name: 'Crear grupo' }).click();
  await page.getByRole('heading', { name: 'Cumpleaños de Papá' }).waitFor();
  await shot(page, '01-grupo-creado');
  await page.getByRole('button', { name: 'Invitar a la familia' }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Invitar' }).waitFor();
  await shot(page, '02-invitar');
  await page.context().close();
}

// 3. Entrar por el enlace para todos.
{
  const page = await phone();
  await open(page, '/unirse/demoGeneralNavidad2026xx');
  await page.getByRole('radio', { name: 'Tía Loli' }).check();
  await shot(page, '03-entrar');
  await page.getByRole('button', { name: 'Soy Tía Loli' }).click();
  await page.getByRole('heading', { name: 'Ya casi estás, Tía Loli' }).waitFor();
  await shot(page, '03-codigo');
  await page.context().close();
}

// 4. Añadir regalos: las formas de añadir y una lista de Amazon.
{
  const page = await phone('alberto', { explained: true });
  await open(page, '/l/l-alberto/nuevo');
  await page.getByRole('heading', { name: 'Añadir a tu lista' }).waitFor();
  await shot(page, '04-anadir');
  await page.getByRole('button', { name: 'Importar lista de Amazon' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Probar con una lista de ejemplo' }).click();
  await sheet.getByText('He encontrado 8 productos.').waitFor();
  await sheet.getByText('He encontrado 8 productos.').scrollIntoViewIfNeeded();
  await shot(page, '04-amazon');
  await page.context().close();
}

// 5. Reservar y la hucha.
{
  const page = await phone('alberto', { explained: true });
  await open(page, '/l/l-javier');
  const card = page.locator('.gift', { hasText: 'Cuchillo de chef' });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'Me lo reservo' }).click();
  await page.getByRole('status').getByText('Reservado. Javier no lo verá.').waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, '05-reservar.png') });
  console.log('docs/capturas/05-reservar.png');
  await page.context().close();
}
{
  const page = await phone();
  await open(page, '/hucha/navidad');
  await shot(page, '05-hucha');
  await page.context().close();
}

// 6. La regla de la sorpresa: la lista de Marta vista por Alberto y por Marta.
{
  const page = await phone('alberto', { explained: true });
  await open(page, '/l/l-marta');
  // Alberto: lo ya cogido, con quién lo reserva o lo compró.
  await page.getByRole('heading', { name: /Ya cogidos/ }).evaluate((h) => window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 140));
  await shot(page, '06-sorpresa-alberto');
  await page.evaluate(() => window.scrollTo(0, 0));
  await asViewer(page, 'marta');
  await page.getByText('Lo que te regalan es sorpresa: aquí solo ves lo que has pedido.').waitFor();
  await shot(page, '06-sorpresa-marta');
  await page.context().close();
}

// 7. El amigo invisible.
{
  const page = await phone();
  await open(page, '/sorteo/navidad');
  await shot(page, '07-sorteo');
  await page.getByRole('button', { name: /Abrir el paquete/ }).first().click();
  await page.getByText('Te ha tocado regalar a').waitFor();
  await shot(page, '07-sorteo-abierto');
  await page.context().close();
}

// 8. El día de la entrega: pasada la fecha, Alberto lo propone, Marta dice que sí y ve lo suyo.
{
  const page = await phone('alberto', { clock: new Date('2026-12-26T11:00:00+01:00') });
  await open(page, '/g/navidad');
  await page.getByRole('button', { name: 'Proponer abrirla' }).click();
  await page.getByText('Falta que alguien más diga que sí').waitFor();
  await asViewer(page, 'marta');
  await page.getByText('Alberto quiere abrir la entrega.').waitFor();
  await shot(page, '08-entrega');
  await page.getByRole('button', { name: 'De acuerdo' }).click();
  await page.getByRole('button', { name: 'Ver qué me regalaron' }).click();
  await page.getByRole('button', { name: 'Verlo' }).click();
  await page.getByText('No se enseñan precios ni cuentas.').waitFor();
  await shot(page, '08-regalos');
  await page.context().close();
}

// 9. Imprimir y compartir en solo lectura.
{
  const page = await phone('alberto', { explained: true });
  await open(page, '/imprimir/l-javier');
  await shot(page, '09-imprimir');
  await open(page, '/l/l-alberto');
  await page.getByRole('button', { name: 'Compartir mi lista (solo lectura)' }).click();
  await page.getByRole('button', { name: 'Crear el enlace' }).waitFor();
  await shot(page, '09-compartir');
  await page.context().close();
}

await browser.close();
server?.kill();
