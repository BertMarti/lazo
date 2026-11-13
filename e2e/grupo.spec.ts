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
  await expect(page.getByRole('button', { name: 'Eliminar el grupo' })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Eliminar el grupo' })).toHaveCount(0);
});

test('Alberto elimina el grupo: copia antes, nombre exacto y no queda nada', async ({ page }) => {
  await page.goto('/#/g/navidad');
  await page.getByLabel('Ver como').selectOption('alberto');
  await expect(page.getByRole('button', { name: 'Salir del grupo' })).toHaveCount(0);
  await expect(page.getByText('pasar el grupo a otra persona, y eso aún no se puede')).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar el grupo' }).click();
  const dialog = page.getByRole('alertdialog', { name: '¿Eliminar «Navidad en familia» para todos?' });
  await expect(dialog).toContainText('la hucha y sus pagos, el sorteo del amigo invisible y todos los enlaces');

  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Descargar una copia antes' }).click();
  expect((await download).suggestedFilename()).toMatch(/^lazo-navidad-en-familia-\d{4}-\d{2}-\d{2}\.json$/);

  const borrar = dialog.getByRole('button', { name: 'Eliminar el grupo' });
  await expect(borrar).toBeDisabled();
  const name = dialog.getByLabel(/escribe el nombre del grupo/);
  await name.fill('Navidad');
  await expect(borrar).toBeDisabled();
  await name.fill('Navidad en familia');
  await expect(borrar).toBeEnabled();
  await borrar.click();
  await expect(page.getByRole('status')).toContainText('«Navidad en familia» se ha eliminado.');
  await expect(page.locator('.group-card', { hasText: 'Navidad en familia' })).toHaveCount(0);

  // Para nadie: Samira solo tiene ya el cumpleaños, y el enlace viejo del grupo ya no abre nada
  await page.getByLabel('Ver como').selectOption('samira');
  await expect(page.locator('.group-card', { hasText: 'Cumpleaños de Marta' })).toBeVisible();
  await expect(page.locator('.group-card', { hasText: 'Navidad en familia' })).toHaveCount(0);
  await page.goto('/#/unirse/demoGeneralNavidad2026xx');
  await expect(page.getByText('Esta invitación no existe o ha caducado.')).toBeVisible();
});
