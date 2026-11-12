// Depuración manual contra un PocketBase real (no es un test). Uso: PB_BIN=… node server/test/debug-pb.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const ROOT = resolve(import.meta.dirname, '..', 'pb');
const dir = mkdtempSync(join(tmpdir(), 'lazo-dbg-'));
cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
execFileSync(BIN, ['migrate', 'up', ...flags]);
execFileSync(BIN, ['superuser', 'upsert', 'su@lazo.invalid', 'superuser-de-pruebas-123', ...flags]);
const PORT = 18999;
const proc = spawn(BIN, ['serve', `--http=127.0.0.1:${PORT}`, ...flags], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, UNFURL_KEY: 'x'.repeat(32) } });
let log = '';
proc.stdout.on('data', (d) => (log += d));
proc.stderr.on('data', (d) => (log += d));
const BASE = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(BASE + '/api/health')).ok) break;
  } catch {
    /* arrancando */
  }
  await new Promise((r) => setTimeout(r, 100));
}
const call = async (method, path, body, token) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  console.log(method, path, r.status, t.slice(0, 300));
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};
const su = (await call('POST', '/api/collections/_superusers/auth-with-password', { identity: 'su@lazo.invalid', password: 'superuser-de-pruebas-123' })).token;
const u = await call('POST', '/api/collections/users/records', { email: 'a@lazo.invalid', password: 'x'.repeat(20), passwordConfirm: 'x'.repeat(20), name: 'Alberto' }, su);
const tok = (await call('POST', `/api/collections/users/impersonate/${u.id}`, { duration: 3600 }, su)).token;
const g = await call('POST', '/api/collections/groups/records', { name: 'Navidad', occasion: 'navidad', currency: 'EUR', buyMode: 'mixto', plazas: ['Marta', 'Papá'] }, tok);
await call('GET', '/api/collections/lists/records', null, tok);
await call('GET', '/api/collections/lists/records', null, su);
await call('GET', '/api/collections/groups/records', null, tok);
await call('GET', '/api/collections/users/records', null, tok);
await call('POST', '/api/collections/users/auth-refresh', null, tok);
await call('GET', '/api/collections/groups/records?filter=' + encodeURIComponent('id != ""'), null, tok);
const col = await call('GET', '/api/collections/lists', null, su);
console.log('listRule:', col.listRule);
const gcol = await call('GET', '/api/collections/groups', null, su);
console.log('groups listRule:', gcol.listRule);
for (const rule of ['members ?= @request.auth.id', 'members ~ @request.auth.id', '@request.auth.id ?= members', 'owner = @request.auth.id', '@request.auth.id != ""', 'members.id ?= @request.auth.id']) {
  await fetch(BASE + '/api/collections/groups', { method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: su }, body: JSON.stringify({ listRule: rule }) });
  const r = await (await fetch(BASE + '/api/collections/groups/records', { headers: { Authorization: tok } })).json();
  console.log('REGLA', rule, '→', r.totalItems);
}
void g;
proc.kill();
console.log('--- LOG ---\n' + log.slice(-3000));
