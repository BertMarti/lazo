import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Alberto organiza «Navidad en familia»: descarga la copia y crea con ella un grupo nuevo, sin reservas.
test('copia del grupo: descargar y crear un grupo desde ella', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('lazo:e2e')) return;
    sessionStorage.setItem('lazo:e2e', '1');
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
    localStorage.setItem('lazo:explicado', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
  await page.goto('/#/ajustes');
  // V-28: en la demo no hay sesión que cerrar, solo un aviso.
  await expect(page.getByRole('region', { name: 'Sesión' })).toContainText('En la demo no hay sesión que cerrar');
  const block = page.getByRole('region', { name: 'Copia del grupo' });
  await expect(block).toContainText('Las reservas, compras y aportaciones no se copian');

  const wait = page.waitForEvent('download');
  await block.getByRole('button', { name: 'Descargar copia' }).click();
  const file = await wait;
  expect(file.suggestedFilename()).toMatch(/^lazo-navidad-en-familia-\d{4}-\d{2}-\d{2}\.json$/);
  const text = readFileSync((await file.path())!, 'utf8');
  const copia = JSON.parse(text);
  expect(copia).toMatchObject({ lazo: 'copia-grupo', version: 1 });
  const mine = copia.listas.find((l: { name: string }) => l.name === 'Alberto');
  expect(Object.keys(mine).sort()).toEqual(['kind', 'name', 'regalos']);
  // V-27: ni de la propia plaza ni de las ajenas: solo los regalos pedidos.
  expect(text).not.toMatch(/reservas|aportaciones|sorpresas|retirados|presupuesto/);

  await block.locator('input[type=file]').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(text, 'utf8') });
  await expect(page).toHaveURL(/#\/g\/(?!navidad)\w+$/);
  await expect(page.getByText('Grupo creado. Envía a cada persona su enlace.')).toBeVisible();
  const familia = page.getByRole('list', { name: 'Familia' });
  await expect(familia.getByRole('listitem')).toHaveCount(6);
  await expect(familia).toContainText('Tía Loli');
  await expect(familia).not.toContainText(/reserv|comprad/i);

  // Un archivo que no es una copia se rechaza con una frase clara.
  await page.goto('/#/ajustes');
  await page.getByRole('region', { name: 'Copia del grupo' }).locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"lazo":"otra"}') });
  await expect(page.getByRole('alert')).toHaveText('Este archivo no es una copia de Lazo válida.');
});
