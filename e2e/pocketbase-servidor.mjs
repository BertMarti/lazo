// webServer de e2e/pocketbase.spec.ts: un PocketBase temporal (migraciones + hooks de server/pb) y la app en modo real
// (Vite sin VITE_DEMO) con /api por proxy a ese PocketBase: mismo origen, como en producción. Requiere PB_BIN y
// `npm run build:server`. Uso: PB_BIN=/ruta/pocketbase PW_PB_PORT=5531 node e2e/pocketbase-servidor.mjs
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = process.env.PB_BIN;
const PORT = Number(process.env.PW_PB_PORT);
const PB = `http://127.0.0.1:${PORT + 1}`;
const ROOT = resolve(import.meta.dirname, '..', 'server', 'pb');
// Las mismas credenciales de pruebas que server/test: solo existen en este PocketBase de usar y tirar.
const SU = { identity: 'su@lazo.invalid', password: 'superuser-de-pruebas-123' };

const dir = mkdtempSync(join(tmpdir(), 'lazo-e2e-pb-'));
cpSync(join(ROOT, 'pb_migrations'), join(dir, 'pb_migrations'), { recursive: true });
cpSync(join(ROOT, 'pb_hooks'), join(dir, 'pb_hooks'), { recursive: true });
const flags = [`--dir=${join(dir, 'pb_data')}`, `--migrationsDir=${join(dir, 'pb_migrations')}`, `--hooksDir=${join(dir, 'pb_hooks')}`];
execFileSync(BIN, ['migrate', 'up', ...flags]);
execFileSync(BIN, ['superuser', 'upsert', SU.identity, SU.password, ...flags]);

const kids = [
  spawn(BIN, ['serve', `--http=127.0.0.1:${PORT + 1}`, ...flags], { stdio: 'inherit', env: { ...process.env, UNFURL_KEY: 'x'.repeat(32) } }),
  spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'inherit', env: { ...process.env, VITE_DEMO: undefined, LAZO_PB: PB } }),
];
const stop = () => {
  for (const k of kids) k.kill();
  rmSync(dir, { recursive: true, force: true });
  process.exit(0);
};
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, stop);
for (const k of kids) k.on('exit', stop);
