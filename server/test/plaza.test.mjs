// La plaza es la identidad; la cuenta, la llave. Contra un PocketBase real, como rules.test.mjs.
// Uso: npm run build:server && PB_BIN=/ruta/pocketbase node --test server/test/plaza.test.mjs
// 1) Bea pierde el móvil: Ana libera su plaza, la cuenta vieja ya no puede tocar nada y la nueva lo recupera todo.
// 2) Las caras del enlace: solo inicial y color de quien ya está; un enlace usado o falso responde igual que siempre.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = 19100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const q = encodeURIComponent;

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
const total = async (col, t, filter) => (await ok('GET', `/api/collections/${col}/records?perPage=500${filter ? `&filter=${q(filter)}` : ''}`, null, t)).totalItems;

describe('plazas: perder el móvil y las caras del enlace', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-plaza-'));
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
    const ana = await ok('POST', '/api/collections/users/records', { email: 'ana@lazo.invalid', password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: 'Ana', color: 'menta' }, su);
    ids.ana = ana.id;
    tok.ana = (await ok('POST', `/api/collections/users/impersonate/${ana.id}`, { duration: 3600 }, su)).token;
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Navidad', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', allowNewNames: false, plazas: ['Bea', 'Carlos', 'Tía Dani'] }, tok.ana);
    ids.group = g.id;
    for (const l of (await ok('GET', '/api/collections/lists/records', null, tok.ana)).items) ids[`l-${l.name}`] = l.id;
    // Bea y Carlos entran con su enlace personal desde un móvil sin cuenta (como en la vida real).
    for (const who of ['Bea', 'Carlos']) {
      const inv = await ok('POST', '/api/lazo/invite', { group: g.id, list: ids[`l-${who}`] }, tok.ana);
      const r = await ok('POST', '/api/lazo/join', { token: inv.token });
      tok[who] = r.token;
      ids[who] = r.record.id;
    }
  });

  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('perder el móvil: la cuenta vieja deja de poder actuar y la nueva recupera la plaza', async () => {
    const old = tok.Bea;
    const L = ids['l-Bea'];
    const C = ids['l-Carlos'];
    const mine = await ok('POST', '/api/collections/items/records', { list: L, title: 'Bufanda', priceCents: 2000, priority: 2, quantity: 1, createdBy: ids.Bea }, old);
    const forCarlos = await ok('POST', '/api/collections/items/records', { list: C, title: 'Libro', priceCents: 1500, priority: 2, quantity: 1, createdBy: ids.Carlos }, tok.Carlos);
    const other = await ok('POST', '/api/collections/items/records', { list: C, title: 'Taza', priceCents: 900, priority: 2, quantity: 1, createdBy: ids.Carlos }, tok.Carlos);
    const surprise = await ok('POST', '/api/collections/items/records', { list: C, title: 'Sorpresa para Carlos', priceCents: 1000, priority: 2, quantity: 1, createdBy: ids.Bea, secret: true }, old);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: forCarlos.id, kind: 'self' }, old);
    const myClaim = (await ok('GET', `/api/collections/claims/records?filter=${q(`item = "${forCarlos.id}"`)}`, null, su)).items[0].id;
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: mine.id, kind: 'self' }, tok.Carlos);

    // Solo quien organiza libera, y nunca la suya
    assert.equal((await call('POST', '/api/lazo/plaza-release', { list: L }, tok.Carlos)).status, 403);
    assert.equal((await call('POST', '/api/lazo/plaza-release', { list: ids['l-Ana'] }, tok.ana)).status, 403);
    await ok('POST', '/api/lazo/plaza-release', { list: L }, tok.ana);

    // La cuenta del móvil perdido ya no ve ni toca nada del grupo
    for (const col of ['groups', 'lists', 'items', 'claims', 'contributions', 'budgets', 'payments']) assert.equal(await total(col, old), 0, `vieja: ${col}`);
    assert.ok((await call('POST', '/api/collections/items/records', { list: L, title: 'Colada', priceCents: 1, priority: 2, quantity: 1, createdBy: ids.Bea }, old)).status >= 400, 'vieja: añadir a la plaza');
    assert.ok((await call('PATCH', `/api/collections/items/records/${mine.id}`, { title: 'Cambiado' }, old)).status >= 400, 'vieja: editar');
    assert.ok((await call('DELETE', `/api/collections/items/records/${mine.id}`, null, old)).status >= 400, 'vieja: quitar');
    assert.ok((await call('PATCH', `/api/collections/items/records/${surprise.id}`, { title: 'X' }, old)).status >= 400, 'vieja: su sorpresa');
    assert.ok((await call('POST', '/api/lazo/gift', { action: 'release', claim: myClaim }, old)).status >= 400, 'vieja: soltar su reserva');
    assert.ok((await call('POST', '/api/lazo/gift', { action: 'reserve', item: other.id, kind: 'self' }, old)).status >= 400, 'vieja: reservar');
    assert.ok((await call('POST', '/api/lazo/invite', { group: ids.group }, old)).status >= 400, 'vieja: invitar');
    // Ni vuelve a entrar con el enlace general en otra plaza: puede pedirlo, pero aceptarlo falla (V-5)
    const general = await ok('POST', '/api/lazo/invite', { group: ids.group }, tok.ana);
    const asked = await ok('POST', '/api/lazo/join', { token: general.token, list: ids['l-Tía Dani'] }, old);
    assert.equal(asked.meta.pending, true);
    assert.equal(await total('lists', old), 0, 'vieja: pendiente no lee nada');
    assert.equal((await call('POST', '/api/lazo/join-decide', { request: asked.meta.request, accept: true }, tok.ana)).status, 400);
    await ok('POST', '/api/lazo/join-decide', { request: asked.meta.request, accept: false }, tok.ana);

    // Enlace nuevo → móvil nuevo sin cuenta: recupera la plaza con todo lo suyo
    const inv = await ok('POST', '/api/lazo/invite', { group: ids.group, list: L }, tok.ana);
    assert.equal((await ok('POST', '/api/lazo/invite-info', { token: inv.token })).personal.name, 'Bea');
    const r = await ok('POST', '/api/lazo/join', { token: inv.token });
    const now = r.token;
    const me = r.record.id;
    assert.notEqual(me, ids.Bea);
    assert.equal((await ok('GET', `/api/collections/lists/records/${L}`, null, now)).user, me);
    const own = (await ok('GET', `/api/collections/items/records?filter=${q(`list = "${L}"`)}`, null, now)).items;
    assert.deepEqual(own.map((i) => i.title), ['Bufanda']);
    // La regla de oro sigue: no ve la reserva de Carlos en su lista
    assert.equal(await total('claims', now, `item.list = "${L}"`), 0);
    // Su reserva y su sorpresa pasan a la cuenta nueva y puede seguir con ellas
    const claims = (await ok('GET', `/api/collections/claims/records?filter=${q(`item = "${forCarlos.id}"`)}`, null, now)).items;
    assert.equal(claims.length, 1);
    assert.equal(claims[0].user, me);
    await ok('PATCH', `/api/collections/items/records/${surprise.id}`, { title: 'Sorpresa cambiada' }, now);
    await ok('POST', '/api/lazo/gift', { action: 'release', claim: claims[0].id }, now);
    await ok('PATCH', `/api/collections/items/records/${mine.id}`, { title: 'Bufanda roja' }, now);
    // Y la vieja sigue fuera
    assert.equal(await total('lists', old), 0);
    tok.Bea = now;
    ids.Bea = me;
  });

  test('las caras del enlace: inicial y color de quien ya está, sin ids ni correos', async () => {
    const general = await ok('POST', '/api/lazo/invite', { group: ids.group }, tok.ana);
    const r = await call('POST', '/api/lazo/invite-info', { token: general.token });
    assert.equal(r.status, 200);
    const users = (await ok('GET', '/api/collections/users/records?perPage=50', null, su)).items;
    const colorOf = (name) => users.find((u) => u.name === name).color;
    assert.deepEqual(r.json.faces.map((f) => f.initial).sort(), ['A', 'B', 'C']);
    assert.ok(r.json.faces.every((f) => Object.keys(f).sort().join() === 'color,initial'));
    assert.ok(r.json.faces.some((f) => f.initial === 'A' && f.color === 'menta'));
    assert.ok(r.json.faces.some((f) => f.initial === 'C' && f.color === colorOf('Carlos')));
    assert.deepEqual(r.json.free.map((f) => f.name), ['Tía Dani']);
    // Ni ids de cuentas ni correos en ningún sitio de la respuesta
    for (const u of users) {
      assert.ok(!r.text.includes(u.id), `id de ${u.name}`);
      assert.ok(!r.text.includes(u.email), `correo de ${u.name}`);
    }
    assert.doesNotMatch(r.text, /@lazo\.invalid|"user"|"email"/);
    // Enlace personal: también las caras, y la plaza liberada trae el color de quien la tuvo
    await ok('POST', '/api/lazo/plaza-release', { list: ids['l-Carlos'] }, tok.ana);
    const inv = await ok('POST', '/api/lazo/invite', { group: ids.group, list: ids['l-Carlos'] }, tok.ana);
    const p = await ok('POST', '/api/lazo/invite-info', { token: inv.token });
    assert.deepEqual(p.faces.map((f) => f.initial).sort(), ['A', 'B']);
    assert.equal(p.personal.color, colorOf('Carlos'));
    // Usado o falso: la misma respuesta de siempre, sin caras ni nombres (PB-17)
    await ok('POST', '/api/lazo/join', { token: inv.token });
    const used = await call('POST', '/api/lazo/invite-info', { token: inv.token });
    const fake = await call('POST', '/api/lazo/invite-info', { token: 'Z'.repeat(32) });
    const bad = await call('POST', '/api/lazo/invite-info', { token: 'corto' });
    assert.equal(used.status, 400);
    assert.equal(used.status, fake.status);
    assert.equal(used.text, fake.text);
    assert.equal(used.text, bad.text);
    assert.doesNotMatch(used.text, /faces|Ana|Bea|Carlos|initial/);
  });
});
