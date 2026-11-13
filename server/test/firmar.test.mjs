// V-36: el APK firmado con LAZO_HOST se llama distinto del público (lazo-<ver>-<host>.apk).
// Uso: node --test server/test/firmar.test.mjs (necesita bash)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const script = readFileSync(resolve(import.meta.dirname, '..', '..', 'scripts', 'firmar-apk.sh'), 'utf8');
const line = script.split('\n').find((l) => l.startsWith('OUT='));

test('el nombre del APK delata LAZO_HOST', () => {
  const out = (host) => execFileSync('bash', ['-c', `VER=1.2.3; ${line}; printf %s "$OUT"`], { env: { PATH: process.env.PATH, ...(host ? { LAZO_HOST: host } : {}) } }).toString();
  assert.equal(out(), 'dist-apk/lazo-1.2.3.apk');
  assert.equal(out('milazo.example'), 'dist-apk/lazo-1.2.3-milazo.example.apk');
  assert.match(script, /grep -c autoVerify/, 'comprueba que el APK público no reclama dominios');
  assert.match(script, /VITE_LAZO_HOST="\$\{LAZO_HOST:-\}" npm run build/, 'V-33: el host de compilación llega a la web');
});
