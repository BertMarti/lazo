// Rutas de la lista de Amazon (camino a) contra un PocketBase real y un servicio unfurl simulado.
// Uso: npm run build:server && PB_BIN=/ruta/pocketbase node --test server/test/amazon.test.mjs
// AMZ-1 (apagada por defecto), AMZ-2 (solo el identificador), AMZ-11 (no depende de nadie), AMZ-12 (límite por
// persona), AMZ-13 (códigos cerrados) y AMZ-14 (el identificador va en el cuerpo, nunca en la URL).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const KEY = 'k'.repeat(40);
const LID = 'LAZOTEST00001';
const PRODUCTOS = [{ title: 'Taza de cerámica', asin: 'B0LAZOSV01', url: 'https://www.amazon.es/dp/B0LAZOSV01', priority: 2 }];

// unfurl simulado: apunta qué recibe y responde según el identificador.
const seen = [];
const fakeUnfurl = http.createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  seen.push({ url: req.url, key: req.headers['x-lazo-key'], body: raw });
  const b = JSON.parse(raw || '{}');
  const send = (s, j) => {
    res.writeHead(s, { 'content-type': 'application/json' });
    res.end(JSON.stringify(j));
  };
  if (req.url === '/amzn') return b.corto === 'aB3dE5f' ? send(200, { id: LID }) : send(422, { error: 'not_a_list' });
  const err = { LAZOBLOQUEA01: 'AMAZON_BLOQUEA', LAZOPRIVADA01: 'private_list', LAZOVACIA0001: 'empty', LAZORED000001: 'network', LAZOHTTP00001: 'http_500' }[b.id];
  if (err) return send(422, { error: err });
  send(200, { productos: PRODUCTOS });
});

