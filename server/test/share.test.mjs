// Enlace de solo lectura (v0.6) contra un PocketBase real: lo que sale del grupo no lleva NINGÚN estado.
// Uso: PB_BIN=/ruta/pocketbase node --test server/test/share.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = 18600 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const FAMILY = { alberto: 'Alberto', samira: 'Samira', marta: 'Marta' };

let dir, proc, su;
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
const shared = (token) => call('GET', `/api/lazo/shared/${token}`);
const FAKE = 'A'.repeat(32);

describe('enlace de solo lectura', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-pb-share-'));
    cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
    cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
    const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
    execFileSync(BIN, ['migrate', 'up', ...flags]);
    execFileSync(BIN, ['superuser', 'upsert', 'su@lazo.invalid', 'superuser-de-pruebas-123', ...flags]);
    proc = spawn(BIN, ['serve', `--http=127.0.0.1:${PORT}`, ...flags], { stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(BASE + '/api/health')).ok) break;
      } catch {
        /* arrancando */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    su = (await ok('POST', '/api/collections/_superusers/auth-with-password', { identity: 'su@lazo.invalid', password: 'superuser-de-pruebas-123' })).token;
    for (const [who, name] of Object.entries(FAMILY)) {
      const u = await ok('POST', '/api/collections/users/records', { email: `${who}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name }, su);
      ids[who] = u.id;
      tok[who] = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
    }
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Navidad', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', plazas: ['Samira', 'Marta'] }, tok.alberto);
    ids.group = g.id;
    let lists = (await ok('GET', '/api/collections/lists/records?perPage=50', null, tok.alberto)).items;
    for (const who of ['samira', 'marta']) {
      const inv = await ok('POST', '/api/lazo/invite', { group: g.id, list: lists.find((l) => l.name === FAMILY[who]).id }, tok.alberto);
      await ok('POST', '/api/lazo/join', { token: inv.token }, tok[who]);
    }
    lists = (await ok('GET', '/api/collections/lists/records?perPage=50', null, tok.alberto)).items;
    for (const who of Object.keys(FAMILY)) ids[`l-${who}`] = lists.find((l) => l.user === ids[who]).id;

    // Marta: A (reservado y comprado), B (a medias), C (reservado y luego retirado), D (libre).
    const add = (title, extra = {}) => ok('POST', '/api/collections/items/records', { list: ids['l-marta'], title, priority: 2, quantity: 1, createdBy: ids.marta, ...extra }, tok.marta);
    const A = await add('Bufanda de lana', { priceCents: 3500, priority: 1, store: 'Lanas Sol', size: 'Única', color: 'Gris', url: 'https://tienda.example/bufanda', image: 'https://tienda.example/bufanda.jpg' });
    const B = await add('Cafetera italiana', { priceCents: 6000 });
    const C = await add('Libro de recetas', { priceCents: 2000 });
    const D = await add('Calcetines', { priority: 3 });
    Object.assign(ids, { A: A.id, B: B.id, C: C.id, D: D.id });
    await ok('POST', '/api/lazo/gift', { action: 'buy', item: A.id, kind: 'self', paidCents: 3400, paidBy: ids.samira }, tok.samira);
    const ct = await ok('POST', '/api/collections/contributions/records', { item: B.id, user: ids.alberto, amountCents: 2000 }, tok.alberto);
    await ok('PATCH', `/api/collections/contributions/records/${ct.id}`, { paid: true }, tok.alberto);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: C.id, kind: 'self' }, tok.samira);
    assert.equal((await call('DELETE', `/api/collections/items/records/${C.id}`, null, tok.marta)).status, 204); // queda «removed»
    const S = await ok('POST', '/api/collections/items/records', { list: ids['l-marta'], title: 'Sorpresa: pulsera', priceCents: 4000, priority: 2, quantity: 1, createdBy: ids.samira, secret: true }, tok.samira);
    ids.S = S.id;
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: S.id, kind: 'pot' }, tok.samira);
    await ok('POST', '/api/collections/budgets/records', { list: ids['l-marta'], amountCents: 15000 }, tok.samira);
  });

  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('solo la dueña de la plaza crea el enlace', async () => {
    assert.equal((await call('POST', '/api/lazo/share', { list: ids['l-marta'] })).status, 401);
    for (const who of ['samira', 'alberto']) {
      const r = await call('POST', '/api/lazo/share', { list: ids['l-marta'] }, tok[who]);
      assert.equal(r.status, 403, who);
      assert.equal((await call('DELETE', '/api/lazo/share', { list: ids['l-marta'] }, tok[who])).status, 403, `${who} revoca`);
    }
    // Una lista que no existe responde igual que una ajena.
    const nx = await call('POST', '/api/lazo/share', { list: 'noexiste123456' }, tok.samira);
    const other = await call('POST', '/api/lazo/share', { list: ids['l-marta'] }, tok.samira);
    assert.equal(nx.text, other.text);
    const { token } = await ok('POST', '/api/lazo/share', { list: ids['l-marta'] }, tok.marta);
    assert.match(token, /^[A-Za-z0-9]{32}$/);
    ids.token = token;
  });

  test('la lista compartida no lleva estado, sorpresas, retirados ni ids', async () => {
    const r = await shared(ids.token);
    assert.equal(r.status, 200, r.text);
    assert.match(r.text, /Bufanda de lana/);
    assert.doesNotMatch(r.text, /claims|budget|paid|secret|removed|reserved|bought|contribution|members|kind|quantity/i);
    assert.doesNotMatch(r.text, /Sorpresa|pulsera|Libro de recetas|15000|3400/);
    for (const [k, v] of Object.entries(ids)) if (k !== 'token') assert.ok(!r.text.includes(v), `id ${k}`);
    assert.deepEqual(Object.keys(r.json).sort(), ['items', 'name', 'occasion']);
    assert.equal(r.json.name, 'Marta');
    assert.equal(r.json.occasion, 'navidad');
    // Cogido o libre, todos salen y en un orden que no depende del estado (prioridad y título).
    assert.deepEqual(r.json.items.map((i) => i.title), ['Bufanda de lana', 'Cafetera italiana', 'Calcetines']);
    const allowed = ['title', 'image', 'store', 'priceCents', 'currency', 'priority', 'size', 'color', 'url'];
    for (const i of r.json.items) assert.ok(Object.keys(i).every((k) => allowed.includes(k)), Object.keys(i).join());
    assert.deepEqual(r.json.items[0], { title: 'Bufanda de lana', image: 'https://tienda.example/bufanda.jpg', store: 'Lanas Sol', priceCents: 3500, currency: 'EUR', priority: 1, size: 'Única', color: 'Gris', url: 'https://tienda.example/bufanda' });
    assert.match(r.text, /^\{/);
  });

  test('token falso, malformado, rotado y revocado responden igual', async () => {
    const fake = await shared(FAKE);
    const short = await shared('abc');
    assert.equal(fake.status, 404);
    assert.equal(short.status, fake.status);
    assert.equal(short.text, fake.text);
    const old = ids.token;
    const { token } = await ok('POST', '/api/lazo/share', { list: ids['l-marta'] }, tok.marta); // rotar
    assert.notEqual(token, old);
    const rotated = await shared(old);
    assert.equal(rotated.status, fake.status);
    assert.equal(rotated.text, fake.text);
    assert.equal((await shared(token)).status, 200);
    await ok('DELETE', '/api/lazo/share', { list: ids['l-marta'] }, tok.marta);
    const revoked = await shared(token);
    assert.equal(revoked.status, fake.status);
    assert.equal(revoked.text, fake.text);
  });

  test('la colección shares no se lee ni se escribe desde la API', async () => {
    await ok('POST', '/api/lazo/share', { list: ids['l-marta'] }, tok.marta);
    for (const who of ['marta', 'samira']) {
      const r = await call('GET', '/api/collections/shares/records', null, tok[who]);
      assert.ok(r.status === 403 || (r.status === 200 && r.json.totalItems === 0), `${who}: ${r.status}`);
      assert.ok((await call('POST', '/api/collections/shares/records', { list: ids['l-marta'], tokenHash: 'x' }, tok[who])).status >= 400);
    }
    assert.ok((await call('GET', '/api/collections/shares/records')).status >= 400);
  });

  test('quien lleva la lista de un niño puede compartirla; los demás no', async () => {
    const child = await ok('POST', '/api/collections/lists/records', { group: ids.group, name: 'Lucía', kind: 'child', managers: [ids.alberto] }, tok.alberto);
    assert.equal((await call('POST', '/api/lazo/share', { list: child.id }, tok.samira)).status, 403);
    const { token } = await ok('POST', '/api/lazo/share', { list: child.id }, tok.alberto);
    const r = await shared(token);
    assert.equal(r.status, 200);
    assert.equal(r.json.name, 'Lucía');
  });

  test('límite de peticiones en el enlace público', async () => {
    const rules = (await ok('GET', '/api/settings', null, su)).rateLimits.rules;
    assert.ok(rules.some((r) => r.label === 'GET /api/lazo/shared/' && r.audience === '' && r.maxRequests <= 60));
    assert.ok(rules.some((r) => r.label === 'POST /api/lazo/share'));
  });

  test('liberar la plaza anula su enlace', async () => {
    const { token } = await ok('POST', '/api/lazo/share', { list: ids['l-marta'] }, tok.marta);
    assert.equal((await shared(token)).status, 200);
    await ok('POST', '/api/lazo/plaza-release', { list: ids['l-marta'] }, tok.alberto);
    const r = await shared(token);
    assert.equal(r.status, 404);
    assert.equal(r.text, (await shared(FAKE)).text);
  });
});
