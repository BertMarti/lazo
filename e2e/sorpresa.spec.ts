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
    await expect(mine.getByText('Lo que te regalan es sorpresa')).toBeVisible();
    await expect(mine.locator('.budget')).toHaveCount(0);
    await expect(page.locator('.member .budget')).toHaveCount(5); // las otras 4 plazas + la plaza libre de Tía Loli
    // Su lista: sin sellos, precintos, estados ni presupuesto.
    await page.goto(`/#/l/l-${id}`);
    await expect(page.getByText('Lo que te regalan es sorpresa: aquí solo ves lo que has pedido.')).toBeVisible();
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
  await card.getByRole('button', { name: 'Me lo reservo' }).click();
  await expect(card.getByText('Lo reservas tú')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Reservado. Juan Carlos no lo verá.');
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
  await expect(card.getByText('Libre')).toBeVisible();
  // «Ya comprado» en 2 toques, con el precio prerrellenado
  await card.getByRole('button', { name: 'Para la hucha' }).click();
  await expect(card.getByText(/Para la hucha · lo apuntaste tú/)).toBeVisible();
  await card.getByRole('button', { name: 'Ya comprado' }).click(); // 1
  await expect(page.getByLabel('¿Cuánto costó?')).toHaveValue('79,00');
  await page.getByRole('button', { name: 'Guardar' }).click(); // 2
  await expect(card.getByText(/Comprado con la hucha · lo adelantaste tú/)).toBeVisible();
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

test('entrar con el enlace general: pendiente con código hasta que el admin acepta', async ({ page }) => {
  await page.goto('/#/g/navidad');
  await page.getByRole('link', { name: 'Probar a entrar' }).click();
  await expect(page.getByRole('heading', { name: '¿Quién eres?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Mamá' })).toHaveCount(0); // ocupada: no se puede elegir
  await page.getByRole('radio', { name: 'Tía Loli' }).check();
  await page.getByRole('button', { name: 'Soy Tía Loli' }).click();
  const code = (await page.locator('.code').textContent())!.trim();
  expect(code).toMatch(/^\d{4}$/);
  await page.getByLabel('Ver como').selectOption('alberto');
  await page.goto('/#/g/navidad');
  await expect(page.getByText(`código ${code}`)).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.locator('.member', { hasText: 'Tía Loli' }).getByText('Aún no ha entrado')).toHaveCount(0);
});

test('al volver a abrir el enlace general sigue el código, sin pedir entrar otra vez', async ({ page }) => {
  await page.goto('/#/unirse/demoGeneralNavidad2026xx');
  await page.getByRole('radio', { name: 'Tía Loli' }).check();
  await page.getByRole('button', { name: 'Soy Tía Loli' }).click();
  const code = (await page.locator('.code').textContent())!.trim();
  expect(code).toMatch(/^\d{4}$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ya casi estás, Tía Loli' })).toBeVisible();
  await expect(page.locator('.code')).toHaveText(code);
  await expect(page.getByRole('heading', { name: '¿Quién eres?' })).toHaveCount(0);
  const wa = page.getByRole('link', { name: 'Mandar por WhatsApp' });
  await expect(wa).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(`Hola, Alberto. Soy Tía Loli. Mi código de Lazo es ${code}.`)}`);
});

test('la hucha de Papá no dice nada de lo que se gasta en él', async ({ page }) => {
  await page.goto('/#/hucha/navidad');
  await page.getByLabel('Ver como').selectOption('papa');
  await expect(page.getByText('Aquí no sale lo que se gasta en ti')).toBeVisible();
  await expect(page.locator('.rows li', { hasText: /^P/ }).filter({ hasText: 'Papá' })).toHaveCount(0);
  await expect(page.getByText('Te falta poner')).toBeVisible();
});

test('qué ve Mamá: explicado la primera vez, luego plegado tras el icono; las cuentas, en «Ver cuentas»', async ({ page }) => {
  await page.goto('/#/l/l-mama');
  await page.getByLabel('Ver como').selectOption('alberto');
  const why = page.getByText('Mamá ve su lista, pero no quién reserva');
  await expect(page.getByText('Mamá no ve lo que reserváis')).toBeVisible();
  await expect(why).toBeVisible();
  await page.reload();
  await expect(why).toBeHidden();
  await page.getByRole('button', { name: 'Qué ve Mamá' }).click();
  await expect(why).toBeVisible();
  const panel = page.locator('.budget-panel');
  await expect(panel.locator('.budget-big')).toHaveText(/^Quedan /);
  await expect(panel.getByText(/Lo pagáis entre/)).toBeHidden();
  await panel.getByText('Ver cuentas').click();
  await expect(panel.getByText(/Lo pagáis entre \d+: .+ cada uno\./)).toBeVisible();
  await expect(panel.getByText('Mamá no ve esto')).toBeVisible();
});

test('la banda de la demo cabe en una línea de 44 px a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/#/l/l-mama');
  await page.getByLabel('Ver como').selectOption('juancarlos'); // el nombre más largo
  const bar = page.getByRole('region', { name: 'Demo' });
  expect((await bar.boundingBox())!.height).toBe(44);
  await expect(bar.getByRole('link', { name: 'Probar a entrar' })).toBeInViewport({ ratio: 1 });
});
