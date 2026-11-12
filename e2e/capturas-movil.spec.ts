import { test } from '@playwright/test';

// Capturas del móvil a 375 px (no son aserciones). CAPTURAS_MOVIL=docs/design/v1.0/movil/despues npx playwright test e2e/capturas-movil.spec.ts --project=movil
const dir = process.env.CAPTURAS_MOVIL;
test.skip(!dir, 'Solo cuando se piden capturas');
test.use({ viewport: { width: 375, height: 812 } });

const shots: [string, string, string][] = [
  ['lista-de-marta', 'alberto', '/#/l/l-marta'],
  ['grupo', 'alberto', '/#/g/navidad'],
  ['lista-propia', 'alberto', '/#/l/l-alberto'],
];

for (const [name, who, url] of shots) {
  test(name, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'Solo en el móvil');
    await page.addInitScript((w) => {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', w);
      sessionStorage.setItem('lazo:inicio', '1');
    }, who);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  });
}
