import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('nadie ve el estado de su propia lista; los demás sí', async ({ page }) => {
  await page.goto('/#/l/l-marta');
  await expect(page.getByRole('heading', { name: 'Tu lista' }).first()).toBeVisible();
  await expect(page.getByText('Aquí no verás lo que te han reservado')).toBeVisible();
  await expect(page.locator('.band')).toHaveCount(0);
  await expect(page.locator('.seal')).toHaveCount(0);

  await page.getByLabel('Ver como').selectOption('lucia');
  await expect(page.getByRole('heading', { name: 'Marta' }).first()).toBeVisible();
  await expect(page.locator('.band', { hasText: 'Comprado' })).toHaveCount(1);
});

test('reservar un regalo libre lo precinta', async ({ page }) => {
  await page.goto('/#/l/l-jorge');
  await page.getByRole('button', { name: /Cuchillo de chef, libre/ }).click();
  await page.getByRole('button', { name: 'Reservar' }).click();
  await expect(page.getByText('Reservado. Nadie más lo comprará.').first()).toBeAttached();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: /Cuchillo de chef, reservado/ })).toBeVisible();
});
