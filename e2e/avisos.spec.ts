import { expect, test } from '@playwright/test';

// La campana: Mamá ve lo que le toca poner en la hucha y nada de su propia lista; al cerrarla, queda leída.
test('la campana abre los avisos y se marcan como leídos', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('lazo:e2e')) return;
    sessionStorage.setItem('lazo:e2e', '1');
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'mama');
    localStorage.setItem('lazo:vista-explicada', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
  await page.goto('/#/g/navidad');
  const bell = page.getByRole('button', { name: /^Avisos: \d+ sin leer$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const sheet = page.getByRole('dialog', { name: 'Avisos' });
  await expect(sheet.getByRole('link', { name: /Te toca poner .+ en la hucha/ })).toBeVisible();
  await expect(sheet).not.toContainText(/Mamá|tu lista|reserv|compr|sorpresa|presupuesto/i);
  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  const read = page.getByRole('button', { name: 'Avisos', exact: true });
  await expect(read).toBeVisible();
  // Leídos no es borrados: siguen en la hoja hasta que lleguen otros o se recargue.
  await read.click();
  await expect(page.getByRole('list', { name: 'Avisos ya vistos' }).getByRole('link', { name: /Te toca poner/ })).toBeVisible();
  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Avisos' })).toContainText('Estás al día');
});
