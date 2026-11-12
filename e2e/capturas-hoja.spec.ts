import { test, type Page } from '@playwright/test';

// Capturas de la hoja «Añadir a tu lista» (AG, v1.1) y de la importación de Amazon: 1280 en oscuro y 375 en claro.
// CAPTURAS=docs/design/v1.1/despues npx playwright test e2e/capturas-hoja.spec.ts --project=escritorio
const dir = process.env.CAPTURAS;
test.skip(!dir, 'Solo cuando se piden capturas');

const sizes = [
  { name: '1280-oscuro', width: 1280, height: 800, scheme: 'dark' as const },
  { name: '375', width: 375, height: 812, scheme: 'light' as const },
];
const shots: [string, string, ((p: Page) => Promise<void>)?][] = [
  ['anadir', '/#/l/l-alberto/nuevo'],
  ['amazon-pasos', '/#/l/l-alberto/amazon'],
  ['amazon-vista', '/#/l/l-alberto/amazon', (p) => p.getByRole('button', { name: 'Probar con una lista de ejemplo' }).click()],
];

for (const s of sizes) {
  for (const [name, url, act] of shots) {
    test(`captura ${name}-${s.name}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'escritorio', 'Un solo proyecto: el tamaño lo fija la prueba');
      await page.setViewportSize({ width: s.width, height: s.height });
      await page.emulateMedia({ colorScheme: s.scheme, reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
        localStorage.setItem('lazo:vista-explicada', '1');
        sessionStorage.setItem('lazo:inicio', '1');
      });
      await page.goto(url);
      await page.waitForTimeout(800);
      if (act) await act(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/${name}-${s.name}.png` });
    });
  }
}
