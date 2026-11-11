// Capturas de referencias reales para el análisis de diseño (solo lectura, headless).
// Uso: node scripts/referencias.mjs   → docs/design/referencias/*.png
import { chromium } from '@playwright/test';
const SITES = [
  ['godly', 'https://godly.website/'],
  ['onepagelove', 'https://onepagelove.com/'],
  ['babylist', 'https://www.babylist.com/'],
  ['zola-registro', 'https://www.zola.com/wedding-registry'],
  ['elfster', 'https://www.elfster.com/'],
  ['giftster', 'https://www.giftster.com/'],
];
const browser = await chromium.launch();
for (const [name, url] of SITES) {
  for (const [vp, size] of [['escritorio', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport: size, locale: 'es-ES' });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `docs/design/referencias/${name}-${vp}.png` });
      console.log('ok', name, vp);
    } catch (e) {
      console.log('fallo', name, vp, String(e).slice(0, 80));
    }
    await page.close();
  }
}
await browser.close();
