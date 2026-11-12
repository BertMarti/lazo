// V-22: lazo-backup.sh cifra las copias con BACKUP_PASSPHRASE, las restaura y rota «antes-de-restaurar-*».
// Corre el script de verdad con sh, tar y openssl. sqlite3 se sustituye por uno falso (aquí solo importa el script).
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT = new URL('../backup/lazo-backup.sh', import.meta.url).pathname;
const has = (bin) => { try { execFileSync('sh', ['-c', `command -v ${bin}`]); return true; } catch { return false; } };
const skip = process.platform === 'win32' || !has('openssl') ? 'hace falta sh y openssl' : false;

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'lazo-backup-'));
  const [src, dst, bin] = ['pb', 'backups', 'bin'].map((d) => join(root, d));
  for (const d of [src, dst, bin]) mkdirSync(d);
  writeFileSync(join(src, 'data.db'), 'reservas de la familia');
  // sqlite3 falso: «.backup 'destino'» copia el archivo; PRAGMA integrity_check responde ok.
  writeFileSync(join(bin, 'sqlite3'), `#!/bin/sh\ncase "$2" in .backup*) cp "$1" "$(echo "$2" | sed "s/^.backup '\\(.*\\)'$/\\1/")";; *) echo ok;; esac\n`);
  chmodSync(join(bin, 'sqlite3'), 0o755);
  const run = (args = [], pass = 'clave-de-prueba') =>
    execFileSync('sh', [SCRIPT, ...args], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PB_DATA: src, BACKUP_DIR: dst, BACKUP_PASSPHRASE: pass }, encoding: 'utf8', stdio: 'pipe' });
  return { src, dst, run };
}

describe('lazo-backup.sh', { skip }, () => {
  it('con clave, la copia sale cifrada y se restaura con la misma clave', () => {
    const { src, dst, run } = setup();
    run();
    const [copy] = readdirSync(dst).filter((f) => f.startsWith('lazo-'));
    assert.match(copy, /^lazo-\d{8}-\d{6}\.tar\.gz\.enc$/);
    const raw = readFileSync(join(dst, copy));
    assert.equal(raw.subarray(0, 8).toString(), 'Salted__', 'formato de openssl enc, no un gzip');
    assert.ok(!raw.includes('reservas de la familia'));

    writeFileSync(join(src, 'data.db'), 'roto');
    assert.throws(() => run(['restore', join(dst, copy)], 'otra-clave'), /descifrar|no parece/);
    assert.equal(readFileSync(join(src, 'data.db'), 'utf8'), 'roto', 'una clave mala no borra nada');
    run(['restore', join(dst, copy)]);
    assert.equal(readFileSync(join(src, 'data.db'), 'utf8'), 'reservas de la familia');
  });

  it('sin clave, la copia va en claro como antes', () => {
    const { dst, run } = setup();
    run([], '');
    assert.match(readdirSync(dst).find((f) => f.startsWith('lazo-')), /\.tar\.gz$/);
  });

  it('tras cinco restauraciones quedan tres «antes-de-restaurar»', async () => {
    const { dst, run } = setup();
    run();
    const copy = join(dst, readdirSync(dst).find((f) => f.startsWith('lazo-')));
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1100)); // el nombre lleva la hora al segundo
      run(['restore', copy]);
    }
    assert.equal(readdirSync(dst).filter((f) => f.startsWith('antes-de-restaurar-')).length, 3);
  });
});
