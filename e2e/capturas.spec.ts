import { test } from '@playwright/test';

// Capturas de diseño (no son aserciones). CAPTURAS=docs/design/v0.1 npx playwright test e2e/capturas.spec.ts
const dir = process.env.CAPTURAS;
test.skip(!dir, 'Solo cuando se piden capturas');

const shots: [string, string, ((p: import('@playwright/test').Page) => Promise<void>)?][] = [
  ['inicio', '/#/'],
  ['grupo', '/#/g/navidad'],
  ['lista-ajena', '/#/l/l-pablo'],
  ['lista-propia', '/#/l/l-marta'],
  ['lista-nina', '/#/l/l-vera'],
  ['regalo-a-medias', '/#/l/l-pablo', async (p) => { await p.getByRole('button', { name: /Bicicleta de montaña/ }).click(); }],
  ['nuevo-regalo', '/#/l/l-marta/nuevo'],
  ['compras', '/#/compras'],
  ['amigo-invisible', '/#/sorteo/navidad', async (p) => { await p.getByRole('button', { name: 'Abrir el sobre' }).click(); }],
];

for (const [name, url, act] of shots) {
  test(name, async ({ page }, info) => {
    await page.addInitScript(() => localStorage.clear());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await page.waitForTimeout(400);
    if (act) await act(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${info.project.name}/${name}.png`, fullPage: info.project.name === 'escritorio' ? false : true });
  });
}
