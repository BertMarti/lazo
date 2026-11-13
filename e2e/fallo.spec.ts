import { expect, test } from '@playwright/test';

// Error boundary global (src/ui/ErrorBoundary.tsx): un fallo en una pantalla nunca la deja vacía.
// ?fallo solo existe con VITE_DEMO: rompe la pantalla a propósito.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`un fallo en la pantalla muestra el aviso, no una pantalla vacía (${colorScheme === 'dark' ? 'oscuro' : 'claro'})`, async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
    await page.emulateMedia({ colorScheme });
    await page.goto('/?fallo=1#/');

    const aviso = page.getByRole('alert').filter({ hasText: 'Algo ha fallado en esta pantalla' });
    await expect(aviso).toBeVisible();
    await expect(aviso.getByRole('button', { name: 'Volver' })).toBeVisible();
    await expect(aviso.getByRole('button', { name: 'Recargar' })).toBeVisible();
    await expect(page.locator('.masthead')).toBeVisible(); // la app sigue ahí: cabecera y pestañas
    expect(logs.some((l) => l.includes('Lazo: fallo en la pantalla'))).toBe(true);

    // Sin el fallo forzado, la pantalla vuelve.
    await page.goto('/#/');
    await expect(page.getByRole('heading', { level: 1, name: 'Tus grupos' })).toBeVisible();
  });
}
