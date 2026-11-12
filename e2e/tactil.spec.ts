import { expect, test } from '@playwright/test';

// Repaso con taste-skill (SKILLS.md): todo control fuera del texto corrido mide al menos 44 px de alto
// en el móvil, y nada se sale de la pantalla a 320 px.
const routes = ['/#/', '/#/g/navidad', '/#/l/l-mama', '/#/l/l-alberto', '/#/hucha/navidad', '/#/compras', '/#/sorteo/navidad', '/#/ajustes'];

for (const url of routes) {
  test(`tamaño táctil y sin desbordes: ${url}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'Solo en el móvil');
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
      localStorage.setItem('lazo:vista-explicada', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    });
    await page.goto(url);
    await page.waitForTimeout(400);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('a, button, select, input:not([type=hidden]), textarea, [role=button]')]
        .filter((el) => {
          // Un enlace estirado (::after absoluto) toca en toda su tarjeta.
          const stretched = getComputedStyle(el, '::after').position === 'absolute' && el.offsetParent instanceof HTMLElement;
          const r = (stretched ? (el.offsetParent as HTMLElement) : el).getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false;
          if (el.closest('p, li > span, small, .meta')) return false; // enlace dentro de texto corrido
          if (el.matches('input[type=radio], input[type=checkbox]') && el.closest('label')) return false; // cuenta la etiqueta
          return r.height < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className} «${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}» ${Math.round(el.getBoundingClientRect().height)}px`),
    );
    expect(small, small.join('\n')).toEqual([]);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}
