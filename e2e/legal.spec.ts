import { expect, test } from '@playwright/test';

const BASE = 'https://github.com/BertMarti/lazo/blob/main/docs/legal';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('lazo-demo-v4:viewer', 'alberto');
    localStorage.setItem('lazo:vista-explicada', '1');
    sessionStorage.setItem('lazo:inicio', '1');
  });
});

// Ajustes enlaza los tres textos legales en GitHub, en pestaña nueva y sin dar acceso a la ventana.
test('Ajustes enlaza privacidad, menores y términos', async ({ page }) => {
  await page.goto('/#/ajustes');
  const box = page.getByRole('region', { name: 'Privacidad y legal' });
  await expect(box.getByText(/Tus datos se quedan en el servidor de tu casa/)).toBeVisible();
  for (const [name, doc] of [['Privacidad', 'PRIVACIDAD'], ['Datos de los niños', 'MENORES'], ['Términos de uso', 'TERMINOS']]) {
    const a = box.getByRole('link', { name, exact: true });
    await expect(a).toHaveAttribute('href', `${BASE}/${doc}.md`);
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('al entrar por un enlace se ve el aviso de términos y privacidad', async ({ page }) => {
  await page.goto('/#/unirse/demoGeneralNavidad2026xx');
  await expect(page.getByText('Al entrar aceptas los')).toBeVisible();
  await expect(page.getByRole('link', { name: 'términos', exact: true })).toHaveAttribute('href', `${BASE}/TERMINOS.md`);
  await expect(page.getByRole('link', { name: 'privacidad', exact: true })).toHaveAttribute('href', `${BASE}/PRIVACIDAD.md`);
});
