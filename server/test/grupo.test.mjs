// Salir del grupo y eliminarlo. Contra un PocketBase real, como rules.test.mjs.
// Uso: npm run build:server && PB_BIN=/ruta/pocketbase node --test server/test/grupo.test.mjs
// 1) Salir: la plaza queda libre, se suelta lo que solo era promesa y la sorpresa sigue intacta.
// 2) Eliminar: solo el dueño; no queda nada del grupo y el otro grupo no se toca.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = 19600 + Math.floor(Math.random() * 500);
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
const rows = async (col, filter, t = su) => (await ok('GET', `/api/collections/${col}/records?perPage=500${filter ? `&filter=${q(filter)}` : ''}`, null, t)).items;
const total = async (col, t, filter) => (await ok('GET', `/api/collections/${col}/records?perPage=500${filter ? `&filter=${q(filter)}` : ''}`, null, t)).totalItems;
const gift = (who, list, title, extra = {}) => ok('POST', '/api/collections/items/records', { list, title, priceCents: 1000, priority: 2, quantity: 1, createdBy: ids[who], ...extra }, tok[who]);

/** Tiempo real (como en rules.test.mjs): `stop(ms)` espera, cierra y devuelve los mensajes [{ action, record }]. */
async function listen(token, subscriptions) {
  const ac = new AbortController();
  const res = await fetch(BASE + '/api/realtime', { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (!/"clientId":"([^"]+)"/.test(buf)) buf += dec.decode((await reader.read()).value);
  const clientId = /"clientId":"([^"]+)"/.exec(buf)[1];
  assert.equal((await call('POST', '/api/realtime', { clientId, subscriptions }, token)).status, 204);
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
  return async (ms = 800) => {
    await new Promise((r) => setTimeout(r, ms));
    ac.abort();
    await reading;
    return events.split('\n').filter((l) => l.startsWith('data:') && !l.includes('clientId')).map((l) => JSON.parse(l.slice(5)));
  };
}
const SUBS = ['claims/*', 'contributions/*', 'budgets/*', 'items/*', 'lists/*', 'groups/*'];
const FAKE = 'A'.repeat(32);

/** Todo lo que cuelga de un grupo (como superusuario): colección → ids. */
async function everything(g) {
  const f = {
    lists: `group = "${g}"`,
    items: `list.group = "${g}"`,
    claims: `item.list.group = "${g}"`,
    contributions: `item.list.group = "${g}"`,
    budgets: `list.group = "${g}"`,
    payments: `group = "${g}"`,
    draws: `group = "${g}"`,
    assignments: `draw.group = "${g}"`,
    invites: `group = "${g}"`,
    joinRequests: `group = "${g}"`,
    shares: `list.group = "${g}"`,
  };
  const out = {};
  for (const [col, filter] of Object.entries(f)) out[col] = (await rows(col, filter)).map((r) => r.id);
  return out;
}

