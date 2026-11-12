import { expect, test } from '@playwright/test';

test('amigo invisible: abrir, ver el nombre, taparlo y copiar sin Web Share', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await page.addInitScript(() => {
    // Sin Web Share: debe ofrecer «Copiar».
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
      localStorage.setItem('lazo:vista-explicada', '1');
    }
  });
  await page.goto('/#/sorteo/navidad');
  await page.getByLabel('Ver como').selectOption('papa');

  const open = page.getByRole('button', { name: 'Abrir el paquete del amigo invisible' });
  const name = page.locator('.envelope .who');
  await expect(name).toHaveText('Javier');
  // Tapado: ni se ve ni se lee, y no hay nada que pulsar dentro.
  await expect(name).toHaveCSS('opacity', '0');
  await expect(page.getByRole('button', { name: 'Copiar' })).toHaveCount(0);

  await open.click();
  await expect(name).toHaveCSS('opacity', '1');
  await expect(name).toBeFocused();
  await expect(page.getByText('no lo reenvíes al grupo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviármelo' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Taparlo' }).click();
  await expect(open).toBeFocused();
  await expect(name).toHaveCSS('opacity', '0');
  await expect(page.getByRole('button', { name: 'Taparlo' })).toHaveCount(0);

  await open.click();
  await page.getByRole('button', { name: 'Copiar' }).click();
  await expect(page.getByText('Copiado. Pégatelo en un chat contigo mismo')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`Amigo invisible de Navidad en familia (sorteo n.º 1): te toca regalar a Javier. ${new URL(page.url()).origin}/#/l/l-javier`);
});
