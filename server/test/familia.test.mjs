// E2E de punta a punta con 5 personas contra un PocketBase real (migraciones + hooks de server/pb).
// Uso: npm run build:server && PB_BIN=/ruta/pocketbase node --test server/test/familia.test.mjs
// Ana se da de alta por consola (lazo-alta), entra con el código e invita a Bea, Carlos, Dani y Eva con enlaces
// personales. Después de CADA paso, `ciego(X)` comprueba para CADA persona la regla de oro: X no ve nada de lo que
// pasa en su plaza (reservas, compras, aportaciones, presupuesto, sorpresas) ni por las colecciones ni por /api/lazo/*.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BIN = process.env.PB_BIN;
const PORT = 19700 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const PEOPLE = ['ana', 'bea', 'carlos', 'dani', 'eva'];
const NAMES = { ana: 'Ana', bea: 'Bea', carlos: 'Carlos', dani: 'Dani', eva: 'Eva' };
const SUBS = ['claims/*', 'contributions/*', 'budgets/*', 'payments/*', 'items/*', 'lists/*'];
const STATE = /claims|budget|paid|secret|removed|reserved|bought|contribution|members|kind|quantity/i;
const q = encodeURIComponent;

let dir, proc, su, H, alta;
const ids = {};
const tok = {};
const shares = {}; // persona → token de su enlace de solo lectura
let revealed = false;

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
const claimOf = async (item, t) => (await get('claims', t, `&filter=${q(`item = "${item}"`)}`))[0];

/** Escucha en tiempo real (mismo helper que rules.test.mjs). */
async function listen(token, subscriptions) {
  const ac = new AbortController();
  const res = await fetch(BASE + '/api/realtime', { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (!/"clientId":"([^"]+)"/.test(buf)) buf += dec.decode((await reader.read()).value);
  const clientId = /"clientId":"([^"]+)"/.exec(buf)[1];
  const sub = await call('POST', '/api/realtime', { clientId, subscriptions }, token);
  let events = '';
  const reading = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        events += dec.decode(value);
      }
    } catch {
      /* abortado */
    }
  })();
  const stop = async (ms = 800) => {
    await new Promise((r) => setTimeout(r, ms));
    ac.abort();
    await reading;
    return events;
  };
  return { status: sub.status, stop };
}
const messages = (sse) => sse.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5))).filter((m) => m.record);

/** Lo que hay de verdad en la plaza de `who` (superusuario): regalos, sorpresas y retirados. */
const plazaReal = async (who) => {
  const items = await get('items', su, `&filter=${q(`list = "${ids[`l-${who}`]}"`)}`);
  return { items, ids: new Set(items.map((i) => i.id)) };
};

/** ¿Un evento de tiempo real o una fila habla de la plaza de `who`? */
const deSuPlaza = (who, own, rec) => {
  const L = ids[`l-${who}`];
  const c = rec.collectionName;
  if (c === 'claims' || c === 'contributions') return own.ids.has(rec.item);
  if (c === 'budgets') return rec.list === L;
  if (c === 'items') return rec.list === L && (rec.secret || rec.removed);
  return false;
};

