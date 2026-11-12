import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'samira');
      localStorage.setItem('lazo:vista-explicada', '1');
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
  });
});

test('imprimir la lista de Mamá: QR y ningún estado, aunque Samira los vea', async ({ page }) => {
  await page.goto('/#/l/l-mama');
  await expect(page.getByText('Lo reserva Alberto')).toBeVisible(); // Samira sí ve los estados en la app
  await page.getByRole('button', { name: 'Imprimir la lista' }).click();
  await expect(page).toHaveURL(/#\/imprimir\/l-mama$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mamá' })).toBeVisible();
  await expect(page.locator('.catalog-qr').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/Reservado|Comprado|Lo reserva|Sorpresa|Pañuelo de seda/);
  // En papel no salen ni la barra ni la navegación.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-bar')).toBeHidden();
  await expect(page.locator('.masthead')).toBeHidden();
});

test('compartir mi lista en solo lectura y abrirla en #/ver', async ({ page }) => {
  await page.goto('/#/l/l-samira');
  await page.getByRole('button', { name: 'Compartir mi lista (solo lectura)' }).click();
  await page.getByRole('button', { name: 'Crear el enlace' }).click();
  const url = await page.getByLabel('Enlace').inputValue();
  expect(url).toMatch(/#\/ver\/[0-9a-f]{32}$/);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: 'Samira' })).toBeVisible();
  await expect(page.locator('.catalog-item').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(/Reservado|Comprado|Lo reserva|Sorpresa/);
  // Revocado: el mismo mensaje que un enlace falso.
  await page.goto('/#/l/l-samira');
  await page.getByRole('button', { name: 'Compartir mi lista (solo lectura)' }).click();
  await page.getByRole('button', { name: 'Dejar de compartir' }).click();
  await page.goto(url);
  await expect(page.getByText('Este enlace no existe o ya no se comparte.')).toBeVisible();
});
