import { defineConfig, devices } from '@playwright/test';

// PW_PORT permite correr varias suites a la vez (worktrees en paralelo) sin chocar.
const PORT = Number(process.env.PW_PORT || 5181);
// e2e/pocketbase.spec.ts: la app en modo real contra un PocketBase temporal (PORT+1 la app, PORT+2 PocketBase). Sin PB_BIN se salta.
const PB_PORT = PORT + 1;
const PB = 'pocketbase.spec.ts';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: [
    { command: `VITE_DEMO=1 npx vite --port ${PORT} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${PORT}`, reuseExistingServer: false },
    ...(process.env.PB_BIN ? [{ command: `PW_PB_PORT=${PB_PORT} node e2e/pocketbase-servidor.mjs`, url: `http://127.0.0.1:${PB_PORT}`, reuseExistingServer: false }] : []),
  ],
  projects: [
    { name: 'movil', testIgnore: PB, use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', testIgnore: PB, use: { viewport: { width: 1440, height: 900 } } },
    { name: 'pocketbase', testMatch: PB, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: `http://127.0.0.1:${PB_PORT}` } },
  ],
});
