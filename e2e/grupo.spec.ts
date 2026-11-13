import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      localStorage.clear();
      sessionStorage.setItem('e2e', '1');
      sessionStorage.setItem('lazo:inicio', '1');
    }
  });
});

test('Papá sale del grupo: su sitio queda libre y lo que reservó para Javier se suelta', async ({ page }) => {
  await page.goto('/#/l/l-javier');
  await page.getByLabel('Ver como').selectOption('alberto');
  const juego = page.locator('.gift', { hasText: 'Juego de mesa cooperativo' });
  await expect(juego.getByText('Lo reserva Papá')).toBeVisible();

  await page.goto('/#/g/navidad');
  await page.getByLabel('Ver como').selectOption('papa');
  await expect(page.getByRole('button', { name: 'Eliminar grupo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Salir del grupo' }).click();
  const dialog = page.getByRole('alertdialog', { name: '¿Salir de «Navidad en familia»?' });
  await expect(dialog).toContainText('Tu lista y tus regalos se quedan en el grupo como un sitio libre.');
  await expect(dialog).toContainText('Lo que ya compraste o pagaste se queda apuntado.');
  await dialog.getByRole('button', { name: 'Sí, salir del grupo' }).click();
  await expect(page.getByRole('status')).toContainText('Has salido de «Navidad en familia».');
  await expect(page.locator('.group-card', { hasText: 'Navidad en familia' })).toHaveCount(0);
  await expect(page.locator('.group-card', { hasText: 'Cumpleaños de Marta' })).toBeVisible();

  // Alberto ve la plaza de Papá libre y el juego, otra vez libre
  await page.getByLabel('Ver como').selectOption('alberto');
  await page.goto('/#/l/l-javier');
  await expect(juego.getByText('Libre')).toBeVisible();
  // Y Javier sigue sin ver nada de lo suyo
  await page.getByLabel('Ver como').selectOption('javier');
  await expect(page.locator('main .gifts .seal, main .gifts .band, main .gift-foot, main .budget-panel')).toHaveCount(0);
});

test('quien lleva la hucha no puede salir, y quien no creó el grupo no puede eliminarlo', async ({ page }) => {
  await page.goto('/#/g/navidad');
  await page.getByLabel('Ver como').selectOption('samira');
  await expect(page.getByText('Llevas las cuentas de la hucha, así que no puedes salir del grupo.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salir del grupo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Eliminar grupo' })).toHaveCount(0);
});

test('Alberto elimina el grupo: botón rojo solo para él, diálogo sencillo y no queda nada', async ({ page }) => {
  await page.goto('/#/g/navidad');
  // Nadie más ve el botón
  for (const who of ['javier', 'samira', 'marta', 'papa']) {
    await page.getByLabel('Ver como').selectOption(who);
    await expect(page.getByRole('button', { name: 'Eliminar grupo' })).toHaveCount(0);
  }
  await page.getByLabel('Ver como').selectOption('alberto');
  await expect(page.getByRole('button', { name: 'Salir del grupo' })).toHaveCount(0);
  const boton = page.getByRole('button', { name: 'Eliminar grupo' });
  await expect(boton).toHaveClass(/btn-danger/);
  await boton.click();
  const dialog = page.getByRole('alertdialog', { name: '¿Eliminar «Navidad en familia»?' });
  await expect(dialog).toContainText('Se borrarán las listas, las reservas y la hucha para todos. No se puede deshacer.');
  // Sin escribir nada: dos botones y la copia como enlace secundario
  await expect(dialog.getByRole('textbox')).toHaveCount(0);

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Descargar antes una copia' }).click();
  expect((await download).suggestedFilename()).toMatch(/^lazo-navidad-en-familia-\d{4}-\d{2}-\d{2}\.json$/);

  // Cancelar cierra sin borrar
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await boton.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('«Navidad en familia» se ha eliminado.');
  await expect(page.locator('.group-card', { hasText: 'Navidad en familia' })).toHaveCount(0);

  // Para nadie: Samira solo tiene ya el cumpleaños, y el enlace viejo del grupo ya no abre nada
  await page.getByLabel('Ver como').selectOption('samira');
  await expect(page.locator('.group-card', { hasText: 'Cumpleaños de Marta' })).toBeVisible();
  await expect(page.locator('.group-card', { hasText: 'Navidad en familia' })).toHaveCount(0);
  await page.goto('/#/unirse/demoGeneralNavidad2026xx');
  await expect(page.getByText('Esta invitación no existe o ha caducado.')).toBeVisible();
});
