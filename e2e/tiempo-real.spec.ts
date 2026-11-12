import { expect, test, type Page } from '@playwright/test';
import type { DemoApi } from '../src/api/demo';

// Tiempo real en la demo: otra persona reserva desde la API de la demo (window.__lazoDemo, solo con VITE_DEMO)
// y la lista abierta se actualiza sola, sin recargar la página.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
  });
});

/** Samira reserva el cuchillo de Juan Carlos sin tocar la pantalla. */
const samiraReserves = (page: Page) =>
  page.evaluate(async () => {
    const demo = (window as unknown as { __lazoDemo: DemoApi }).__lazoDemo;
    const me = demo.me().id;
    const item = (await demo.listDetail('l-juancarlos')).items.find((i) => i.title.includes('Cuchillo de chef'))!;
    demo.setViewer('samira');
    try {
      await demo.gift({ action: 'reserve', item: item.id, kind: 'self' });
    } finally {
      demo.setViewer(me);
    }
  });

test('una reserva de otra persona aparece sola en la lista abierta', async ({ page }) => {
  await page.goto('/#/l/l-juancarlos');
  const card = page.locator('.gift', { hasText: 'Cuchillo de chef' });
  await expect(card.getByText('Libre')).toBeVisible();
  await page.evaluate(() => Object.assign(window, { __sinRecargar: true }));
  await samiraReserves(page);
  await expect(card.getByText('Lo reserva Samira')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar)).toBe(true);
});

test('el dueño de la lista no nota nada cuando le reservan', async ({ page }) => {
  await page.goto('/#/l/l-juancarlos');
  await page.getByLabel('Ver como').selectOption('juancarlos');
  await expect(page.getByText('Lo que te regalan es sorpresa: aquí solo ves lo que has pedido.')).toBeVisible();
  const before = await page.locator('main').innerText();
  await samiraReserves(page);
  await page.waitForTimeout(500);
  expect(await page.locator('main').innerText()).toBe(before);
  await expect(page.locator('main .gifts .seal, main .gifts .band, main .gift-foot, main .budget-panel')).toHaveCount(0);
});