async function startPb(env) {
  const port = 19100 + Math.floor(Math.random() * 800);
  const dir = mkdtempSync(join(tmpdir(), 'lazo-amz-'));
  cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
  cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
  const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
  execFileSync(BIN, ['migrate', 'up', ...flags]);
  execFileSync(BIN, ['superuser', 'upsert', 'su@lazo.invalid', 'superuser-de-pruebas-123', ...flags]);
  const proc = spawn(BIN, ['serve', `--http=127.0.0.1:${port}`, ...flags], {
    stdio: 'ignore',
    env: { ...process.env, UNFURL_KEY: KEY, UNFURL_URL: `http://127.0.0.1:${fakeUnfurl.address().port}`, ...env },
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) break;
    } catch {
      /* arrancando */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    return { status: r.status, json: text ? JSON.parse(text) : null, text };
  };
  const ok = async (...a) => {
    const r = await call(...a);
    assert.ok(r.status < 300, `${a[0]} ${a[1]} → ${r.status} ${r.text}`);
    return r.json;
  };
  const su = (await ok('POST', '/api/collections/_superusers/auth-with-password', { identity: 'su@lazo.invalid', password: 'superuser-de-pruebas-123' })).token;
  const tok = {};
  for (const who of ['ana', 'bea', 'fuera']) {
    const u = await ok('POST', '/api/collections/users/records', { email: `${who}@lazo.invalid`, password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: who }, su);
    tok[who] = (await ok('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
  }
  for (const who of ['ana', 'bea']) await ok('POST', '/api/collections/groups/records', { name: `Grupo de ${who}`, occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', plazas: [] }, tok[who]);
  return { call, tok, su, dir, stop: () => (proc.kill(), rmSync(dir, { recursive: true, force: true })) };
}

describe('lista de Amazon desde el servidor', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  let off, on;
  before(async () => {
    await new Promise((r) => fakeUnfurl.listen(0, '127.0.0.1', r));
    off = await startPb({ AMAZON_IMPORT: '' });
    on = await startPb({ AMAZON_IMPORT: 'on' });
  });
  after(() => {
    off?.stop();
    on?.stop();
    fakeUnfurl.close();
  });

  test('apagada por defecto: 404 con y sin sesión, y capacidades lo dice', async () => {
    for (const t of [undefined, off.tok.ana]) {
      assert.equal((await off.call('POST', '/api/lazo/amazon-lista', { id: LID }, t)).status, 404);
      assert.equal((await off.call('POST', '/api/lazo/amazon-corto', { corto: 'aB3dE5f' }, t)).status, 404);
    }
    assert.deepEqual((await off.call('GET', '/api/lazo/capacidades', null, off.tok.ana)).json, { amazon: false });
    assert.deepEqual((await on.call('GET', '/api/lazo/capacidades', null, on.tok.ana)).json, { amazon: true });
    assert.equal((await on.call('GET', '/api/lazo/capacidades')).status, 401);
    assert.equal(seen.length, 0);
  });

  test('encendida: sin sesión 401, sin grupo 403, y solo un identificador válido llega al servicio', async () => {
    assert.equal((await on.call('POST', '/api/lazo/amazon-lista', { id: LID })).status, 401);
    assert.equal((await on.call('POST', '/api/lazo/amazon-lista', { id: LID }, on.tok.fuera)).status, 403);
    for (const id of ['https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001', 'lazotest00001', '../x', '', 'A'.repeat(17)]) {
      const r = await on.call('POST', '/api/lazo/amazon-lista', { id, url: 'http://10.0.0.1/' }, on.tok.ana);
      assert.equal(r.status, 422, id);
      assert.equal(r.json.code, 'NO_ES_LISTA');
    }
    assert.equal(seen.length, 0);
  });

  test('vista previa: el identificador viaja en el cuerpo con la clave, y la respuesta no depende de quién pregunta', async () => {
    const a = await on.call('POST', '/api/lazo/amazon-lista', { id: LID }, on.tok.ana);
    const b = await on.call('POST', '/api/lazo/amazon-lista', { id: LID }, on.tok.bea);
    assert.equal(a.status, 200);
    assert.deepEqual(a.json, { productos: PRODUCTOS });
    assert.deepEqual(a.json, b.json);
    const last = seen.at(-1);
    assert.equal(last.url, '/wishlist');
    assert.equal(last.key, KEY);
    assert.deepEqual(JSON.parse(last.body), { id: LID });
  });

  test('códigos cerrados: captcha, privada, vacía; los fallos internos son el mismo ERROR', async () => {
    const expect = { LAZOBLOQUEA01: [503, 'AMAZON_BLOQUEA'], LAZOPRIVADA01: [422, 'LISTA_PRIVADA'], LAZOVACIA0001: [422, 'VACIA'], LAZORED000001: [502, 'ERROR'], LAZOHTTP00001: [502, 'ERROR'] };
    let n = 0;
    for (const [id, [status, code]] of Object.entries(expect)) {
      // Cada persona tiene 5 por hora: se reparten entre bea y ana (ana ya gastó 1, bea 1).
      const r = await on.call('POST', '/api/lazo/amazon-lista', { id }, n++ < 3 ? on.tok.bea : on.tok.ana);
      assert.equal(r.status, status, id);
      assert.deepEqual(Object.keys(r.json).sort(), ['code', 'message']);
      assert.equal(r.json.code, code);
      assert.doesNotMatch(r.text, /<|http/);
    }
    assert.match((await on.call('POST', '/api/lazo/amazon-lista', { id: 'LAZOBLOQUEA01' }, on.tok.ana)).json.message, /Amazon no deja leer la lista ahora mismo/);
  });

  test('límite por persona: 5 por hora; otra persona sigue pudiendo', async () => {
    // ana lleva 4 (1 + 2 + 1), bea 4: la 5.ª de ana pasa, la 6.ª no.
    assert.equal((await on.call('POST', '/api/lazo/amazon-lista', { id: LID }, on.tok.ana)).status, 200);
    const before = seen.length;
    const r = await on.call('POST', '/api/lazo/amazon-lista', { id: LID }, on.tok.ana);
    assert.equal(r.status, 429);
    assert.equal(r.json.code, 'LIMITE');
    assert.equal(seen.length, before, 'el rechazo no llega al servicio');
    assert.equal((await on.call('POST', '/api/lazo/amazon-lista', { id: LID }, on.tok.bea)).status, 200);
  });

  test('enlace corto: solo un código, y devuelve solo el identificador', async () => {
    assert.deepEqual((await on.call('POST', '/api/lazo/amazon-corto', { corto: 'aB3dE5f' }, on.tok.ana)).json, { id: LID });
    assert.equal(JSON.parse(seen.at(-1).body).corto, 'aB3dE5f');
    const no = await on.call('POST', '/api/lazo/amazon-corto', { corto: 'zzzz9999' }, on.tok.ana);
    assert.equal(no.json.code, 'NO_ES_LISTA');
    const before = seen.length;
    assert.equal((await on.call('POST', '/api/lazo/amazon-corto', { corto: 'https://amzn.eu/d/x' }, on.tok.ana)).json.code, 'NO_ES_LISTA');
    assert.equal(seen.length, before);
  });

  test('V-40: enlace corto, 30 por persona y hora; otra persona sigue pudiendo', async () => {
    // ana ya gastó 2 en la prueba anterior. El límite por IP (10/min) se apaga aquí para ver el de por persona.
    await on.call('PATCH', '/api/settings', { rateLimits: { enabled: false } }, on.su);
    for (let i = 0; i < 28; i++) assert.equal((await on.call('POST', '/api/lazo/amazon-corto', { corto: 'aB3dE5f' }, on.tok.ana)).status, 200);
    const before = seen.length;
    const r = await on.call('POST', '/api/lazo/amazon-corto', { corto: 'aB3dE5f' }, on.tok.ana);
    assert.equal(r.status, 429);
    assert.equal(r.json.code, 'LIMITE');
    assert.equal(seen.length, before);
    assert.equal((await on.call('POST', '/api/lazo/amazon-corto', { corto: 'aB3dE5f' }, on.tok.bea)).status, 200);
    await on.call('PATCH', '/api/settings', { rateLimits: { enabled: true } }, on.su);
  });
});
