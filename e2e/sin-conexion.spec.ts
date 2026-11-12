import { expect, test, type Page } from '@playwright/test';
import type { DemoApi } from '../src/api/demo';

// Mala cobertura: la franja «Sin conexión» aparece y se va con la red, y una lectura que falla ofrece «Reintentar».
// La demo no usa red: el fallo de lectura se simula tapando demo.groups (window.__lazoDemo, solo con VITE_DEMO).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:explicado', '1');
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
  });
});

const failReads = (page: Page, fail: boolean) =>
  page.evaluate((fail) => {
    // Tapa el método del prototipo con uno propio; al borrarlo vuelve el de verdad.
    const demo = (window as unknown as { __lazoDemo: Partial<Pick<DemoApi, 'groups'>> }).__lazoDemo;
    if (fail) Object.assign(demo, { groups: () => Promise.reject(new Error('No hay conexión. Lo intentamos otra vez cuando vuelva.')) });
    else delete demo.groups;
  }, fail);

test('sin red sale la franja; al volver se va y la pantalla se recarga sola', async ({ page, context }) => {
  await page.goto('/#/');
  const grupo = page.getByRole('link', { name: /Navidad en familia/ });
  await expect(grupo).toBeVisible();
  const band = page.getByRole('status').filter({ hasText: 'Sin conexión: verás lo último que cargaste' });
  await expect(band).toHaveCount(0);

  await context.setOffline(true);
  await expect(band).toBeVisible();
  await expect(grupo).toBeVisible(); // lo ya cargado sigue ahí

  // Una lectura que falla sin red: aviso claro y «Reintentar».
  await failReads(page, true);
  // Sin red, cambio de pantalla a mano: page.goto esperaría una carga que no llega.
  await page.evaluate(() => (location.hash = '/compras'));
  await expect(page.getByRole('heading', { level: 1, name: 'Mis compras' })).toBeVisible();
  await page.evaluate(() => (location.hash = '/'));
  await expect(page.getByText('No hay conexión. Lo intentamos otra vez cuando vuelva.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();

  // Vuelve la red: se quita la franja y se recarga lo abierto sin tocar nada.
  await failReads(page, false);
  await context.setOffline(false);
  await expect(band).toHaveCount(0);
  await expect(grupo).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
});

test('«Reintentar» vuelve a cargar', async ({ page }) => {
  await page.goto('/#/compras');
  await failReads(page, true);
  await page.goto('/#/');
  const retry = page.getByRole('button', { name: 'Reintentar' });
  await expect(retry).toBeVisible();
  await failReads(page, false);
  await retry.click();
  await expect(page.getByRole('link', { name: /Navidad en familia/ })).toBeVisible();
});
