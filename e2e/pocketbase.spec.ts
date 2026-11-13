import { expect, test, type APIRequestContext } from '@playwright/test';

// v1.1.2: contra PocketBase real (e2e/pocketbase-servidor.mjs), no la demo. En producción, en un grupo recién creado,
// «Añadir» en «Tu lista» dejaba la pantalla en negro: api.me() devolvía un objeto nuevo en cada render y la lista
// entraba en un bucle de renders (React #185). En la demo no pasaba.
test.skip(!process.env.PB_BIN, 'Falta PB_BIN (binario de PocketBase)');

const SU = { identity: 'su@lazo.invalid', password: 'superuser-de-pruebas-123' };

/** Una persona nueva con su grupo recién creado: su lista vacía y plazas libres, como en la captura del fallo. */
async function grupoNuevo(request: APIRequestContext) {
  const post = async (path: string, data: object, token?: string) => {
    const r = await request.post(path, { data, headers: token ? { Authorization: token } : {} });
    expect(r.ok(), `${path} → ${r.status()} ${await r.text()}`).toBe(true);
    return r.json();
  };
  const su = (await post('/api/collections/_superusers/auth-with-password', SU)).token;
  const n = Math.random().toString(36).slice(2, 10);
  const u = await post('/api/collections/users/records', { email: `${n}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: 'Alberto' }, su);
  const { token, record } = await post(`/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su);
  const g = await post('/api/collections/groups/records', { name: 'Navidad 2026', occasion: 'navidad', date: '2026-12-24', currency: 'EUR', buyMode: 'mixto', allowNewNames: false, plazas: ['Juan Carlos', 'Mamá', 'Papá'] }, token);
  return { token, record, group: g.id as string };
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`grupo recién creado: «Añadir» en tu lista vacía abre la hoja (${colorScheme === 'dark' ? 'oscuro' : 'claro'})`, async ({ page, request }) => {
    const { token, record, group } = await grupoNuevo(request);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(([t, r]) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, record: r })), [token, record] as const);

    await page.goto(`/#/g/${group}`);
    const mia = page.locator('.member[data-mine]');
    await expect(mia).toContainText('Aún no has pedido nada');
    await mia.getByRole('button', { name: 'Añadir' }).click();

    await expect(page).toHaveURL(/#\/l\/\w+\/nuevo$/);
    await expect(page.getByRole('dialog', { name: 'Añadir a tu lista' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Tu lista' })).toBeVisible();
    await expect(page.getByText('Algo ha fallado en esta pantalla')).toHaveCount(0);
    expect(errores).toEqual([]);
  });
}

test('servidor real con la importación de Amazon apagada: el enlace de una lista dice cómo encenderla', async ({ page, request }) => {
  const { token, record, group } = await grupoNuevo(request);
  await page.addInitScript(([t, r]) => localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, record: r })), [token, record] as const);
  await page.goto(`/#/g/${group}`);
  await page.locator('.member[data-mine]').getByRole('button', { name: 'Añadir' }).click();
  await expect(page.getByRole('dialog', { name: 'Añadir a tu lista' })).toBeVisible();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001?ref_=wl_share');
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const aviso = page.getByRole('dialog').getByRole('status');
  await expect(aviso).toContainText('La importación automática está apagada en tu servidor.');
  await expect(aviso.locator('.amz-copiable code')).toHaveText(['AMAZON_IMPORT=on', 'cd lazo/server && docker compose up -d --build']);
});
