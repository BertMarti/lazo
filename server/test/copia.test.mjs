// POST /api/lazo/restore (copia del grupo) contra un PocketBase real.
// Uso: npm run build:server && PB_BIN=/ruta/pocketbase node --test server/test/copia.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = 19100 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');

let dir, proc, su;
const tok = {};
const uid = {};

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
const gift = (title, o = {}) => ({ title, priority: 2, quantity: 1, ...o });
const itemsOf = async (list) => (await ok('GET', `/api/collections/items/records?perPage=500&filter=${encodeURIComponent(`list = "${list}"`)}`, null, su)).items;

describe('copia del grupo: POST /api/lazo/restore', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  let group, lists, other;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-copia-'));
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
    for (const [who, name] of [['ana', 'Ana'], ['bea', 'Bea']]) {
      const u = await ok('POST', '/api/collections/users/records', { email: `${who}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name }, su);
      uid[who] = u.id;
      tok[who] = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
    }
    group = await ok('POST', '/api/collections/groups/records', { name: 'Navidad 2027', occasion: 'navidad', buyMode: 'mixto', plazas: ['Bea', 'Carlos'] }, tok.ana);
    lists = Object.fromEntries((await ok('GET', `/api/collections/lists/records?filter=${encodeURIComponent(`group = "${group.id}"`)}`, null, tok.ana)).items.map((l) => [l.name, l]));
    other = await ok('POST', '/api/collections/groups/records', { name: 'Otro', occasion: 'otro', buyMode: 'mixto' }, tok.bea);
  });
  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('sin sesión, sin ser admin o en un grupo ajeno: no', async () => {
    const body = { group: group.id, lists: [{ list: lists.Bea.id, items: [gift('Libro')] }] };
    assert.equal((await call('POST', '/api/lazo/restore', body)).status, 401);
    assert.equal((await call('POST', '/api/lazo/restore', body, tok.bea)).status, 403);
    const otherList = (await ok('GET', `/api/collections/lists/records?filter=${encodeURIComponent(`group = "${other.id}"`)}`, null, tok.bea)).items[0];
    assert.equal((await call('POST', '/api/lazo/restore', { group: group.id, lists: [{ list: otherList.id, items: [gift('Libro')] }] }, tok.ana)).status, 400);
    assert.equal((await itemsOf(lists.Bea.id)).length, 0);
  });

  test('valida tipos y topes, y es todo o nada', async () => {
    const bad = [
      [{ list: lists.Bea.id, items: [gift('Libro')] }, { list: lists.Carlos.id, items: [gift('x'.repeat(201))] }],
      [{ list: lists.Bea.id, items: [gift('Libro', { priceCents: 1.5 })] }],
      [{ list: lists.Bea.id, items: [gift('Libro', { priority: 9 })] }],
      [{ list: lists.Bea.id, items: [{ title: 42 }] }],
      [{ list: lists.Bea.id, items: Array.from({ length: 301 }, (_, i) => gift(`R${i}`)) }],
      [{ list: lists.Bea.id, items: [] }, { list: lists.Bea.id, items: [] }],
      'no-es-una-lista',
    ];
    for (const l of bad) assert.equal((await call('POST', '/api/lazo/restore', { group: group.id, lists: l }, tok.ana)).status, 400, JSON.stringify(l).slice(0, 80));
    for (const l of Object.values(lists)) assert.equal((await itemsOf(l.id)).length, 0, `quedó algo en ${l.name}`);
  });

  test('crea regalos normales en la plaza propia y en las libres; nada de estados', async () => {
    const r = await ok(
      'POST',
      '/api/lazo/restore',
      {
        group: group.id,
        lists: [
          { list: lists.Ana.id, items: [gift('Bufanda', { priceCents: 2500, url: 'https://tienda.example/bufanda' })] },
          { list: lists.Bea.id, items: [gift('Puzle', { secret: true, removed: true, createdBy: uid.bea, reservas: [{ quien: 'Ana' }] }), gift('Libro', { url: 'javascript:alert(1)' })] },
        ],
      },
      tok.ana,
    );
    assert.equal(r.created, 3);
    const bea = await itemsOf(lists.Bea.id);
    assert.deepEqual(bea.map((i) => i.title).sort(), ['Libro', 'Puzle']);
    for (const i of bea) {
      assert.equal(i.secret, false);
      assert.equal(i.removed, false);
      assert.equal(i.createdBy, uid.ana);
      assert.equal(i.url, '');
    }
    const [bufanda] = await itemsOf(lists.Ana.id);
    assert.equal(bufanda.priceCents, 2500);
    // Ana ve sus regalos como siempre; nadie ha reservado ni aportado nada.
    assert.equal((await ok('GET', `/api/collections/items/records?filter=${encodeURIComponent(`list = "${lists.Ana.id}"`)}`, null, tok.ana)).items.length, 1);
    assert.equal((await ok('GET', '/api/collections/claims/records', null, su)).totalItems, 0);
    assert.equal((await ok('GET', '/api/collections/contributions/records', null, su)).totalItems, 0);
  });

  test('cuando ya ha entrado alguien, el grupo deja de ser «recién creado»', async () => {
    await ok('PATCH', `/api/collections/groups/records/${group.id}`, { 'members+': uid.bea }, su);
    const r = await call('POST', '/api/lazo/restore', { group: group.id, lists: [{ list: lists.Carlos.id, items: [gift('Tren')] }] }, tok.ana);
    assert.equal(r.status, 400);
    assert.match(r.json.message, /recién creado/);
    assert.equal((await itemsOf(lists.Carlos.id)).length, 0);
  });
});
