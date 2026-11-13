import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Primer arranque del APK sin invitación (?bienvenida=1 solo existe con VITE_DEMO).
// bypassCSP: la CSP solo deja conectar con 'self' y page.route no vería las peticiones a los Lazos de mentira.
test.use({ bypassCSP: true });

const open = async (page: Page, inset = 0) => {
  // Lo mismo que hace SystemBars de Capacitor 8 (insetsHandling «css») en el móvil.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?bienvenida=1');
  if (inset) await page.evaluate((px) => document.documentElement.style.setProperty('--safe-area-inset-top', `${px}px`), inset);
  await expect(page.getByRole('heading', { level: 1, name: 'Te damos la bienvenida a Lazo' })).toBeVisible();
};

test('tres caminos y la demo', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Me han invitado/ }).click();
  await page.getByLabel('Enlace de invitación').fill('hola');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('no parece una invitación');
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: /Quiero organizar un grupo/ }).click();
  const guia = page.getByRole('link', { name: 'Abrir la guía' });
  await expect(guia).toHaveAttribute('href', 'https://github.com/BertMarti/lazo/blob/main/docs/PRUEBA-REAL.md');
  await expect(guia).toHaveAttribute('target', '_blank');
  await expect(page.getByText('lazo-alta')).toBeVisible();
  await page.getByRole('button', { name: 'Ya tengo mi código' }).click();
  await expect(page.getByLabel('Dirección de tu Lazo')).toBeVisible();
  await expect(page.getByText(/la misma con la que empiezan los enlaces de invitación/)).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();

  await page.getByRole('button', { name: 'Probar la demo' }).click();
  await expect(page.locator('.demo-bar')).toBeVisible();
});

test('tengo un código: comprueba la conexión antes de canjearlo', async ({ page }) => {
  await page.route('https://apagado.test/api/health', (r) => r.abort('connectionrefused'));
  await page.route('https://otra-web.test/api/health', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mi blog</h1>' }));
  await page.route('https://milazo.test/api/health', (r) => r.fulfill({ json: { code: 200, message: 'API is healthy.', data: {} } }));
  let claimed = '';
  await page.route('https://milazo.test/api/lazo/device-claim', (r) => {
    claimed = r.request().postDataJSON().code;
    return r.fulfill({ status: 400, json: { status: 400, message: 'Ese código no vale o ha caducado.', data: {} } });
  });
  await open(page);
  await page.getByRole('button', { name: /Tengo un código/ }).click();
  const dir = page.getByLabel('Dirección de tu Lazo');
  await page.getByLabel('Código de 8 caracteres').fill('ABCD2345');
  const entrar = page.getByRole('button', { name: 'Entrar' });

  await dir.fill('https://apagado.test');
  await entrar.click();
  await expect(page.getByRole('alert')).toHaveText('No encuentro tu Lazo en esa dirección. Revisa que esté bien escrita y que el servidor esté encendido.');

  await dir.fill('https://otra-web.test/inicio');
  await entrar.click();
  await expect(page.getByRole('alert')).toContainText('Esa dirección no es un Lazo');

  await dir.fill('https://milazo.test');
  await entrar.click();
  await expect.poll(() => claimed).toBe('ABCD2345');
});

test('nada queda bajo la barra de estado', async ({ page }) => {
  await open(page, 48);
  for (const sel of ['.brand', 'h1']) expect((await page.locator(sel).first().boundingBox())!.y).toBeGreaterThanOrEqual(48);
  await page.getByRole('button', { name: 'Probar la demo' }).click();
  expect((await page.locator('.demo-bar').boundingBox())!.y).toBeGreaterThanOrEqual(48);
  // Al hacer scroll, la franja de papel tapa lo que pasa por debajo de la hora.
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').height)).toBe('48px');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe, táctil y 14 px en la bienvenida (${scheme})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'Solo en el móvil');
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    for (const door of [null, /Me han invitado/, /Tengo un código/, /Quiero organizar/]) {
      if (door) await page.getByRole('button', { name: door }).click();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(r.violations.map((x) => x.id)).toEqual([]);
      const bad = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main *, header *')].flatMap((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return [];
          const out: string[] = [];
          if (el.matches('a, button, input') && !el.closest('p, li > span, small') && r.height < 44) out.push(`${el.tagName} ${Math.round(r.height)}px de alto`);
          if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(el).fontSize) < 14)
            out.push(`«${el.textContent!.trim().slice(0, 20)}» a ${getComputedStyle(el).fontSize}`);
          return out;
        }),
      );
      expect(bad, bad.join('\n')).toEqual([]);
      await page.setViewportSize({ width: 320, height: 700 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await page.setViewportSize({ width: 412, height: 839 });
      if (door) await page.getByRole('button', { name: 'Volver' }).click();
    }
  });
}

// Capturas a 390 px (no son aserciones): docs/capturas/bienvenida/.
for (const scheme of ['light', 'dark'] as const) {
  test(`captura bienvenida ${scheme}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'Solo en el móvil');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, 32);
    const shot = (name: string) => page.screenshot({ path: `docs/capturas/bienvenida/${name}-${scheme === 'light' ? 'claro' : 'oscuro'}.png`, fullPage: true });
    await shot('inicio');
    for (const [name, door] of [['invitado', /Me han invitado/], ['codigo', /Tengo un código/], ['organizar', /Quiero organizar/]] as const) {
      await page.getByRole('button', { name: door }).click();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await shot(name);
      await page.getByRole('button', { name: 'Volver' }).click();
    }
  });
}
