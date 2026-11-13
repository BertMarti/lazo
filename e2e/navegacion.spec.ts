import { expect, test } from '@playwright/test';

// Al pulsar un grupo en «Tus grupos» se abre ese grupo (no basta con que cambie la URL).
test('desde Tus grupos se entra en el grupo y se vuelve', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
    localStorage.setItem('lazo:vista-explicada', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tus grupos' })).toBeVisible();
  await page.getByRole('link', { name: /Navidad en familia/ }).click();
  await expect(page).toHaveURL(/#\/g\/navidad$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Navidad en familia' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Familia' })).toBeVisible();
  await page.getByRole('link', { name: /Marta/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Marta' })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Tus grupos' })).toBeVisible();
  await page.getByRole('link', { name: /Cumpleaños de Marta/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cumpleaños de Marta' })).toBeVisible();
});

// «Entrar en otro móvil»: en Ajustes se pide un código y se ve en grande con su caducidad.
test('Ajustes da un código para entrar en otro móvil', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
    localStorage.setItem('lazo:vista-explicada', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
  await page.goto('/#/ajustes');
  await page.getByRole('button', { name: 'Entrar en otro móvil' }).click();
  await expect(page.getByText('DEMO2345')).toBeVisible();
  await expect(page.getByText('Caduca en 10 minutos')).toBeVisible();
  await expect(page.getByText(`Dirección de tu Lazo: ${new URL(page.url()).origin}`)).toBeVisible();
});
