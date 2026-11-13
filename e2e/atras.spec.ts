import { expect, test, type Page } from '@playwright/test';

// Atrás del sistema (gesto de iOS, botón de Android): primero cierra la hoja, luego vuelve pantalla a pantalla.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
    localStorage.setItem('lazo:vista-explicada', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
});

const h1 = (page: Page, name: string) => expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

async function hastaLaHoja(page: Page) {
  await page.goto('/#/');
  await h1(page, 'Tus grupos');
  await page.getByRole('link', { name: /Navidad en familia/ }).click();
  await h1(page, 'Navidad en familia');
  await page.getByRole('link', { name: /Marta/ }).first().click();
  await h1(page, 'Marta');
  await page.getByRole('button', { name: 'Ideas para Marta' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('atrás cierra la hoja, luego vuelve al grupo y a Tus grupos', async ({ page }) => {
  await hastaLaHoja(page);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await h1(page, 'Marta');
  await page.goBack();
  await h1(page, 'Navidad en familia');
  await page.goBack();
  await h1(page, 'Tus grupos');
});

test('«‹ Volver» y la ✕ hacen lo mismo sin dejar entradas sobrantes', async ({ page }) => {
  await hastaLaHoja(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // La ✕ quitó la entrada de la hoja.
  await expect.poll(() => page.evaluate(() => history.state?.sheet)).toBeUndefined();
  await page.locator('.back').click();
  await h1(page, 'Navidad en familia');
  await page.locator('.back').click();
  await h1(page, 'Tus grupos');
  // «‹ Volver» fue atrás de verdad: las pantallas siguen delante en el historial.
  await page.goForward();
  await h1(page, 'Navidad en familia');
  await page.goForward();
  await h1(page, 'Marta');
});

test('entrando por un enlace, «‹ Volver» va a su destino', async ({ page }) => {
  await page.goto('/#/l/l-marta');
  await h1(page, 'Marta');
  await page.locator('.back').click();
  await h1(page, 'Navidad en familia');
  await page.locator('.back').click();
  await h1(page, 'Tus grupos');
});