/** La regla de oro para `who`: nada de su plaza por colecciones ni por /api/lazo/*. */
async function ciego(who, paso) {
  const t = tok[who];
  const L = ids[`l-${who}`];
  const m = `${paso} · ${who}`;
  const own = await plazaReal(who);
  // Colecciones, con filtro y sin él
  for (const col of ['claims', 'contributions']) {
    assert.equal((await get(col, t, `&filter=${q(`item.list = "${L}"`)}`)).length, 0, `${m}: ${col} de su plaza`);
    assert.ok((await get(col, t)).every((x) => !own.ids.has(x.item)), `${m}: ${col} sin filtro`);
    for (const x of await get(col, su, `&filter=${q(`item.list = "${L}"`)}`)) assert.equal((await call('GET', `/api/collections/${col}/records/${x.id}`, null, t)).status, 404, `${m}: ${col} por id`);
  }
  assert.equal((await get('budgets', t, `&filter=${q(`list = "${L}"`)}`)).length, 0, `${m}: presupuesto`);
  assert.ok((await get('budgets', t)).every((b) => b.list !== L), `${m}: presupuesto sin filtro`);
  const seen = await get('items', t, `&filter=${q(`list = "${L}"`)}`);
  assert.ok(seen.every((i) => !i.secret && !i.removed), `${m}: sorpresas o retirados`);
  assert.deepEqual(seen.map((i) => i.id), own.items.filter((i) => !i.secret && !i.removed).map((i) => i.id), `${m}: su lista`);
  // Sondeos por relaciones inversas: cerrados
  assert.equal((await call('GET', `/api/collections/items/records?filter=${q('claims_via_item.id != ""')}`, null, t)).status, 403, `${m}: _via_`);
  assert.equal((await call('GET', `/api/collections/lists/records/${L}?expand=budgets_via_list`, null, t)).status, 403, `${m}: expand`);
  // /api/lazo/gift sobre lo suyo: misma respuesta esté cogido o libre; una sorpresa suya, como un regalo que no existe
  const visibles = own.items.filter((i) => !i.secret && !i.removed);
  const r0 = visibles.length ? await call('POST', '/api/lazo/gift', { action: 'reserve', item: visibles[0].id, kind: 'self' }, t) : { status: 403 };
  assert.equal(r0.status, 403, `${m}: gift propio`);
  for (const i of visibles) assert.equal((await call('POST', '/api/lazo/gift', { action: 'reserve', item: i.id, kind: 'pot' }, t)).text, r0.text, `${m}: gift delata ${i.title}`);
  const nx = await call('POST', '/api/lazo/gift', { action: 'reserve', item: 'noexiste123456', kind: 'self' }, t);
  for (const i of own.items.filter((x) => x.secret)) {
    const r = await call('POST', '/api/lazo/gift', { action: 'reserve', item: i.id, kind: 'self' }, t);
    assert.deepEqual([r.status, r.text], [nx.status, nx.text], `${m}: sorpresa por gift`);
  }
  // Lo recibido: cerrado hasta la entrega y, después, sin precios ni quién pagó
  const rec = await call('GET', `/api/lazo/received/${ids.group}`, null, t);
  if (!revealed) assert.equal(rec.status, 403, `${m}: entrega antes de tiempo`);
  else {
    assert.equal(rec.status, 200, `${m}: entrega`);
    assert.doesNotMatch(rec.text, /paidCents|priceCents|paidBy|amountCents|reserved/, `${m}: precios en lo recibido`);
  }
  // Su enlace de solo lectura no lleva estado ni sorpresas
  if (shares[who]) {
    const s = await call('GET', `/api/lazo/shared/${shares[who]}`);
    assert.equal(s.status, 200, `${m}: compartido`);
    assert.doesNotMatch(s.text, STATE, `${m}: estado en el compartido`);
    for (const i of own.items) assert.ok(!s.text.includes(i.id), `${m}: id en el compartido`);
    assert.deepEqual(s.json.items.map((i) => i.title).sort(), visibles.map((i) => i.title).sort(), `${m}: regalos del compartido`);
  }
}
const todos = async (paso) => {
  for (const who of PEOPLE) if (tok[who]) await ciego(who, paso);
};

// Cuentas de la hucha con core/hucha tal cual (mismo montaje que flujo.test.mjs).
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
const expected = async (who) => {
  const d = await rows(su);
  const own = new Set(d.items.filter((i) => i.list === ids[`l-${who}`]).map((i) => i.id));
  return sums(who, { ...d, items: d.items.filter((i) => !own.has(i.id)), claims: d.claims.filter((c) => !own.has(c.item)), payments: d.payments.filter((p) => p.from === ids[who] || p.to === ids[who]) });
};
const accounts = async (paso) => {
  const out = {};
  for (const who of PEOPLE) {
    out[who] = sums(who, await rows(tok[who]));
    assert.deepEqual(out[who], await expected(who), `${paso} · ${who}: cuentas`);
    assert.ok(out[who].shares.every((s) => s.list !== ids[`l-${who}`]), `${paso} · ${who}: gasto en su plaza`);
  }
  return out;
};

