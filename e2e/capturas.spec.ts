import { test, type Page } from '@playwright/test';

// Capturas de diseño (no son aserciones). CAPTURAS=docs/design/v0.2 npx playwright test e2e/capturas.spec.ts
const dir = process.env.CAPTURAS;
test.skip(!dir, 'Solo cuando se piden capturas');

const shots: [string, string, string, ((p: Page) => Promise<void>)?][] = [
  ['grupo', 'alberto', '/#/g/navidad'],
  ['grupo-visto-por-mama', 'mama', '/#/g/navidad'],
  ['lista-de-mama', 'alberto', '/#/l/l-mama'],
  ['lista-propia', 'alberto', '/#/l/l-alberto'],
  ['regalo-a-medias', 'alberto', '/#/l/l-samira', async (p) => { await p.locator('.gift', { hasText: 'Taller de cerámica' }).locator('.gift-open').click(); }],
  ['compra-con-la-hucha', 'alberto', '/#/l/l-mama', async (p) => { await p.locator('.gift', { hasText: 'Robot de cocina' }).locator('.gift-open').click(); }],
  ['entrar-pendiente', 'alberto', '/#/unirse/demoGeneralNavidad2026xx', async (p) => { await p.getByRole('radio', { name: 'Tía Loli' }).check(); await p.getByRole('button', { name: 'Soy Tía Loli' }).click(); }],
  ['solicitud-de-entrada', 'alberto', '/#/unirse/demoGeneralNavidad2026xx', async (p) => { await p.getByRole('radio', { name: 'Tía Loli' }).check(); await p.getByRole('button', { name: 'Soy Tía Loli' }).click(); await p.getByLabel('Ver como').selectOption('alberto'); await p.goto('/#/g/navidad'); }],
  ['entrega-propuesta', 'alberto', '/#/g/navidad', async (p) => { await p.evaluate(() => { const k = 'lazo-demo-v4'; const db = JSON.parse(localStorage.getItem(k)!); db.groups[0].revealAskedBy = 'alberto'; localStorage.setItem(k, JSON.stringify(db)); }); await p.getByLabel('Ver como').selectOption('papa'); }],
  ['recibido', 'mama', '/#/g/navidad', async (p) => { await p.evaluate(() => { const k = 'lazo-demo-v4'; const db = JSON.parse(localStorage.getItem(k)!); db.groups[0].revealedAt = 1; localStorage.setItem(k, JSON.stringify(db)); }); await p.goto('/#/recibido/navidad'); await p.waitForTimeout(300); await p.getByRole('button', { name: 'Verlo' }).click(); }],
  ['anadir', 'alberto', '/#/l/l-alberto/nuevo'],
  ['compras', 'alberto', '/#/compras'],
  ['amigo-invisible', 'alberto', '/#/sorteo/navidad', async (p) => { await p.getByRole('button', { name: /Abrir tu sobre/ }).click(); }],
  ['inicio', 'alberto', '/#/'],
  ['hucha', 'papa', '/#/hucha/navidad'],
  ['hucha-tesorero', 'alberto', '/#/hucha/navidad'],
  ['entrar', 'alberto', '/#/unirse/demoGeneralNavidad2026xx'],
  ['ya-comprado', 'alberto', '/#/l/l-mama', async (p) => { await p.locator('.gift', { hasText: 'Pañuelo' }).getByRole('button', { name: 'Ya comprado' }).click(); }],
  ['invitar', 'alberto', '/#/g/navidad', async (p) => { await p.getByRole('button', { name: 'Invitar a la familia' }).click(); }],
];

for (const [name, who, url, act] of shots) {
  test(name, async ({ page }, info) => {
    await page.addInitScript((w) => {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', w);
      localStorage.setItem('lazo:explicado', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }, who);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await page.waitForTimeout(500);
    if (act) await act(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${info.project.name}/${name}.png`, fullPage: info.project.name === 'movil' });
  });
}
