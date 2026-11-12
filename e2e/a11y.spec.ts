import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Accesibilidad (axe, WCAG 2.1 A y AA) en las pantallas principales, en claro y en oscuro.
const routes = ['/#/', '/#/g/navidad', '/#/l/l-mama', '/#/l/l-alberto', '/#/l/l-alberto/amazon', '/#/hucha/navidad', '/#/compras', '/#/sorteo/navidad', '/#/ajustes', '/#/unirse/demoGeneralNavidad2026xx', '/#/imprimir/l-mama', `/#/ver/${'a'.repeat(32)}`];

for (const scheme of ['light', 'dark'] as const) {
  for (const url of routes) {
    test(`axe ${scheme}: ${url}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
        localStorage.setItem('lazo:vista-explicada', '1');
        localStorage.setItem('lazo-demo-v4:shares', JSON.stringify({ ['a'.repeat(32)]: 'l-alberto' }));
        sessionStorage.setItem('lazo:inicio', '1');
      });
      await page.goto(url);
      await page.waitForTimeout(600);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const v = r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(v, v.join('\n')).toEqual([]);
    });
  }
}
