import { expect, test } from '@playwright/test';

// Un CSV como los que exporta Excel en España (punto y coma) con cabeceras raras: se adivinan, se corrigen a mano y se importan.
const CSV = [
  '  ARTÍCULO deseado ;¿Cuánto cuesta? (€);URL del producto;Tienda online;Nº de unidades;Comentarios varios;Columna X',
  'Puzle de 1000 piezas;24,95 €;https://tienda.example/puzle;Juguetería Sol;2;Para el salón;no',
  'Lámpara de lectura;39,90 €;https://tienda.example/lampara;;1;;no',
].join('\n');

test('importar un CSV con cabeceras raras', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:explicado', '1');
      sessionStorage.setItem('lazo:inicio', '1');
      sessionStorage.setItem('e2e', '1');
    }
  });
  await page.goto('/#/l/l-alberto');
  await page.getByRole('button', { name: 'Importar desde Excel' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'lista rara.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') });

  // Mapeo adivinado sin IA.
  await expect(page.getByLabel('Columna «ARTÍCULO deseado»')).toHaveValue('title');
  await expect(page.getByLabel('Columna «¿Cuánto cuesta? (€)»')).toHaveValue('price');
  await expect(page.getByLabel('Columna «URL del producto»')).toHaveValue('url');
  await expect(page.getByLabel('Columna «Tienda online»')).toHaveValue('store');
  await expect(page.getByLabel('Columna «Nº de unidades»')).toHaveValue('quantity');
  await expect(page.getByLabel('Columna «Comentarios varios»')).toHaveValue('notes');
  await expect(page.getByLabel('Columna «Columna X»')).toHaveValue('');

  // Corrección a mano: los comentarios no se importan.
  await page.getByLabel('Columna «Comentarios varios»').selectOption('');
  const preview = page.getByRole('table', { name: 'Vista previa' });
  await expect(preview.getByRole('columnheader', { name: 'Notas' })).toHaveCount(0);
  await expect(preview.getByRole('row')).toHaveCount(3);
  await expect(preview.getByRole('row', { name: /Puzle de 1000 piezas/ })).toContainText('24,95');
  await expect(preview.getByRole('row', { name: /Puzle de 1000 piezas/ })).toContainText('Juguetería Sol');

  await page.getByRole('button', { name: 'Importar 2 regalos' }).click();
  await expect(page.getByText('2 regalos importados.')).toBeVisible();
  await expect(page.locator('.gift', { hasText: 'Puzle de 1000 piezas' })).toContainText('24,95');
  await expect(page.locator('.gift', { hasText: 'Lámpara de lectura' })).toContainText('39,90');
});
