// E2E del flujo completo contra un PocketBase real (migraciones + hooks de server/pb), como rules.test.mjs.
// Uso: npm run build:server && PB_BIN=/ruta/pocketbase node --test server/test/flujo.test.mjs
// Ana crea el grupo y lleva la hucha; Carlos es el suplente. Bea y Ana son las «dueñas» que se vigilan:
// en cada paso se comprueba que no ven nada de lo suyo y que las cuentas de todos cuadran con src/core/hucha.ts.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BIN = process.env.PB_BIN;
const PORT = 18600 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const PEOPLE = ['ana', 'bea', 'carlos', 'dani'];
const USERS = [...PEOPLE, 'fuera'];
const NAMES = { ana: 'Ana', bea: 'Bea', carlos: 'Carlos', dani: 'Dani', fuera: 'Fuera' };
const q = encodeURIComponent;

let dir, proc, su, H;
const ids = {};
const tok = {};

async function call(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, json: text ? JSON.parse(text) : null, text };
}
const ok = async (...a) => {
  const r = await call(...a);
  assert.ok(r.status < 300, `${a[0]} ${a[1]} → ${r.status} ${r.text}`);
  return r.json;
};
const get = async (col, t, extra = '') => (await ok('GET', `/api/collections/${col}/records?perPage=500&sort=id${extra}`, null, t)).items;

/** La regla de oro para `who` sobre su plaza: ni reservas, ni aportaciones, ni presupuesto, ni sorpresas. */
async function blind(who, step) {
  const t = tok[who];
  const L = ids[`l-${who}`];
  for (const col of ['claims', 'contributions']) {
    assert.equal((await get(col, t, `&filter=${q(`item.list = "${L}"`)}`)).length, 0, `${step} · ${who}: ${col} de su plaza`);
  }
  assert.equal((await get('budgets', t, `&filter=${q(`list = "${L}"`)}`)).length, 0, `${step} · ${who}: presupuesto`);
  const own = await get('items', t, `&filter=${q(`list = "${L}"`)}`);
  assert.ok(own.every((i) => !i.secret), `${step} · ${who}: sorpresas`);
  const mine = new Set(own.map((i) => i.id));
  assert.ok((await get('claims', t)).every((c) => !mine.has(c.item)), `${step} · ${who}: reservas sin filtro`);
  return own;
}

// Cuentas de la hucha con core/hucha tal cual (mismo montaje que PB-13 en rules.test.mjs).
const rows = async (t) => {
  const g = await ok('GET', `/api/collections/groups/records/${ids.group}?expand=members`, null, t);
  const lists = (await get('lists', t)).filter((l) => l.group === ids.group);
  const items = (await get('items', t)).filter((i) => lists.some((l) => l.id === i.list));
  const claims = (await get('claims', t)).filter((c) => items.some((i) => i.id === c.item)).map((c) => ({ ...c, kind: c.kind || 'self', paidBy: c.paidBy || undefined, paidCents: c.status === 'bought' ? c.paidCents : undefined }));
  const payments = (await get('payments', t)).filter((p) => p.group === ids.group);
  return { g, lists, items, claims, payments };
};
const sums = (who, d) => {
  const userOf = (l) => d.lists.find((x) => x.id === l)?.user || undefined;
  const ctx = { me: ids[who], members: d.g.expand.members.map((m) => m.id), lists: d.lists, items: d.items, claims: d.claims, payments: d.payments, treasurer: userOf(d.g.treasurer), deputy: userOf(d.g.deputy), treasurerList: d.g.treasurer || undefined };
  const name = (id) => PEOPLE.find((p) => ids[p] === id);
  return {
    due: H.due(ctx.me, ctx),
    shares: H.myShares(ctx).map((s) => ({ list: s.list.id, spent: s.spent, mine: s.mine, advanced: s.advanced })),
    table: Object.fromEntries(H.collectTable(ctx).map((r) => [name(r.who), r.due])),
  };
};
/** Lo esperado: todas las filas (superusuario) menos las de su plaza y los pagos en los que no es parte. */
const expected = async (who) => {
  const d = await rows(su);
  const own = new Set(d.items.filter((i) => i.list === ids[`l-${who}`]).map((i) => i.id));
  return sums(who, { ...d, items: d.items.filter((i) => !own.has(i.id)), claims: d.claims.filter((c) => !own.has(c.item)), payments: d.payments.filter((p) => p.from === ids[who] || p.to === ids[who]) });
};
const accounts = async (step) => {
  const out = {};
  for (const who of PEOPLE) {
    out[who] = sums(who, await rows(tok[who]));
    assert.deepEqual(out[who], await expected(who), `${step} · ${who}: cuentas`);
  }
  return out;
};

