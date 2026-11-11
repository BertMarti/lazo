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


/** Suscripción en tiempo real: devuelve el estado de la suscripción y los eventos recibidos tras `trigger`. */
async function realtime(token, subscriptions, trigger, ms = 800) {
  const ac = new AbortController();
  const res = await fetch(BASE + '/api/realtime', { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (!/"clientId":"([^"]+)"/.test(buf)) buf += dec.decode((await reader.read()).value);
  const clientId = /"clientId":"([^"]+)"/.exec(buf)[1];
  const sub = await call('POST', '/api/realtime', { clientId, subscriptions }, token);
  let events = '';
  if (sub.status < 300) {
    await trigger();
    setTimeout(() => ac.abort(), ms);
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        events += dec.decode(value);
      }
    } catch {
      /* abortado */
    }
  } else ac.abort();
  return { status: sub.status, events };
}

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
    // Alberto crea el grupo con las plazas previstas; cada uno entra con SU enlace personal (con su sesión).
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Navidad en familia', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', allowNewNames: true, plazas: [...FAMILY.slice(1).map((w) => NAMES[w]), 'Tía Loli'] }, tok.alberto);
    ids.group = g.id;
    let lists = (await ok('GET', `/api/collections/lists/records?perPage=50`, null, tok.alberto)).items;
    for (const who of FAMILY.slice(1)) {
      const plaza = lists.find((l) => l.name === NAMES[who]);
      const inv = await ok('POST', '/api/lazo/invite', { group: g.id, list: plaza.id }, tok.alberto);
      await ok('POST', '/api/lazo/join', { token: inv.token }, tok[who]);
    }
    lists = (await ok('GET', `/api/collections/lists/records?perPage=50`, null, tok.alberto)).items;
    for (const who of FAMILY) ids[`l-${who}`] = lists.find((l) => l.user === ids[who]).id;
    ids['l-loli'] = lists.find((l) => l.name === 'Tía Loli').id;

    // Cada persona: 2 regalos; el siguiente de la familia reserva uno y aporta al otro; el anterior fija su presupuesto.
    for (const [i, who] of FAMILY.entries()) {
      const next = FAMILY[(i + 1) % FAMILY.length];
      const prev = FAMILY[(i + FAMILY.length - 1) % FAMILY.length];
      const a = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `Regalo A de ${who}`, priceCents: 5000, priority: 1, quantity: 1, createdBy: ids[who] }, tok[who]);
      const b = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `Regalo B de ${who}`, priceCents: 9000, priority: 2, quantity: 1, createdBy: ids[who] }, tok[who]);
      const c = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `Regalo C de ${who}`, priceCents: 2000, priority: 3, quantity: 1, createdBy: ids[who] }, tok[who]);
      ids[`a-${who}`] = a.id;
      ids[`b-${who}`] = b.id;
      ids[`c-${who}`] = c.id;
      await ok('POST', '/api/lazo/gift', { action: 'reserve', item: a.id, kind: 'self' }, tok[next]);
      // Sorpresa del anterior, apuntada para la hucha
      const s = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `Sorpresa para ${who}`, priceCents: 1500, priority: 2, quantity: 1, createdBy: ids[prev], secret: true }, tok[prev]);
      ids[`s-${who}`] = s.id;
      await ok('POST', '/api/lazo/gift', { action: 'reserve', item: s.id, kind: 'pot' }, tok[prev]);
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
      // gift sobre lo propio: mismo 403 esté libre o reservado; la sorpresa propia, igual que un id inexistente (PB-8)
      const r = await call('POST', '/api/lazo/gift', { action: 'reserve', item: A, kind: 'self' }, t);
      const r2 = await call('POST', '/api/lazo/gift', { action: 'reserve', item: ids[`c-${who}`], kind: 'self' }, t);
      assert.equal(r.status, 403);
      assert.equal(r2.status, 403);
      assert.equal(r.text, r2.text);
      assert.doesNotMatch(r.text, /adelantado|cogido/i);
      const sp = await call('POST', '/api/lazo/gift', { action: 'reserve', item: ids[`s-${who}`], kind: 'pot' }, t);
      const nx = await call('POST', '/api/lazo/gift', { action: 'reserve', item: 'noexiste123456', kind: 'pot' }, t);
      assert.equal(sp.status, nx.status);
      assert.equal(sp.text, nx.text);
      // Sus sorpresas no existen para él, ni en el recuento
      const own = await ok('GET', `/api/collections/items/records?filter=${q(`list = "${L}"`)}`, null, t);
      assert.equal(own.totalItems, 3);
      assert.ok(own.items.every((i) => !i.secret));
      // La escritura directa en claims está cerrada para todos
      assert.ok((await call('POST', '/api/collections/claims/records', { item: A, user: ids[who], status: 'reserved', kind: 'self' }, t)).status >= 400);
      assert.ok((await call('POST', '/api/collections/budgets/records', { list: L, amountCents: 1 }, t)).status >= 400);
      // Tiempo real (auditoría R-1): ninguna variante de opciones con _via_ pasa, ni codificada.
      const touch = () => ok('PATCH', `/api/collections/items/records/${A}`, { notes: 'x' }, t);
      const opt = (o, hide) => 'items/*?options=' + hide(encodeURIComponent(JSON.stringify(o)));
      for (const topic of [
        opt({ query: { filter: 'claims_via_item.id != ""' } }, (x) => x),
        opt({ query: { filter: 'claims_via_item.id != ""' } }, (x) => x.replace(/_/g, '%5F')),
        'items/*?options=' + encodeURIComponent('{"query":{"filter":"claims\\u005fvia\\u005fitem.id != \'\'"}}'),
      ]) {
        const r = await realtime(t, [topic], touch);
        assert.equal(r.status, 403, topic);
        assert.doesNotMatch(r.events, new RegExp(A), topic);
      }
      // Y la suscripción normal a claims no trae nada de su lista cuando otro reserva.
      const other = FAMILY.find((x) => x !== who);
      const rt = await realtime(t, ['claims/*'], async () => {
        await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids[`c-${who}`], kind: 'self' }, tok[other]);
        const mine = await ok('GET', `/api/collections/claims/records?filter=${q(`item = "${ids[`c-${who}`]}"`)}`, null, tok[other]);
        await ok('POST', '/api/lazo/gift', { action: 'release', claim: mine.items[0].id }, tok[other]);
      });
      assert.equal(rt.status, 204);
      assert.doesNotMatch(rt.events, new RegExp(ids[`c-${who}`]), 'evento de reserva propia');
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
      // Las sorpresas de los demás sí se ven
      const items = await ok('GET', '/api/collections/items/records?perPage=500', null, tok[who]);
      for (const o of others) assert.ok(items.items.some((i) => i.id === ids[`s-${o}`]), `sorpresa de ${o}`);
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

  test('PB-5/6: enlace general → pendiente sin acceso; suplantación y decisiones solo de admin', async () => {
    const inv = await ok('POST', '/api/lazo/invite', { group: ids.group }, tok.alberto);
    const r = await ok('POST', '/api/lazo/join', { token: inv.token, list: ids['l-loli'] });
    assert.equal(r.meta.pending, true);
    assert.match(r.meta.code, /^\d{4}$/);
    const t = r.token;
    for (const col of ['groups', 'lists', 'items', 'claims', 'budgets']) assert.equal((await ok('GET', `/api/collections/${col}/records`, null, t)).totalItems, 0, col);
    // Mamá (ya dentro) no puede pedir otra plaza
    assert.equal((await call('POST', '/api/lazo/join', { token: inv.token, list: ids['l-loli'] }, tok.mama)).status, 400);
    // Plaza ocupada y nombre repetido
    assert.equal((await call('POST', '/api/lazo/join', { token: inv.token, list: ids['l-papa'] })).status, 400);
    assert.equal((await call('POST', '/api/lazo/join', { token: inv.token, name: 'mamá' })).status, 400);
    // Solo un admin decide; al aceptar, entra y su plaza le queda ciega
    assert.equal((await call('POST', '/api/lazo/join-decide', { request: r.meta.request, accept: true }, tok.papa)).status, 403);
    await ok('POST', '/api/lazo/join-decide', { request: r.meta.request, accept: true }, tok.alberto);
    assert.equal((await ok('GET', `/api/collections/claims/records?filter=${encodeURIComponent(`item.list = "${ids['l-loli']}"`)}`, null, t)).totalItems, 0);
    assert.equal((await ok('GET', '/api/collections/groups/records', null, t)).totalItems, 1);
    // Nadie toca a mano user/kind/via de una plaza
    assert.ok((await call('PATCH', `/api/collections/lists/records/${ids['l-papa']}`, { user: ids.alberto }, tok.alberto)).status >= 400);
    // El admin no libera la suya
    assert.equal((await call('POST', '/api/lazo/plaza-release', { list: ids['l-alberto'] }, tok.alberto)).status, 403);
  });

  test('PB-10: quitar un regalo propio responde igual esté cogido o no; los demás lo ven retirado', async () => {
    const t = tok.juancarlos;
    const taken = ids['a-juancarlos']; // reservado por Samira
    const free = (await ok('POST', '/api/collections/items/records', { list: ids['l-juancarlos'], title: 'Para quitar', priceCents: 100, priority: 2, quantity: 1, createdBy: ids.juancarlos }, t)).id;
    const r1 = await call('DELETE', `/api/collections/items/records/${taken}`, null, t);
    const r2 = await call('DELETE', `/api/collections/items/records/${free}`, null, t);
    assert.equal(r1.status, 204);
    assert.equal(r2.status, 204);
    assert.equal(r1.text, r2.text);
    assert.equal((await call('GET', `/api/collections/items/records/${taken}`, null, t)).status, 404);
    // Y el endpoint gift responde igual a un retirado que a uno que no existe (V-1)
    const g1 = await call('POST', '/api/lazo/gift', { action: 'reserve', item: taken, kind: 'self' }, t);
    const g2 = await call('POST', '/api/lazo/gift', { action: 'reserve', item: free, kind: 'self' }, t);
    assert.equal(g1.status, g2.status);
    assert.equal(g1.text, g2.text);
    const seen = await ok('GET', `/api/collections/items/records/${taken}`, null, tok.samira);
    assert.equal(seen.removed, true);
  });

  test('V-4: una solicitud pendiente no lista ni filtra nada del grupo', async () => {
    const inv = await ok('POST', '/api/lazo/invite', { group: ids.group }, tok.alberto);
    const r = await ok('POST', '/api/lazo/join', { token: inv.token, name: 'Prima Ana' });
    assert.equal((await ok('GET', '/api/collections/joinRequests/records', null, r.token)).totalItems, 0);
    assert.equal((await call('GET', `/api/collections/joinRequests/records/${r.meta.request}`, null, r.token)).status, 200);
    assert.equal((await ok('GET', `/api/collections/payments/records?filter=${encodeURIComponent('group.name != ""')}`, null, r.token)).totalItems, 0);
  });

  test('PB-12: pagos solo con el tesorero (o el suplente por sus regalos) y solo los ven sus dos partes', async () => {
    await ok('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-alberto'], deputy: ids['l-samira'] }, tok.alberto);
    assert.equal((await call('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-papa'], deputy: ids['l-mama'] }, tok.alberto)).status, 400);
    assert.ok((await call('POST', '/api/collections/payments/records', { group: ids.group, from: ids.papa, to: ids.mama, amountCents: 100, sub: false }, tok.papa)).status >= 400);
    assert.ok((await call('POST', '/api/collections/payments/records', { group: ids.group, from: ids.papa, to: ids.alberto, amountCents: 100, sub: true }, tok.papa)).status >= 400);
    await ok('POST', '/api/collections/payments/records', { group: ids.group, from: ids.papa, to: ids.samira, amountCents: 500, sub: true }, tok.papa);
    await ok('POST', '/api/collections/payments/records', { group: ids.group, from: ids.papa, to: ids.alberto, amountCents: 700, sub: false }, tok.papa);
    const seen = await ok('GET', '/api/collections/payments/records', null, tok.alberto);
    assert.ok(seen.items.every((x) => !x.sub), 'el tesorero nunca ve pagos de la cuenta de sus regalos');
    assert.equal((await ok('GET', '/api/collections/payments/records', null, tok.mama)).totalItems, 0);
  });

  test('PB-15: la entrega se abre con dos llaves y no enseña precios', async () => {
    assert.equal((await call('GET', `/api/lazo/received/${ids.group}`, null, tok.mama)).status, 403);
    await ok('POST', '/api/lazo/gift', { action: 'buy', item: ids['b-mama'], kind: 'self', paidCents: 9000, paidBy: ids.papa }, tok.papa).catch(() => null);
    await ok('POST', '/api/lazo/reveal', { group: ids.group, action: 'ask' }, tok.alberto);
    assert.equal((await call('POST', '/api/lazo/reveal', { group: ids.group, action: 'confirm' }, tok.alberto)).status, 403);
    await ok('POST', '/api/lazo/reveal', { group: ids.group, action: 'confirm' }, tok.papa);
    const r = await call('GET', `/api/lazo/received/${ids.group}`, null, tok.mama);
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.text, /paidCents|priceCents|paidBy/);
    // Las cuentas siguen siendo secretas después
    assert.equal((await ok('GET', `/api/collections/claims/records?filter=${encodeURIComponent(`item.list = "${ids['l-mama']}"`)}`, null, tok.mama)).totalItems, 0);
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
  test('PB-2: lo que otros hacen sobre la lista de Mamá no cambia ni un byte de lo que Mamá ve', async () => {
    const snap = async () => {
      const out = [];
      for (const col of ['groups', 'lists', 'items', 'claims', 'contributions', 'budgets', 'payments']) out.push((await call('GET', `/api/collections/${col}/records?perPage=500&sort=id`, null, tok.mama)).text);
      out.push((await call('GET', `/api/collections/items/records/${ids['c-mama']}`, null, tok.mama)).text);
      return out;
    };
    const before = await snap();
    await ok('POST', '/api/lazo/gift', { action: 'buy', item: ids['c-mama'], kind: 'self', paidCents: 2100, paidBy: ids.juancarlos }, tok.juancarlos);
    await ok('POST', '/api/collections/items/records', { list: ids['l-mama'], title: 'Otra sorpresa', priceCents: 900, priority: 2, quantity: 1, createdBy: ids.samira, secret: true }, tok.samira);
    const budget = (await ok('GET', `/api/collections/budgets/records?filter=${encodeURIComponent(`list = "${ids['l-mama']}"`)}`, null, tok.samira)).items[0];
    if (budget) await call('PATCH', `/api/collections/budgets/records/${budget.id}`, { amountCents: 25000 }, tok.samira);
    assert.deepEqual(await snap(), before);
  });

  test('PB-9: veinte reservas a la vez del mismo regalo dejan una sola fila', async () => {
    await ok('PATCH', '/api/settings', { rateLimits: { enabled: false } }, su);
    try {
      const item = (await ok('POST', '/api/collections/items/records', { list: ids['l-papa'], title: 'Carrera', priceCents: 100, priority: 2, quantity: 1, createdBy: ids.papa }, tok.papa)).id;
      const who = ['alberto', 'juancarlos', 'samira', 'mama'];
      const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => call('POST', '/api/lazo/gift', { action: 'reserve', item, kind: 'self' }, tok[who[i % who.length]])));
      assert.equal(rs.filter((r) => r.status === 200).length, 1, rs.map((r) => r.status).join(','));
      assert.equal((await ok('GET', `/api/collections/claims/records?filter=${encodeURIComponent(`item = "${item}"`)}`, null, su)).totalItems, 1);
    } finally {
      await ok('PATCH', '/api/settings', { rateLimits: { enabled: true } }, su);
    }
  });

  test('PB-14: un lote no sirve para sondear con _via_ ni expand', async () => {
    const A = ids['b-papa'];
    const r = await call('POST', '/api/batch', { requests: [{ method: 'PATCH', url: `/api/collections/items/records/${A}?expand=claims_via_item,contributions_via_item`, body: { notes: 'lote' } }] }, tok.papa);
    assert.doesNotMatch(r.text, /amountCents|"status":"reserved"|"status":"bought"/);
    const f = await call('POST', '/api/batch', { requests: [{ method: 'PATCH', url: `/api/collections/items/records/${A}?filter=${encodeURIComponent('claims_via_item.id != ""')}`, body: { notes: 'lote2' } }] }, tok.papa);
    assert.doesNotMatch(f.text, /amountCents|"status":"reserved"/);
  });

  test('PB-3/PB-17: plaza nueva con historial previo; su enlace usado o falso responde igual', async () => {
    assert.equal((await call('POST', '/api/collections/lists/records', { group: ids.group, name: ' samira ', kind: 'person' }, tok.alberto)).status, 400, 'V-13 d: nombre repetido');
    const pepe = await ok('POST', '/api/collections/lists/records', { group: ids.group, name: 'Tío Pepe', kind: 'person' }, tok.alberto);
    const s = await ok('POST', '/api/collections/items/records', { list: pepe.id, title: 'Sorpresa para Pepe', priceCents: 1000, priority: 2, quantity: 1, createdBy: ids.juancarlos, secret: true }, tok.juancarlos);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: s.id, kind: 'self' }, tok.juancarlos);
    await ok('POST', '/api/collections/budgets/records', { list: pepe.id, amountCents: 3000 }, tok.mama);
    const inv = await ok('POST', '/api/lazo/invite', { group: ids.group, list: pepe.id }, tok.alberto);
    const info = await ok('POST', '/api/lazo/invite-info', { token: inv.token });
    assert.equal(info.personal.name, 'Tío Pepe');
    const u = await ok('POST', '/api/collections/users/records', { email: 'pepe@lazo.invalid', password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: 'Pepe' }, su);
    const t = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 600 }, su)).token;
    await ok('POST', '/api/lazo/join', { token: inv.token }, t);
    const q = (x) => encodeURIComponent(x);
    for (const col of ['claims', 'contributions']) assert.equal((await ok('GET', `/api/collections/${col}/records?filter=${q(`item.list = "${pepe.id}"`)}`, null, t)).totalItems, 0, col);
    assert.equal((await ok('GET', `/api/collections/budgets/records?filter=${q(`list = "${pepe.id}"`)}`, null, t)).totalItems, 0);
    assert.equal((await ok('GET', `/api/collections/items/records?filter=${q(`list = "${pepe.id}"`)}`, null, t)).totalItems, 0);
    const used = await call('POST', '/api/lazo/invite-info', { token: inv.token });
    const fake = await call('POST', '/api/lazo/invite-info', { token: 'Z'.repeat(32) });
    assert.equal(used.status, fake.status);
    assert.equal(used.text, fake.text);
  });

  test('V-10/V-11/V-13: baja con plaza, plaza de la hucha y regalos retirados', async () => {
    assert.equal((await call('DELETE', `/api/collections/users/records/${ids.papa}`, null, tok.papa)).status, 400, 'V-10');
    const labels = (await ok('GET', '/api/settings', null, su)).rateLimits.rules.map((r) => r.label);
    assert.ok(labels.includes('GET /api/lazo/received/'), 'V-9');
    const bought = await call('POST', '/api/lazo/gift', { action: 'buy', item: ids['a-juancarlos'], kind: 'self', paidCents: 100, paidBy: ids.mama }, tok.mama);
    assert.equal(bought.status, 400, 'V-13 e: compra');
    const contrib = await call('POST', '/api/collections/contributions/records', { item: ids['a-juancarlos'], user: ids.mama, amountCents: 100 }, tok.mama);
    assert.equal(contrib.status, 400, 'V-13 e: aportación');
    // V-11: liberar a la suplente y borrar su plaza no reabre los roles
    await ok('POST', '/api/lazo/plaza-release', { list: ids['l-samira'] }, tok.alberto);
    const plaza = await ok('GET', `/api/collections/lists/records/${ids['l-samira']}`, null, su);
    assert.equal(plaza.approvedBy, '', 'V-13 a');
    assert.equal((await call('DELETE', `/api/collections/lists/records/${ids['l-samira']}`, null, tok.alberto)).status, 400, 'V-11');
  });
});