async function newUser(name) {
  const u = await ok('POST', '/api/collections/users/records', { email: `${name.toLowerCase()}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name, color: 'menta' }, su);
  ids[name] = u.id;
  tok[name] = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
}

describe('grupo: salir y eliminar', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-grupo-'));
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
    await newUser('Ana');
    await newUser('Zoe');
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Navidad', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', allowNewNames: false, plazas: ['Bea', 'Carlos', 'Eva', 'Tía Dani'] }, tok.Ana);
    ids.group = g.id;
    for (const l of await rows('lists', `group = "${g.id}"`)) ids[`l-${l.name}`] = l.id;
    for (const who of ['Bea', 'Carlos', 'Eva']) {
      const inv = await ok('POST', '/api/lazo/invite', { group: g.id, list: ids[`l-${who}`] }, tok.Ana);
      const r = await ok('POST', '/api/lazo/join', { token: inv.token });
      tok[who] = r.token;
      ids[who] = r.record.id;
    }
    // Carlos organiza también (admin), pero no es el dueño.
    await ok('PATCH', `/api/collections/groups/records/${g.id}`, { 'admins+': ids.Carlos }, su);
    // Otro grupo, de Zoe, con Ana dentro: no se puede tocar.
    const o = await ok('POST', '/api/collections/groups/records', { name: 'Cumple', occasion: 'cumpleanos', currency: 'EUR', buyMode: 'mixto', plazas: ['Ana'] }, tok.Zoe);
    ids.other = o.id;
    const inv = await ok('POST', '/api/lazo/invite', { group: o.id, list: (await rows('lists', `group = "${o.id}" && name = "Ana"`))[0].id }, tok.Zoe);
    await ok('POST', '/api/lazo/join', { token: inv.token }, tok.Ana);
    const zl = (await rows('lists', `group = "${o.id}" && name = "Zoe"`))[0].id;
    const zi = await gift('Zoe', zl, 'Libro de Zoe');
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: zi.id, kind: 'self' }, tok.Ana);
    await ok('POST', '/api/collections/budgets/records', { list: zl, amountCents: 3000 }, tok.Ana);
  });

  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('salir: la plaza queda libre, se suelta lo prometido y lo comprado se queda', async () => {
    const C = ids['l-Carlos'];
    const B = ids['l-Bea'];
    const libro = await gift('Carlos', C, 'Libro');
    const taza = await gift('Carlos', C, 'Taza');
    const reloj = await gift('Carlos', C, 'Reloj');
    const pot = await gift('Carlos', C, 'Viaje');
    const bufanda = await gift('Bea', B, 'Bufanda');
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: libro.id, kind: 'self' }, tok.Bea);
    await ok('POST', '/api/collections/contributions/records', { item: taza.id, user: ids.Bea, amountCents: 500 }, tok.Bea);
    await ok('POST', '/api/lazo/gift', { action: 'buy', item: reloj.id, kind: 'self', paidCents: 1000, paidBy: ids.Bea }, tok.Bea);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: pot.id, kind: 'pot' }, tok.Bea);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: bufanda.id, kind: 'self' }, tok.Carlos);
    await ok('POST', '/api/collections/budgets/records', { list: B, amountCents: 4000 }, tok.Ana);
    await ok('POST', '/api/lazo/share', { list: B }, tok.Bea);

    // Ni el dueño, ni quien no está, ni sin sesión
    assert.equal((await call('POST', '/api/lazo/group-leave', { group: ids.group }, tok.Ana)).status, 403, 'el dueño no sale');
    assert.equal((await call('POST', '/api/lazo/group-leave', { group: ids.group }, tok.Zoe)).status, 403, 'quien no está');
    assert.equal((await call('POST', '/api/lazo/group-leave', { group: 'noexiste123456' }, tok.Zoe)).status, 403, 'grupo falso');
    assert.equal((await call('POST', '/api/lazo/group-leave', { group: ids.group })).status, 401, 'sin sesión');

    // La respuesta no depende de lo que tenga reservado: Bea (con mucho) y Eva (sin nada) reciben lo mismo
    const bea = await call('POST', '/api/lazo/group-leave', { group: ids.group }, tok.Bea);
    const eva = await call('POST', '/api/lazo/group-leave', { group: ids.group }, tok.Eva);
    assert.equal(bea.status, 200);
    assert.equal(bea.status, eva.status);
    assert.equal(bea.text, eva.text);

    const g = await ok('GET', `/api/collections/groups/records/${ids.group}`, null, su);
    assert.ok(!g.members.includes(ids.Bea) && !g.admins.includes(ids.Bea));
    const plaza = await ok('GET', `/api/collections/lists/records/${B}`, null, su);
    assert.equal(plaza.user, '');
    assert.equal(plaza.prevUser, ids.Bea);
    // Fuera: no ve nada del grupo
    for (const col of ['groups', 'lists', 'items', 'claims', 'contributions', 'budgets', 'payments']) assert.equal(await total(col, tok.Bea), 0, `fuera: ${col}`);
    // Se suelta lo que era promesa; lo comprado y la reserva de la hucha se quedan
    assert.equal((await rows('claims', `item = "${libro.id}"`)).length, 0, 'reserva suelta');
    assert.equal((await rows('contributions', `item = "${taza.id}"`)).length, 0, 'aportación suelta');
    assert.equal((await rows('claims', `item = "${reloj.id}" && status = "bought"`)).length, 1, 'la compra se queda');
    assert.equal((await rows('claims', `item = "${pot.id}"`)).length, 1, 'la reserva de la hucha es del grupo');
    // Su lista sigue con sus regalos y con lo que otros le reservaron; su enlace de solo lectura se anula
    assert.equal((await rows('items', `list = "${B}"`)).length, 1);
    assert.equal((await rows('claims', `item = "${bufanda.id}"`)).length, 1);
    assert.equal((await rows('shares', `list = "${B}"`)).length, 0);
    // Y Carlos sigue sin ver nada de lo de su propia lista (la regla de oro)
    assert.equal(await total('claims', tok.Carlos, `item.list = "${C}"`), 0);
    assert.equal(await total('contributions', tok.Carlos, `item.list = "${C}"`), 0);
    assert.equal(await total('budgets', tok.Carlos, `list = "${C}"`), 0);

    // Quien vuelva a esa plaza con un enlace nuevo tampoco ve lo que le reservaron
    const inv = await ok('POST', '/api/lazo/invite', { group: ids.group, list: B }, tok.Ana);
    const back = await ok('POST', '/api/lazo/join', { token: inv.token });
    tok.Bea = back.token;
    ids.Bea = back.record.id;
    assert.equal((await ok('GET', `/api/collections/lists/records/${B}`, null, tok.Bea)).user, ids.Bea);
    assert.equal(await total('claims', tok.Bea, `item.list = "${B}"`), 0);
    assert.equal(await total('budgets', tok.Bea, `list = "${B}"`), 0);
    const own = await call('GET', `/api/collections/claims/records?filter=${q(`item = "${bufanda.id}"`)}`, null, tok.Bea);
    assert.equal(own.json.totalItems, 0);
  });

  test('eliminar: solo el dueño, sin huérfanos y sin tocar otros grupos', async () => {
    // Que haya de todo: hucha, pago, sorteo, enlace general, solicitud pendiente y enlace de solo lectura
    await ok('POST', '/api/lazo/hucha-roles', { group: ids.group, treasurer: ids['l-Ana'], deputy: ids['l-Carlos'] }, tok.Ana);
    await ok('POST', '/api/collections/payments/records', { group: ids.group, from: ids.Carlos, to: ids.Ana, amountCents: 1000, sub: false }, tok.Carlos);
    await ok('POST', '/api/lazo/draw', { group: ids.group, participants: [ids.Ana, ids.Bea, ids.Carlos] }, tok.Ana);
    const general = await ok('POST', '/api/lazo/invite', { group: ids.group }, tok.Ana);
    await ok('POST', '/api/lazo/join', { token: general.token, list: ids['l-Tía Dani'] });
    await ok('POST', '/api/lazo/share', { list: ids['l-Ana'] }, tok.Ana);
    await gift('Ana', ids['l-Ana'], 'Pluma');
    const gorro = await gift('Bea', ids['l-Bea'], 'Gorro');
    await ok('POST', '/api/collections/contributions/records', { item: gorro.id, user: ids.Ana, amountCents: 700 }, tok.Ana);

    const before = await everything(ids.group);
    for (const [col, list] of Object.entries(before)) assert.ok(list.length > 0, `hay ${col} antes de borrar`);
    const otherBefore = await everything(ids.other);

    // Nadie más puede: ni quien organiza sin ser dueño, ni un miembro, ni sin sesión, ni por la API REST
    const admin = await call('POST', '/api/lazo/group-delete', { group: ids.group }, tok.Carlos);
    const member = await call('POST', '/api/lazo/group-delete', { group: ids.group }, tok.Bea);
    const fake = await call('POST', '/api/lazo/group-delete', { group: 'noexiste123456' }, tok.Bea);
    assert.equal(admin.status, 403);
    assert.equal(member.status, 403);
    assert.equal(fake.status, 403);
    assert.equal(admin.text, fake.text, 'no distingue «no existe» de «no es tuyo»');
    assert.equal((await call('POST', '/api/lazo/group-delete', { group: ids.group })).status, 401);
    assert.ok((await call('DELETE', `/api/collections/groups/records/${ids.group}`, null, tok.Ana)).status >= 400, 'REST cerrado también al dueño');
    assert.equal((await call('POST', '/api/lazo/group-delete', { group: ids.other }, tok.Ana)).status, 403, 'Ana no es dueña del otro');
    assert.deepEqual(await everything(ids.group), before, 'nada se ha tocado');

    const r = await call('POST', '/api/lazo/group-delete', { group: ids.group }, tok.Ana);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    // Ni un registro de ese grupo, buscándolos uno a uno por id
    assert.equal((await call('GET', `/api/collections/groups/records/${ids.group}`, null, su)).status, 404);
    for (const [col, list] of Object.entries(before)) {
      for (const id of list) assert.equal((await call('GET', `/api/collections/${col}/records/${id}`, null, su)).status, 404, `huérfano en ${col}`);
    }
    // El otro grupo, intacto; y la regla de oro sigue allí: Zoe no ve nada de su lista
    assert.deepEqual(await everything(ids.other), otherBefore);
    const zl = (await rows('lists', `group = "${ids.other}" && name = "Zoe"`))[0].id;
    assert.equal(await total('claims', tok.Zoe, `item.list = "${zl}"`), 0);
    assert.equal(await total('budgets', tok.Zoe, `list = "${zl}"`), 0);
    assert.equal(await total('claims', tok.Ana, `item.list.group = "${ids.other}"`), 1, 'Ana sigue viendo su reserva en el otro grupo');
    // Las cuentas siguen existiendo (pueden estar en otros grupos)
    assert.equal((await call('GET', `/api/collections/users/records/${ids.Carlos}`, null, su)).status, 200);
  });

  // v1.1.2, V-32 a V-35 y V-37: un grupo nuevo (el de antes ya no existe).
  test('salir o ser expulsado: caducan sus invitaciones, enlaces y asignación; nada delata la lista propia', async () => {
    await ok('PATCH', '/api/settings', { rateLimits: { enabled: false } }, su); // muchas entradas seguidas
    const g = await ok('POST', '/api/collections/groups/records', { name: 'Reyes', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', allowNewNames: false, plazas: ['Bea', 'Carlos', 'Dani', 'Eva', 'Fer'] }, tok.Ana);
    const G = g.id;
    const L = {};
    for (const l of await rows('lists', `group = "${G}"`)) L[l.name] = l.id;
    for (const who of ['Bea', 'Carlos', 'Eva']) await ok('POST', '/api/lazo/join', { token: (await ok('POST', '/api/lazo/invite', { group: G, list: L[who] }, tok.Ana)).token }, tok[who]);
    await ok('PATCH', `/api/collections/groups/records/${G}`, { 'admins+': ids.Carlos }, su);
    const fakeInfo = await call('POST', '/api/lazo/invite-info', { token: FAKE });
    const fakeJoin = await call('POST', '/api/lazo/join', { token: FAKE });
    const shared = (t) => call('GET', `/api/lazo/shared/${t}`);
    const fakeShare = await shared(FAKE);
    /** Una invitación muerta responde exactamente como un token inventado. */
    const dead = async (token, msg) => {
      for (const [r, f] of [
        [await call('POST', '/api/lazo/invite-info', { token }), fakeInfo],
        [await call('POST', '/api/lazo/join', { token }), fakeJoin],
      ]) {
        assert.equal(r.status, 400, msg);
        assert.equal(r.text, f.text, msg);
      }
    };

    // V-37.4: el dueño no se cambia y el grupo no se borra por la API REST, ni en lote
    assert.ok((await call('PATCH', `/api/collections/groups/records/${G}`, { owner: ids.Carlos }, tok.Carlos)).status >= 400, 'PATCH owner por un admin');
    assert.ok((await call('POST', '/api/batch', { requests: [{ method: 'DELETE', url: `/api/collections/groups/records/${G}` }] }, tok.Ana)).status >= 400, 'lote con DELETE');
    assert.equal((await ok('GET', `/api/collections/groups/records/${G}`, null, su)).owner, ids.Ana);

    const tren = await gift('Carlos', L.Carlos, 'Tren');
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: tren.id, kind: 'self' }, tok.Bea);
    const L_Ana = (await rows('lists', `group = "${G}" && user = "${ids.Ana}"`))[0].id;
    const pluma = await gift('Ana', L_Ana, 'Pluma');
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: pluma.id, kind: 'self' }, tok.Eva);
    const sorpresa = await gift('Eva', L_Ana, 'Sorpresa', { secret: true });
    const budget = await ok('POST', '/api/collections/budgets/records', { list: L_Ana, amountCents: 2000 }, tok.Eva);
    const balon = await gift('Eva', L.Eva, 'Balón');
    await ok('POST', '/api/lazo/draw', { group: G, participants: [ids.Ana, ids.Bea, ids.Carlos] }, tok.Ana);

    // Carlos (admin) deja invitaciones y lleva la lista de Leo, con enlace de solo lectura
    const pDani = (await ok('POST', '/api/lazo/invite', { group: G, list: L.Dani }, tok.Carlos)).token;
    const gen = (await ok('POST', '/api/lazo/invite', { group: G }, tok.Carlos)).token;
    const leo = await ok('POST', '/api/collections/lists/records', { group: G, name: 'Leo', kind: 'child', managers: [ids.Carlos] }, su);
    const leoShare = (await ok('POST', '/api/lazo/share', { list: leo.id }, tok.Carlos)).token;
    assert.equal((await call('POST', '/api/lazo/invite-info', { token: pDani })).status, 200);
    assert.equal((await shared(leoShare)).status, 200);

    // V-37.1: Bea sale. Carlos no recibe nada de las reservas de su lista; Bea, solo el borrado de su reserva
    const bea = (await rows('claims', `item = "${tren.id}"`))[0].id;
    const earCarlos = await listen(tok.Carlos, SUBS);
    const earBea = await listen(tok.Bea, SUBS);
    await ok('POST', '/api/lazo/group-leave', { group: G }, tok.Bea);
    await ok('POST', '/api/lazo/gift', { action: 'reserve', item: balon.id, kind: 'self' }, tok.Ana); // ya fuera: no le llega
    const heardCarlos = await earCarlos();
    const heardBea = await earBea();
    assert.ok(!heardCarlos.some((m) => /claims|contributions|budgets/.test(m.record.collectionName) && m.record.item !== balon.id), JSON.stringify(heardCarlos));
    assert.ok(!heardCarlos.some((m) => m.record.id === bea), 'Carlos no se entera de que se soltó su reserva');
    assert.deepEqual(heardBea.map((m) => [m.action, m.record.id]), [['delete', bea]], JSON.stringify(heardBea));

    // V-35: fuera no ve nada, tampoco el sorteo ni su asignación
    for (const col of ['groups', 'lists', 'items', 'claims', 'contributions', 'budgets', 'payments', 'draws', 'assignments']) assert.equal(await total(col, tok.Bea), 0, `fuera: ${col}`);
    assert.equal(await total('assignments', tok.Carlos), 1, 'dentro sí ve la suya');

    // V-37.3 (V-5 tras salir): la misma cuenta no entra en otra plaza, ni por enlace personal ni con solicitud aceptada
    const pFer = (await ok('POST', '/api/lazo/invite', { group: G, list: L.Fer }, tok.Ana)).token;
    assert.equal((await call('POST', '/api/lazo/join', { token: pFer }, tok.Bea)).status, 400, 'enlace personal');
    const req = await ok('POST', '/api/lazo/join', { token: (await ok('POST', '/api/lazo/invite', { group: G }, tok.Ana)).token, list: L.Fer }, tok.Bea);
    assert.equal(req.meta.pending, true);
    assert.equal((await call('POST', '/api/lazo/join-decide', { request: req.meta.request, accept: true }, tok.Ana)).status, 400, 'solicitud aceptada');

    // V-32 y V-34: Carlos sale. Sus invitaciones mueren como un token falso y el enlace de Leo, como uno inventado
    await ok('POST', '/api/lazo/group-leave', { group: G }, tok.Carlos);
    await dead(pDani, 'personal de quien salió');
    await dead(gen, 'general de quien salió');
    assert.equal((await rows('lists', `id = "${L.Dani}"`))[0].user, '', 'nadie ha entrado en la plaza de Dani');
    const r = await shared(leoShare);
    assert.equal(r.status, 404);
    assert.equal(r.text, fakeShare.text);
    assert.deepEqual((await rows('lists', `id = "${leo.id}"`))[0].managers, [ids.Ana]);
    assert.equal(await total('assignments', tok.Carlos), 0, 'V-35: fuera, sin asignación');
    assert.equal((await rows('assignments', `giver = "${ids.Carlos}"`)).length, 1, 'la fila del sorteo se conserva');

    // V-32 sin salir: quien deja de organizar invalida sus invitaciones (comprobación en findInvite y join)
    await ok('PATCH', `/api/collections/groups/records/${G}`, { 'admins+': ids.Eva }, su);
    const pDani2 = (await ok('POST', '/api/lazo/invite', { group: G, list: L.Dani }, tok.Eva)).token;
    await ok('PATCH', `/api/collections/groups/records/${G}`, { 'admins-': ids.Eva }, su);
    await dead(pDani2, 'de quien ya no organiza');

    // Y tras plaza-release: Eva (admin otra vez) deja invitación y la lista de Mía; Ana la expulsa
    await ok('PATCH', `/api/collections/groups/records/${G}`, { 'admins+': ids.Eva }, su);
    const pDani3 = (await ok('POST', '/api/lazo/invite', { group: G, list: L.Dani }, tok.Eva)).token;
    const mia = await ok('POST', '/api/collections/lists/records', { group: G, name: 'Mía', kind: 'child', managers: [ids.Eva] }, su);
    const miaShare = (await ok('POST', '/api/lazo/share', { list: mia.id }, tok.Eva)).token;
    await ok('POST', '/api/lazo/plaza-release', { list: L.Eva }, tok.Ana);
    await dead(pDani3, 'de quien fue expulsada');
    assert.equal((await rows('invites', `createdBy = "${ids.Eva}" && revoked = false`)).length, 0, 'revocadas, no solo inválidas');
    assert.equal((await shared(miaShare)).text, fakeShare.text);
    assert.deepEqual((await rows('lists', `id = "${mia.id}"`))[0].managers, [ids.Ana]);

    // V-37.2: al eliminar, Ana no recibe el borrado de la sorpresa, de las reservas ni del presupuesto de su lista
    const hidden = new Set([sorpresa.id, budget.id, ...(await rows('claims', `item = "${pluma.id}"`)).map((c) => c.id)]);
    assert.equal(hidden.size, 3);
    const earAna = await listen(tok.Ana, SUBS);
    await ok('POST', '/api/lazo/group-delete', { group: G }, tok.Ana);
    const heardAna = await earAna();
    assert.ok(heardAna.length > 0, 'algo recibe (lo que ya veía)');
    assert.ok(!heardAna.some((m) => hidden.has(m.record.id) || m.record.collectionName === 'budgets'), JSON.stringify(heardAna));
  });
});
