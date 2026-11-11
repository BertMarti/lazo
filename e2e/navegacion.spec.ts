import { expect, test } from '@playwright/test';

// Al pulsar un grupo en «Tus grupos» se abre ese grupo (no basta con que cambie la URL).
test('desde Tus grupos se entra en el grupo y se vuelve', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
    localStorage.setItem('lazo:explicado', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tus grupos' })).toBeVisible();
  await page.getByRole('link', { name: /Navidad en familia/ }).click();
  await expect(page).toHaveURL(/#\/g\/navidad$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Navidad en familia' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Familia' })).toBeVisible();
  await page.getByRole('link', { name: /Mamá/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mamá' })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Tus grupos' })).toBeVisible();
  await page.getByRole('link', { name: /Cumpleaños de Mamá/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cumpleaños de Mamá' })).toBeVisible();
});
