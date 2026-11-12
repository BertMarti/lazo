// Alta del organizador por consola (`pocketbase lazo-alta`) y entrada con el código en un PocketBase real.
// Uso: PB_BIN=/ruta/pocketbase node --test server/test/alta.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = 18600 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(import.meta.dirname, '..', 'pb');

let dir, proc, out;

async function call(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, json: text ? JSON.parse(text) : null, text };
}

describe('lazo-alta: el organizador entra con un código', { skip: !BIN && 'Falta PB_BIN (binario de PocketBase)' }, () => {
  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'lazo-alta-'));
    cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
    cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
    const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
    execFileSync(BIN, ['migrate', 'up', ...flags]);
    out = execFileSync(BIN, ['lazo-alta', 'Ana', 'Navidad', '2026-12-24', ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    proc = spawn(BIN, ['serve', `--http=127.0.0.1:${PORT}`, ...flags], { stdio: 'ignore', env: { ...process.env, UNFURL_KEY: 'x'.repeat(32) } });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(BASE + '/api/health')).ok) break;
      } catch {
        /* arrancando */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  after(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('el código canjea una vez y Ana es admin de su grupo', async () => {
    const code = /escribe ([A-Z0-9]{8})\b/.exec(out)?.[1];
    assert.ok(code, `sin código en la salida: ${out}`);
    assert.match(out, /Tengo un código/);

    const claim = await call('POST', '/api/lazo/device-claim', { code });
    assert.equal(claim.status, 200, claim.text);
    assert.ok(claim.json.token);
    assert.equal(claim.json.record.name, 'Ana');
    assert.equal((await call('POST', '/api/lazo/device-claim', { code })).status, 400);

    const tok = claim.json.token;
    const groups = await call('GET', '/api/collections/groups/records', null, tok);
    assert.equal(groups.status, 200);
    assert.equal(groups.json.items.length, 1);
    const g = groups.json.items[0];
    assert.equal(g.name, 'Navidad');
    assert.equal(g.date, '2026-12-24');
    assert.deepEqual(g.admins, [claim.json.record.id]);
    const lists = await call('GET', '/api/collections/lists/records', null, tok);
    assert.ok(lists.json.items.some((l) => l.user === claim.json.record.id && l.via === 'creator'), 'falta la plaza de Ana');

    const inv = await call('POST', '/api/lazo/invite', { group: g.id }, tok);
    assert.equal(inv.status, 200, inv.text);
    assert.ok(inv.json.token);
  });
});
