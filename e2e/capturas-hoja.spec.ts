import { test } from '@playwright/test';

// Capturas de la hoja «Añadir a tu lista» (AG, v1.1): 1280 en oscuro y 375 en claro.
// CAPTURAS=docs/design/v1.1/antes npx playwright test e2e/capturas-hoja.spec.ts --project=escritorio
const dir = process.env.CAPTURAS;
test.skip(!dir, 'Solo cuando se piden capturas');

const sizes = [
  { name: 'anadir-1280-oscuro', width: 1280, height: 800, scheme: 'dark' as const },
  { name: 'anadir-375', width: 375, height: 812, scheme: 'light' as const },
];

for (const s of sizes) {
  test(`captura ${s.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'Un solo proyecto: el tamaño lo fija la prueba');
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.emulateMedia({ colorScheme: s.scheme, reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:vista-explicada', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    });
    await page.goto('/#/l/l-alberto/nuevo');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/${s.name}.png` });
  });
}
