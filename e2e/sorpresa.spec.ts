import { expect, test } from '@playwright/test';

const FAMILY = [
  ['alberto', 'Alberto'],
  ['juancarlos', 'Juan Carlos'],
  ['samira', 'Samira'],
  ['mama', 'Mamá'],
  ['papa', 'Papá'],
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
  });
});

for (const [id, name] of FAMILY) {
  test(`${name} no ve reservas ni presupuesto en su lista, y sí en las demás`, async ({ page }) => {
    await page.goto('/#/g/navidad');
    await page.getByLabel('Ver como').selectOption(id);
    // Su tarjeta en el grupo: sin barra ni cifras.
    const mine = page.locator('.member', { has: page.getByRole('link', { name: 'Tu lista' }) });
    await expect(mine.getByText('Tu presupuesto y tus reservas son sorpresa')).toBeVisible();
    await expect(mine.locator('.budget')).toHaveCount(0);
    await expect(page.locator('.member .budget')).toHaveCount(4);
    // Su lista: sin sellos, precintos, estados ni presupuesto.
    await page.goto(`/#/l/l-${id}`);
    await expect(page.getByText('Tú no ves quién te regala qué. Los demás sí.')).toBeVisible();
    await expect(page.locator('main .gifts .seal, main .gifts .band, main .gift-foot, main .budget-panel')).toHaveCount(0);
  });
}

test('Mamá no ve que Alberto le ha reservado el marco; Samira sí, con su nombre', async ({ page }) => {
  await page.goto('/#/l/l-mama');
  await page.getByLabel('Ver como').selectOption('samira');
  await expect(page.locator('.gift', { hasText: 'Marco digital de fotos' }).getByText('Lo reserva Alberto')).toBeVisible();
  await expect(page.getByText('Mamá no ve esto').first()).toBeVisible();
  await page.getByLabel('Ver como').selectOption('mama');
  await expect(page.getByText('Lo reserva Alberto')).toHaveCount(0);
});

test('reservar es un toque y se puede deshacer', async ({ page }) => {
  await page.goto('/#/l/l-juancarlos');
  const card = page.locator('.gift', { hasText: 'Cuchillo de chef' });
  await card.getByRole('button', { name: 'Reservar' }).click();
  await expect(card.getByText('Lo reservas tú')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Reservado. Juan Carlos no lo verá.');
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
  await expect(card.getByText('Libre')).toBeVisible();
});

test('añadir un regalo pegando un enlace son dos toques', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Permisos de portapapeles solo en Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#/g/navidad');
  await page.evaluate(() => navigator.clipboard.writeText('Mira esto https://www.amazon.es/dp/B0ABCDEF12?tag=x'));
  await page.getByRole('button', { name: 'Añadir', exact: true }).click(); // 1
  await page.getByRole('button', { name: /^Pegar/ }).click(); // 2
  await expect(page.getByRole('heading', { name: 'Añadido a tu lista' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Altavoz inteligente compacto')).toBeVisible();
});
