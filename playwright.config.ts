import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT) || 5181;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: { command: `VITE_DEMO=1 npx vite --port ${PORT} --strictPort --host 127.0.0.1`, url: `http://127.0.0.1:${PORT}`, reuseExistingServer: false },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
