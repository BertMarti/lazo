// Pruebas de la REGLA contra un PocketBase real (migración + hooks de server/pb).
// Uso: PB_BIN=/ruta/pocketbase node --test server/test/rules.test.mjs   (en CI lo descarga el workflow)
// Para cada miembro de la familia de ejemplo se comprueba que su propia lista no le devuelve nada por
// ninguna vía (list, view, expand, filtros, back-relations, @collection, recuentos) y que las ajenas sí.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = 18090 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const FAMILY = ['alberto', 'juancarlos', 'samira', 'mama', 'papa'];
const NAMES = { alberto: 'Alberto', juancarlos: 'Juan Carlos', samira: 'Samira', mama: 'Mamá', papa: 'Papá' };

let dir, proc, su;
const ids = {}; // usuario → id; lista → id…
const tok = {}; // usuario → token

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

describe('reglas de visibilidad en PocketBase', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-pb-'));
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

    // Familia: usuarios creados por el superusuario y tokens por suplantación.
    for (const who of FAMILY) {
      const u = await ok('POST', '/api/collections/users/records', { email: `${who}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: NAMES[who] }, su);
      ids[who] = u.id;
      tok[who] = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
    }
    // Alberto crea el grupo (el hook le crea su lista) e invita; el resto entra por el enlace con su sesión.
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Navidad en familia', occasion: 'navidad', currency: 'EUR' }, tok.alberto);
    ids.group = g.id;
    const inv = await ok('POST', '/api/lazo/invite', { group: g.id }, tok.alberto);
    for (const who of FAMILY.slice(1)) await ok('POST', '/api/lazo/join', { token: inv.token, name: NAMES[who] }, tok[who]);
    const lists = (await ok('GET', `/api/collections/lists/records?perPage=50`, null, tok.alberto)).items;
    for (const who of FAMILY) ids[`l-${who}`] = lists.find((l) => l.user === ids[who]).id;

    // Cada persona: 2 regalos; el siguiente de la familia reserva uno y aporta al otro; el anterior fija su presupuesto.
    for (const [i, who] of FAMILY.entries()) {
      const next = FAMILY[(i + 1) % FAMILY.length];
      const prev = FAMILY[(i + FAMILY.length - 1) % FAMILY.length];
      const a = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `Regalo A de ${who}`, priceCents: 5000, priority: 1, quantity: 1, createdBy: ids[who] }, tok[who]);
      const b = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `Regalo B de ${who}`, priceCents: 9000, priority: 2, quantity: 1, createdBy: ids[who] }, tok[who]);
      ids[`a-${who}`] = a.id;
      ids[`b-${who}`] = b.id;
      await ok('POST', '/api/collections/claims/records', { item: a.id, user: ids[next], status: 'reserved' }, tok[next]);
      await ok('POST', '/api/collections/contributions/records', { item: b.id, user: ids[next], amountCents: 3000 }, tok[next]);
      await ok('POST', '/api/collections/budgets/records', { list: ids[`l-${who}`], amountCents: 20000 }, tok[prev]);
    }
  });

  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  for (const who of FAMILY) {
    test(`${who}: su lista no le devuelve reservas, aportaciones ni presupuesto por ninguna vía`, async () => {
      const t = tok[who];
      const L = ids[`l-${who}`];
      const A = ids[`a-${who}`];
      const q = (s) => encodeURIComponent(s);
      for (const col of ['claims', 'contributions']) {
        const r = await ok('GET', `/api/collections/${col}/records?filter=${q(`item.list = "${L}"`)}`, null, t);
        assert.equal(r.totalItems, 0, `${col} por filtro`);
        const all = await ok('GET', `/api/collections/${col}/records?perPage=500`, null, t);
        assert.ok(all.items.every((x) => x.item !== A && x.item !== ids[`b-${who}`]), `${col} sin filtro`);
      }
      assert.equal((await ok('GET', `/api/collections/budgets/records?filter=${q(`list = "${L}"`)}`, null, t)).totalItems, 0, 'presupuesto');
      // Vista directa por id: 404
      const claimsOfMine = await ok('GET', `/api/collections/claims/records?filter=${q(`item = "${A}"`)}`, null, su);
      assert.equal((await call('GET', `/api/collections/claims/records/${claimsOfMine.items[0].id}`, null, t)).status, 404);
      // Sondeos desde items: back-relations y @collection bloqueados
      for (const filter of [`claims_via_item.id != ""`, `@collection.claims.item ?= id`]) {
        assert.equal((await call('GET', `/api/collections/items/records?filter=${q(filter)}`, null, t)).status, 403, filter);
      }
      assert.equal((await call('GET', `/api/collections/items/records/${A}?expand=claims_via_item`, null, t)).status, 403, 'expand');
      assert.equal((await call('GET', `/api/collections/lists/records/${L}?expand=budgets_via_list`, null, t)).status, 403, 'expand presupuesto');
      // No puede reservar ni aportar en su lista, y el intento no revela nada
      const r = await call('POST', '/api/collections/claims/records', { item: A, user: ids[who], status: 'reserved' }, t);
      assert.ok(r.status === 400 || r.status === 403, `reserva propia → ${r.status}`);
      assert.doesNotMatch(r.text, /adelantado|reservado/i);
      assert.ok((await call('POST', '/api/collections/budgets/records', { list: L, amountCents: 1 }, t)).status >= 400);
    });

    test(`${who}: en las listas de los demás lo ve todo`, async () => {
      const others = FAMILY.filter((x) => x !== who);
      const claims = await ok('GET', '/api/collections/claims/records?perPage=500', null, tok[who]);
      const contribs = await ok('GET', '/api/collections/contributions/records?perPage=500', null, tok[who]);
      const budgets = await ok('GET', '/api/collections/budgets/records?perPage=500', null, tok[who]);
      for (const o of others) {
        assert.ok(claims.items.some((c) => c.item === ids[`a-${o}`]), `reserva de ${o}`);
        assert.ok(contribs.items.some((c) => c.item === ids[`b-${o}`]), `aportación de ${o}`);
        assert.ok(budgets.items.some((b) => b.list === ids[`l-${o}`]), `presupuesto de ${o}`);
      }
      assert.equal(budgets.items.length, others.length);
    });
  }

  test('alguien de fuera no ve nada y una invitación falsa no sirve', async () => {
    const out = await ok('POST', '/api/collections/users/records', { email: 'fuera@lazo.invalid', password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: 'Fuera' }, su);
    const t = (await ok('POST', `/api/collections/users/impersonate/${out.id}`, { duration: 600 }, su)).token;
    for (const col of ['groups', 'lists', 'items', 'claims', 'contributions', 'budgets', 'draws', 'assignments']) {
      assert.equal((await ok('GET', `/api/collections/${col}/records`, null, t)).totalItems, 0, col);
    }
    assert.equal((await ok('GET', '/api/collections/users/records', null, t)).totalItems, 1, 'solo se ve a sí mismo');
    assert.equal((await call('POST', '/api/lazo/join', { token: 'A'.repeat(32), name: 'X' })).status, 400);
    assert.equal((await call('GET', '/api/collections/invites/records', null, tok.alberto)).status, 403);
  });

  test('amigo invisible: cada uno ve solo su asignación, también quien organiza', async () => {
    await ok('POST', '/api/lazo/draw', { group: ids.group, participants: FAMILY.map((w) => ids[w]), exclusions: [[ids.mama, ids.papa]] }, tok.alberto);
    const seen = new Set();
    for (const who of FAMILY) {
      const r = await ok('GET', '/api/collections/assignments/records', null, tok[who]);
      assert.equal(r.totalItems, 1, who);
      assert.equal(r.items[0].giver, ids[who]);
      assert.notEqual(r.items[0].receiver, ids[who]);
      seen.add(r.items[0].receiver);
    }
    assert.equal(seen.size, FAMILY.length);
    assert.equal((await call('POST', '/api/lazo/draw', { group: ids.group, participants: [] }, tok.samira)).status, 403, 'solo admins');
  });
});