describe('familia de 5: alta → invitaciones → regalos → hucha → sorteo → compartir → tiempo real → entrega', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-familia-'));
    cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
    cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
    const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
    execFileSync(BIN, ['migrate', 'up', ...flags]);
    execFileSync(BIN, ['superuser', 'upsert', 'su@lazo.invalid', 'superuser-de-pruebas-123', ...flags]);
    alta = execFileSync(BIN, ['lazo-alta', 'Ana', 'Navidad', '2026-12-24', ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
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
    // Cientos de comprobaciones seguidas: sin límite de peticiones (como PB-9 en rules.test.mjs).
    await ok('PATCH', '/api/settings', { rateLimits: { enabled: false } }, su);
    const out = join(dir, 'hucha.mjs');
    (await import('esbuild')).buildSync({ entryPoints: [resolve(import.meta.dirname, '..', '..', 'src/core/hucha.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
    H = await import(pathToFileURL(out).href);
  });

  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('1. Ana se da de alta, entra con el código e invita con enlaces personales', async () => {
    const code = /escribe ([A-Z0-9]{8})\b/.exec(alta)?.[1];
    assert.ok(code, `sin código: ${alta}`);
    const claim = await ok('POST', '/api/lazo/device-claim', { code });
    tok.ana = claim.token;
    ids.ana = claim.record.id;
    const [g] = await get('groups', tok.ana);
    ids.group = g.id;
    assert.equal(g.name, 'Navidad');
    ids['l-ana'] = (await get('lists', tok.ana)).find((l) => l.user === ids.ana).id;
    for (const who of PEOPLE.slice(1)) {
      ids[`l-${who}`] = (await ok('POST', '/api/collections/lists/records', { group: g.id, name: NAMES[who], kind: 'person' }, tok.ana)).id;
      const inv = await ok('POST', '/api/lazo/invite', { group: g.id, list: ids[`l-${who}`] }, tok.ana);
      assert.equal((await ok('POST', '/api/lazo/invite-info', { token: inv.token })).personal.name, NAMES[who]);
      ids[`inv-${who}`] = inv.token;
    }
    await todos('alta');
  });

  test('2. cada una entra con su enlace y apunta 2 regalos', async () => {
    for (const who of PEOPLE.slice(1)) {
      const r = await ok('POST', '/api/lazo/join', { token: ids[`inv-${who}`] });
      tok[who] = r.token;
      ids[who] = r.record.id;
      assert.equal(r.record.name, NAMES[who]);
      assert.equal((await call('POST', '/api/lazo/join', { token: ids[`inv-${who}`] })).status, 400, `${who}: enlace reutilizado`);
    }
    const g = await ok('GET', `/api/collections/groups/records/${ids.group}`, null, tok.eva);
    assert.deepEqual([...g.members].sort(), PEOPLE.map((p) => ids[p]).sort());
    for (const [n, who] of PEOPLE.entries()) {
      for (const k of [1, 2]) {
        const it = await ok('POST', '/api/collections/items/records', { list: ids[`l-${who}`], title: `${k === 1 ? 'Libro' : 'Jersey'} de ${NAMES[who]}`, priceCents: 2000 + 1000 * n + 500 * k, priority: k, quantity: 1, createdBy: ids[who] }, tok[who]);
        ids[`${who}-${k}`] = it.id;
      }
    }
    await todos('regalos');
  });

  test('3. reservas cruzadas, una compra, un regalo a medias, presupuestos y una sorpresa para Bea', async () => {
    // Cada una reserva el primer regalo de la siguiente (el segundo de Eva irá a medias)
    for (const [n, who] of PEOPLE.entries()) {
      const next = PEOPLE[(n + 1) % PEOPLE.length];
      await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids[`${next}-1`], kind: 'self' }, tok[who]);
    }
    // Carlos compra lo que reservó de Dani
    await ok('POST', '/api/lazo/gift', { action: 'buy', claim: (await claimOf(ids['dani-1'], tok.carlos)).id, paidCents: 3400, paidBy: ids.carlos }, tok.carlos);
    // El jersey de Eva, a medias entre Ana y Bea; lo compra Ana
    await ok('POST', '/api/collections/contributions/records', { item: ids['eva-2'], user: ids.ana, amountCents: 2000 }, tok.ana);
    const kb = await ok('POST', '/api/collections/contributions/records', { item: ids['eva-2'], user: ids.bea, amountCents: 1500 }, tok.bea);
    ids.kBea = kb.id;
    await ok('POST', '/api/lazo/gift', { action: 'buy', item: ids['eva-2'], kind: 'self', paidCents: 3500, paidBy: ids.ana }, tok.ana);
    // Cada una fija el presupuesto de la anterior
    for (const [n, who] of PEOPLE.entries()) {
      const prev = PEOPLE[(n + PEOPLE.length - 1) % PEOPLE.length];
      await ok('POST', '/api/collections/budgets/records', { list: ids[`l-${prev}`], amountCents: 5000 + 100 * n }, tok[who]);
    }
    // Sorpresa para Bea: la apunta Carlos, la reserva y la compra
    ids['bea-s'] = (await ok('POST', '/api/collections/items/records', { list: ids['l-bea'], title: 'Sorpresa para Bea', priceCents: 1800, priority: 2, quantity: 1, createdBy: ids.carlos, secret: true }, tok.carlos)).id;
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids['bea-s'], kind: 'self' }, tok.carlos);
    await ok('POST', '/api/lazo/gift', { action: 'buy', claim: (await claimOf(ids['bea-s'], tok.carlos)).id, paidCents: 1800, paidBy: ids.carlos }, tok.carlos);
    // Los demás sí lo ven todo de Bea
    assert.equal((await get('claims', tok.dani, `&filter=${q(`item.list = "${ids['l-bea']}"`)}`)).length, 2);
    assert.equal((await get('budgets', tok.eva, `&filter=${q(`list = "${ids['l-bea']}"`)}`)).length, 1);
    assert.equal((await get('contributions', tok.carlos, `&filter=${q(`item = "${ids['eva-2']}"`)}`)).length, 2);
    await todos('reservas');
  });

  test('4. tesorera y suplente; se compra con la hucha', async () => {
    assert.equal((await call('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-bea'], deputy: ids['l-dani'] }, tok.bea)).status, 403, 'solo quien organiza');
    await ok('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-ana'], deputy: ids['l-carlos'] }, tok.ana);
    assert.equal((await call('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-eva'], deputy: ids['l-dani'] }, tok.ana)).status, 400, 'una sola vez');
    // Dani compra con la hucha el jersey de Bea (30 €); Eva, el de Ana, la tesorera (24 €): esa cuenta la lleva Carlos
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids['bea-2'], kind: 'pot' }, tok.dani);
    await ok('POST', '/api/lazo/gift', { action: 'buy', claim: (await claimOf(ids['bea-2'], tok.dani)).id, paidCents: 3000, paidBy: ids.dani }, tok.dani);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: ids['ana-2'], kind: 'pot' }, tok.eva);
    await ok('POST', '/api/lazo/gift', { action: 'buy', claim: (await claimOf(ids['ana-2'], tok.eva)).id, paidCents: 2400, paidBy: ids.eva }, tok.eva);
    const acc = await accounts('hucha');
    // Nadie paga lo suyo: 30 € entre Ana, Carlos, Dani y Eva; 24 € entre Bea, Carlos, Dani y Eva.
    assert.deepEqual(acc.carlos.due, { general: 750, aparte: 0 });
    assert.deepEqual(acc.dani.due, { general: -2250, aparte: 600 });
    assert.deepEqual(acc.eva.due, { general: 750, aparte: -1800 });
    assert.deepEqual(acc.bea.due, { general: 0, aparte: 600 });
    assert.deepEqual(acc.ana.table, { bea: 0, carlos: 750, dani: -2250, eva: 750 }, 'tabla de la tesorera');
    assert.deepEqual(acc.carlos.table, { bea: 600, dani: 600, eva: -1800 }, 'tabla del suplente');
    await todos('hucha');
  });

  test('5. pagos (todo a cero) y amigo invisible (una asignación cada una)', async () => {
    const acc = await accounts('antes de pagar');
    const T = 'ana';
    const T2 = 'carlos';
    const pay = (from, to, amountCents, sub) => ok('POST', '/api/collections/payments/records', { group: ids.group, from: ids[from], to: ids[to], amountCents, sub }, tok[from]);
    for (const who of PEOPLE) {
      const { general, aparte } = acc[who].due; // lo que cada una ve que debe (positivo) o le deben (negativo)
      if (general > 0) await pay(who, T, general, false);
      if (general < 0) await pay(T, who, -general, false);
      if (aparte > 0) await pay(who, T2, aparte, true);
      if (aparte < 0) await pay(T2, who, -aparte, true);
    }
    const fin = await accounts('pagos');
    for (const who of PEOPLE) assert.deepEqual(fin[who].due, { general: 0, aparte: 0 }, `${who} al día`);
    assert.ok(Object.values(fin.ana.table).every((x) => x === 0), 'tesorera a cero');
    assert.ok(Object.values(fin.carlos.table).every((x) => x === 0), 'suplente a cero');
    assert.ok((await get('payments', tok.ana)).every((p) => !p.sub), 'la tesorera no ve la cuenta de sus regalos');

    assert.equal((await call('POST', '/api/lazo/draw', { group: ids.group, participants: PEOPLE.map((p) => ids[p]) }, tok.bea)).status, 403, 'solo quien organiza sortea');
    await ok('POST', '/api/lazo/draw', { group: ids.group, participants: PEOPLE.map((p) => ids[p]), exclusions: [[ids.bea, ids.carlos]] }, tok.ana);
    const receivers = new Set();
    for (const who of PEOPLE) {
      const a = await get('assignments', tok[who]);
      assert.equal(a.length, 1, `${who}: una asignación`);
      assert.equal(a[0].giver, ids[who]);
      assert.notEqual(a[0].receiver, ids[who]);
      receivers.add(a[0].receiver);
    }
    assert.equal(receivers.size, PEOPLE.length, 'a cada una le regala alguien');
    await todos('pagos y sorteo');
  });

  test('6. Eva comparte su lista en solo lectura: sin estados', async () => {
    assert.equal((await call('POST', '/api/lazo/share', { list: ids['l-eva'] }, tok.dani)).status, 403, 'solo la dueña');
    shares.eva = (await ok('POST', '/api/lazo/share', { list: ids['l-eva'] }, tok.eva)).token;
    const r = await call('GET', `/api/lazo/shared/${shares.eva}`);
    assert.deepEqual(Object.keys(r.json).sort(), ['items', 'name', 'occasion']);
    assert.equal(r.json.name, 'Eva');
    await todos('compartir'); // ciego(eva) revisa el enlace: sin estado, sin sorpresas, sin ids
  });

  test('7. tiempo real: lo que los demás hacen en la plaza de Eva no le llega; a los demás sí', async () => {
    const ears = {};
    for (const who of PEOPLE) {
      ears[who] = await listen(tok[who], SUBS);
      assert.equal(ears[who].status, 204, who);
    }
    const L = ids['l-eva'];
    const s = (await ok('POST', '/api/collections/items/records', { list: L, title: 'Sorpresa para Eva', priceCents: 1200, priority: 2, quantity: 1, createdBy: ids.bea, secret: true }, tok.bea)).id;
    ids['eva-s'] = s;
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: s, kind: 'self' }, tok.carlos);
    const bu = (await get('budgets', tok.dani, `&filter=${q(`list = "${L}"`)}`))[0];
    await ok('PATCH', `/api/collections/budgets/records/${bu.id}`, { amountCents: bu.amountCents + 500 }, tok.ana);
    await ok('PATCH', `/api/collections/contributions/records/${ids.kBea}`, { paid: true }, tok.ana);
    // Y algo en la plaza de Bea, para que la vigilancia no sea solo de Eva
    await ok('POST', '/api/lazo/gift', { action: 'release', claim: (await claimOf(ids['bea-1'], tok.ana)).id }, tok.ana);
    const got = {};
    for (const who of PEOPLE) got[who] = messages(await ears[who].stop(who === PEOPLE[0] ? 1000 : 0));
    for (const who of PEOPLE) {
      const own = await plazaReal(who);
      const leak = got[who].filter((m) => deSuPlaza(who, own, m.record));
      assert.deepEqual(leak, [], `${who} recibió eventos de su plaza`);
    }
    assert.deepEqual(got.eva.map((m) => [m.action, m.record.item]), [['delete', ids['bea-1']]], 'a Eva solo le llega lo de Bea');
    for (const who of PEOPLE.filter((p) => p !== 'eva')) {
      assert.ok(got[who].some((m) => m.record.id === s), `${who}: la sorpresa de Eva`);
      assert.ok(got[who].some((m) => m.record.id === bu.id), `${who}: el presupuesto de Eva`);
    }
    for (const who of PEOPLE.filter((p) => p !== 'bea')) assert.ok(got[who].some((m) => m.record.item === ids['bea-1'] && m.action === 'delete'), `${who}: la reserva soltada de Bea`);
    await todos('tiempo real');
  });

  test('8. la entrega (dos llaves) y lo recibido, sin precios', async () => {
    assert.equal((await call('POST', '/api/lazo/reveal', { group: ids.group, action: 'ask' }, tok.bea)).status, 403, 'pedir: solo quien organiza');
    await ok('POST', '/api/lazo/reveal', { group: ids.group, action: 'ask' }, tok.ana);
    assert.equal((await call('POST', '/api/lazo/reveal', { group: ids.group, action: 'confirm' }, tok.ana)).status, 403, 'la misma no confirma');
    await ok('POST', '/api/lazo/reveal', { group: ids.group, action: 'confirm' }, tok.bea);
    revealed = true;
    const got = {};
    for (const who of PEOPLE) {
      const r = await ok('GET', `/api/lazo/received/${ids.group}`, null, tok[who]);
      got[who] = Object.fromEntries(r.map((x) => [x.title, x.fromAll ? 'hucha' : x.from.map((f) => f.name).sort().join('+')]));
    }
    assert.deepEqual(got, {
      ana: { 'Jersey de Ana': 'hucha' },
      bea: { 'Jersey de Bea': 'hucha', 'Sorpresa para Bea': 'Carlos' },
      carlos: {},
      dani: { 'Libro de Dani': 'Carlos' },
      eva: { 'Jersey de Eva': 'Ana+Bea' },
    });
    await todos('entrega');
  });
});
