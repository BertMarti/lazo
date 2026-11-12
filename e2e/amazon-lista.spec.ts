import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { DEMO_AMAZON_HTML, DEMO_AMAZON_LISTA } from '../src/api/seed';

// Importar una lista de Amazon copiando y pegando (camino b). Lazo no hace ninguna petición a Amazon.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:vista-explicada', '1');
      sessionStorage.setItem('lazo:inicio', '1');
      sessionStorage.setItem('e2e', '1');
    }
  });
});

/** Un pegado de verdad (Ctrl+V): el evento trae text/plain y, si se copió de una página, text/html. */
const paste = (page: Page, text: string, html?: string) =>
  page.evaluate(([t, h]) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t!);
    if (h) dt.setData('text/html', h);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [text, html] as const);

test('pegar el enlace de la lista abre el modo manual; la página copiada da la vista previa con el duplicado desmarcado', async ({ page }) => {
  await page.goto('/#/l/l-alberto/nuevo');
  await expect(page.getByRole('heading', { name: 'Añadir a tu lista' })).toBeVisible();
  await paste(page, `¡Echa un vistazo a mi lista! ${DEMO_AMAZON_LISTA}`);
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Importar lista de Amazon' })).toBeVisible();
  await expect(sheet.getByRole('status')).toContainText('Lazo no entra en Amazon por ti');
  await expect(sheet.getByRole('button', { name: 'Pegar', exact: true })).toBeVisible();

  // Pegar otra vez solo el enlace: explica qué falta, sin ir a ningún sitio.
  await paste(page, DEMO_AMAZON_LISTA);
  await expect(sheet.getByRole('status')).toContainText('solo el enlace');

  await paste(page, 'texto de la página', DEMO_AMAZON_HTML);
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  await expect(sheet.getByText('1 ya está en tu lista')).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: /Teclado mecánico compacto/ })).not.toBeChecked();
  await expect(sheet.getByRole('checkbox', { name: /Termo de acero/ })).toBeChecked();
  await sheet.getByRole('button', { name: 'Añadir 7 a tu lista' }).click();
  await expect(page.getByText('7 regalos añadidos.')).toBeVisible();
  const termo = page.locator('.gift', { hasText: 'Termo de acero inoxidable de 750 ml' });
  await expect(termo).toContainText('24,95');
  await expect(page.locator('.gift', { hasText: 'Teclado mecánico compacto' })).toHaveCount(1);
});

test('la lista de ejemplo de la demo y las pestañas por dispositivo', async ({ page }, info) => {
  await page.goto('/#/l/l-alberto/nuevo');
  await page.getByRole('button', { name: 'Importar lista de Amazon' }).click();
  const sheet = page.getByRole('dialog');
  // El dispositivo sale del user agent: Pixel 7 → Android; escritorio → Ordenador.
  await expect(sheet.getByRole('radio', { name: info.project.name === 'movil' ? 'Android' : 'Ordenador' })).toBeChecked();
  await expect(sheet.getByText(info.project.name === 'movil' ? /en Chrome, no en la app/ : /Ctrl \+ A/)).toBeVisible();
  await sheet.getByRole('radio', { name: 'iPhone' }).check();
  await expect(sheet.getByText(/en Safari, no en la app/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Probar con una lista de ejemplo' }).click();
  await expect(sheet.getByText('He encontrado 8 productos.')).toBeVisible();
  await sheet.getByRole('checkbox', { name: /Termo de acero/ }).uncheck();
  await sheet.getByRole('button', { name: 'Añadir 6 a tu lista' }).click();
  await expect(page.getByText('6 regalos añadidos.')).toBeVisible();
});

test('«Pegar» lee el portapapeles con un toque (text/html)', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Permisos de portapapeles solo en Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/l/l-alberto/amazon');
  await page.evaluate((h) => navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob(['texto'], { type: 'text/plain' }) })]), DEMO_AMAZON_HTML);
  await page.getByRole('dialog').getByRole('button', { name: 'Pegar', exact: true }).click();
  await expect(page.getByText('He encontrado 8 productos.')).toBeVisible();
});

test('AMZ-9, AMZ-10 y AMZ-16: lo pegado hostil no ejecuta nada, no pide nada fuera y no se guarda', async ({ page, baseURL }) => {
  const fuera: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) fuera.push(r.url());
  });
  page.on('dialog', (d) => {
    fuera.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  await page.goto('/#/l/l-alberto/amazon');
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Importar lista de Amazon' })).toBeVisible();
  await paste(page, 'x', readFileSync('test/fixtures/amazon-lista/hostil.html', 'utf8'));
  await expect(sheet.getByText('He encontrado 3 productos.')).toBeVisible();
  await expect(sheet.getByText('<img src=x onerror=alert(1)> Taza')).toBeVisible(); // como texto
  await sheet.getByRole('button', { name: 'Añadir 3 a tu lista' }).click();
  await expect(page.getByText('3 regalos añadidos.')).toBeVisible();
  await expect(page.locator('img[src="x"], .gifts script, .gifts b')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __hostil?: number }).__hostil)).toBeUndefined();
  const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('\n'));
  expect(stored).not.toContain('onerror="alert(2)"'); // el HTML pegado no se guarda (el título, como texto, sí)
  expect(stored).not.toContain('javascript:');
  expect(fuera).toEqual([]);
});