describe('flujo completo: grupo → invitación → plaza → reserva → hucha → ajuste de cuentas', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-flujo-'));
    cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
    cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
    const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
    execFileSync(BIN, ['migrate', 'up', ...flags]);
    execFileSync(BIN, ['superuser', 'upsert', 'su@lazo.invalid', 'superuser-de-pruebas-123', ...flags]);
    proc = spawn(BIN, ['serve', `--http=127.0.0.1:${PORT}`, ...flags], { stdio: 'ignore', env: { ...process.env, UNFURL_KEY: 'x'.repeat(32) } });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(BASE + '/api/health')).ok) break;
      } catch {
        /* arrancando */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    su = (await ok('POST', '/api/collections/_superusers/auth-with-password', { identity: 'su@lazo.invalid', password: 'superuser-de-pruebas-123' })).token;
    for (const who of USERS) {
      const u = await ok('POST', '/api/collections/users/records', { email: `${who}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: NAMES[who] }, su);
      ids[who] = u.id;
      tok[who] = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
    }
    const out = join(dir, 'hucha.mjs');
    (await import('esbuild')).buildSync({ entryPoints: [resolve(import.meta.dirname, '..', '..', 'src/core/hucha.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
    H = await import(pathToFileURL(out).href);
  });

  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('1. Ana crea el grupo con las plazas de la familia', async () => {
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Navidad', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', allowNewNames: false, plazas: ['Bea', 'Carlos', 'Dani'] }, tok.ana);
    ids.group = g.id;
    const lists = await get('lists', tok.ana);
    assert.deepEqual(lists.map((l) => l.name).sort(), ['Ana', 'Bea', 'Carlos', 'Dani']);
    ids['l-ana'] = lists.find((l) => l.user === ids.ana).id;
    for (const who of ['bea', 'carlos', 'dani']) ids[`l-${who}`] = lists.find((l) => l.name === NAMES[who]).id;
    await blind('ana', 'grupo');
  });

  test('2. invitación con enlace personal y 3. cada uno reclama su plaza', async () => {
    for (const who of ['bea', 'carlos', 'dani']) {
      const inv = await ok('POST', '/api/lazo/invite', { group: ids.group, list: ids[`l-${who}`] }, tok.ana);
      assert.equal((await ok('POST', '/api/lazo/invite-info', { token: inv.token })).personal.name, NAMES[who]);
      // Antes de entrar no ve nada del grupo
      assert.equal((await get('groups', tok[who])).length, 0, `${who} antes de entrar`);
      await ok('POST', '/api/lazo/join', { token: inv.token }, tok[who]);
      // El enlace es de un solo uso
      assert.equal((await call('POST', '/api/lazo/join', { token: inv.token }, tok.fuera)).status, 400, 'enlace reutilizado');
    }
    const g = await ok('GET', `/api/collections/groups/records/${ids.group}`, null, tok.bea);
    assert.equal(g.members.length, 4);
    for (const who of PEOPLE) assert.equal((await ok('GET', `/api/collections/lists/records/${ids[`l-${who}`]}`, null, su)).user, ids[who]);
    // Tesorera Ana, suplente Carlos (se fija una vez, antes de comprar con la hucha)
    await ok('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-ana'], deputy: ids['l-carlos'] }, tok.ana);
    // Cada uno apunta sus deseos
    const add = async (who, key, title, priceCents) => (ids[key] = (await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title, priceCents, priority: 2, quantity: 1, createdBy: ids[who] }, tok[who])).id);
    await add('bea', 'bea-libro', 'Libro', 2500);
    await add('bea', 'bea-bici', 'Bici', 3200);
    await add('bea', 'bea-cascos', 'Cascos', 6000);
    await add('ana', 'ana-bufanda', 'Bufanda', 2800);
    ids.beaOwn = JSON.stringify(await blind('bea', 'plazas'));
    await blind('ana', 'plazas');
  });

  test('4. reservas, aportación, presupuesto y sorpresa: Bea no ve nada de su lista', async () => {
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids['bea-libro'], kind: 'self' }, tok.carlos);
    await ok('POST', '/api/collections/contributions/records', { item: ids['bea-cascos'], user: ids.dani, amountCents: 1500 }, tok.dani);
    await ok('POST', '/api/collections/budgets/records', { list: ids['l-bea'], amountCents: 10000 }, tok.carlos);
    const s = await ok('POST', '/api/collections/items/records', { list: ids['l-bea'], title: 'Sorpresa para Bea', priceCents: 1800, priority: 2, quantity: 1, createdBy: ids.carlos, secret: true }, tok.carlos);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: s.id, kind: 'self' }, tok.carlos);
    // Bea no puede reservar lo suyo y el intento no delata si está cogido
    const r1 = await call('POST', '/api/lazo/gift', { action: 'reserve', item: ids['bea-libro'], kind: 'self' }, tok.bea);
    const r2 = await call('POST', '/api/lazo/gift', { action: 'reserve', item: ids['bea-bici'], kind: 'self' }, tok.bea);
    assert.equal(r1.status, 403);
    assert.equal(r1.text, r2.text);
    // Los demás sí lo ven todo
    assert.equal((await get('claims', tok.dani, `&filter=${q(`item.list = "${ids['l-bea']}"`)}`)).length, 2);
    assert.equal((await get('budgets', tok.dani, `&filter=${q(`list = "${ids['l-bea']}"`)}`)).length, 1);
    assert.equal(JSON.stringify(await blind('bea', 'reservas')), ids.beaOwn, 'Bea ve su lista igual que antes');
    await blind('ana', 'reservas');
  });

  test('5. hucha: se apunta y se compra; ni Bea ni Ana (tesorera) ven lo de su plaza', async () => {
    // Dani apunta la bici de Bea a la hucha y la compra adelantando 30 €
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids['bea-bici'], kind: 'pot' }, tok.dani);
    const c = (await get('claims', tok.dani, `&filter=${q(`item = "${ids['bea-bici']}"`)}`))[0];
    assert.equal(c.kind, 'pot');
    await ok('POST', '/api/lazo/gift', { action: 'buy', claim: c.id, paidCents: 3000, paidBy: ids.dani }, tok.dani);
    // Bea compra con la hucha la bufanda de Ana (la tesorera): esa cuenta la lleva Carlos, el suplente
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids['ana-bufanda'], kind: 'pot' }, tok.bea);
    const c2 = (await get('claims', tok.bea, `&filter=${q(`item = "${ids['ana-bufanda']}"`)}`))[0];
    await ok('POST', '/api/lazo/gift', { action: 'buy', claim: c2.id, paidCents: 2700, paidBy: ids.bea }, tok.bea);

    assert.equal(JSON.stringify(await blind('bea', 'hucha')), ids.beaOwn);
    await blind('ana', 'hucha');
    const acc = await accounts('hucha');
    // Nadie paga sus regalos: la bici (30 €) entre Ana, Carlos y Dani; la bufanda (27 €) entre Bea, Carlos y Dani.
    assert.deepEqual(acc.bea.shares, [{ list: ids['l-ana'], spent: 2700, mine: 900, advanced: 2700 }], 'Bea no ve gasto en su plaza');
    assert.deepEqual(acc.bea.due, { general: 0, aparte: -1800 });
    assert.ok(acc.ana.shares.every((s) => s.list !== ids['l-ana']), 'Ana no ve gasto en su plaza');
    assert.deepEqual(acc.ana.table, { bea: 0, carlos: 1000, dani: -2000 }, 'tabla de la tesorera');
    assert.deepEqual(acc.carlos.table, { bea: -1800, dani: 900 }, 'tabla del suplente');
    assert.deepEqual(acc.dani.due, { general: -2000, aparte: 900 });
  });

  test('6. ajuste de cuentas: pagos con la tesorera y el suplente; todo queda a cero', async () => {
    const pay = (from, to, amountCents, sub) => ok('POST', '/api/collections/payments/records', { group: ids.group, from: ids[from], to: ids[to], amountCents, sub }, tok[from]);
    // Un pago entre dos que no llevan caja no se puede apuntar
    assert.equal((await call('POST', '/api/collections/payments/records', { group: ids.group, from: ids.bea, to: ids.dani, amountCents: 100, sub: false }, tok.bea)).status, 400);
    await pay('carlos', 'ana', 1000, false);
    await pay('ana', 'dani', 2000, false);
    await pay('dani', 'carlos', 900, true);
    await pay('carlos', 'bea', 1800, true);
    // Cada pago lo ven solo sus dos partes; la tesorera nunca ve los de la cuenta de sus regalos
    assert.ok((await get('payments', tok.ana)).every((p) => !p.sub));
    assert.equal((await get('payments', tok.bea)).length, 1);
    assert.equal(JSON.stringify(await blind('bea', 'ajuste')), ids.beaOwn);
    await blind('ana', 'ajuste');
    const acc = await accounts('ajuste');
    for (const who of PEOPLE) assert.deepEqual(acc[who].due, { general: 0, aparte: 0 }, `${who} al día`);
    assert.deepEqual(acc.ana.table, { bea: 0, carlos: 0, dani: 0 });
    assert.deepEqual(acc.carlos.table, { bea: 0, dani: 0 });
  });
});
