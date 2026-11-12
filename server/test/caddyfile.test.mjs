// V-16: la lista blanca de colecciones del Caddyfile bloquea la administración (también por id) y deja pasar la app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const caddy = readFileSync(resolve(import.meta.dirname, '..', 'Caddyfile'), 'utf8');
const block = /@adminCollections \{([\s\S]*?)\n\t\}/.exec(caddy)?.[1];
assert.ok(block, 'falta el bloque @adminCollections');
const allow = new RegExp(/not path_regexp (\S+)/.exec(block)[1]);
const inScope = (p) => p === '/api/collections' || p.startsWith('/api/collections/');
const blocked = (p) => inScope(p) && !allow.test(p);
const admin = /@admin path (.+)/.exec(caddy)[1].split(/\s+/);
const adminBlocked = (p) => admin.some((g) => (g.endsWith('*') ? p.startsWith(g.slice(0, -1)) : p === g));

test('bloquea la administración, también con el id fijo de _superusers', () => {
  for (const p of [
    '/api/collections/pbc_3142635823/auth-with-password',
    '/api/collections/_superusers/records',
    '/api/collections/_superusers/auth-with-password',
    '/api/collections/users/impersonate/x',
    '/api/collections/users/auth-with-password',
    '/api/collections/users/truncate',
    '/api/collections/users',
    '/api/collections',
    '/api/collections/import',
    '/api/collections/items/records/abc/../x',
  ])
    assert.ok(blocked(p) || adminBlocked(p), p);
  for (const p of ['/_/', '/api/settings', '/api/logs', '/api/backups', '/api/crons']) assert.ok(adminBlocked(p), p);
});

test('deja pasar lo que usa la app', () => {
  for (const p of ['/api/collections/items/records', '/api/collections/items/records/abc123', '/api/collections/users/auth-refresh', '/api/collections/joinRequests/records/x1', '/api/lazo/gift', '/api/realtime', '/api/files/items/abc/foto.webp'])
    assert.ok(!blocked(p) && !adminBlocked(p), p);
});
