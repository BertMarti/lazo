import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5181', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: { command: 'VITE_DEMO=1 npx vite --port 5181 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5181', reuseExistingServer: false },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
