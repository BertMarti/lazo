import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
    // El enlace va por WhatsApp: se apunta en vez de abrirse.
    Object.defineProperty(navigator, 'share', { value: undefined });
    window.open = (url) => {
      (window as unknown as { sent: string }).sent = String(url);
      return null;
    };
  });
});

const lostPhone = async (page: import('@playwright/test').Page) => {
  await page.goto('/#/g/navidad');
  await page.getByRole('button', { name: 'Invitar a la familia' }).click();
  const row = page.getByRole('list', { name: 'Ya están dentro' }).getByRole('listitem').filter({ hasText: 'Papá' });
  await row.getByRole('button', { name: 'Ha perdido el móvil' }).click();
  await expect(row.getByText('Se cerrará su sesión en el móvil perdido. Conserva su lista y todo lo suyo.')).toBeVisible();
  await row.getByRole('button', { name: 'Sí, liberar su sitio' }).click();
  return row;
};

test('quien organiza libera la plaza de quien perdió el móvil y le envía un enlace nuevo', async ({ page }) => {
  const row = await lostPhone(page);
  await row.getByRole('button', { name: 'Enviar enlace nuevo' }).click();
  const sent = decodeURIComponent(await page.waitForFunction(() => (window as unknown as { sent?: string }).sent).then((h) => h.jsonValue() as Promise<string>));
  expect(sent).toMatch(/^https:\/\/wa\.me\/\?text=Papá, este es tu enlace/);
  const link = /(https?:\/\/\S+#\/unirse\/\w+)/.exec(sent)![1]!;
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Eres Papá' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Navidad en familia' })).toBeVisible();
  // Su plaza de siempre: la P de Papá y sus 3 regalos, sin nada de lo que le regalan.
  const mine = page.locator('.member', { has: page.getByRole('link', { name: 'Tu lista' }) });
  await expect(mine).toContainText('3 regalos');
  await expect(mine.locator('.avatar')).toHaveText('P');
});

test('al abrir el enlace se ven las caras de quien ya está, y la plaza liberada con su color', async ({ page }) => {
  await page.goto('/#/unirse/demoGeneralNavidad2026xx');
  const faces = page.getByRole('img', { name: 'Ya hay 5 personas dentro' });
  await expect(faces).toBeVisible();
  await expect(faces.locator('.avatar')).toHaveCount(5);
  await expect(faces).toHaveText('AJSMP');
  await lostPhone(page);
  await page.goto('/#/unirse/demoGeneralNavidad2026xx');
  await expect(page.getByRole('img', { name: 'Ya hay 4 personas dentro' })).toBeVisible();
  await expect(page.locator('.choice', { hasText: 'Papá' }).locator('.avatar')).toHaveAttribute('data-flavor', 'canela');
  await expect(page.locator('.choice', { hasText: 'Tía Loli' }).locator('.avatar')).toHaveAttribute('data-flavor', 'almendra');
});
