/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Las dependencias que se cargan en diferido se optimizan al arrancar: si no, el servidor de desarrollo
  // las descubre al usarlas y recarga la página (rompía la importación en los E2E).
  optimizeDeps: { include: ['xlsx', 'qrcode-generator'] },
  // E2E contra PocketBase real (e2e/pocketbase-servidor.mjs): /api al mismo origen, como cuando PocketBase sirve la PWA.
  server: process.env.LAZO_PB ? { proxy: { '/api': process.env.LAZO_PB } } : undefined,
  test: { environment: 'happy-dom', include: ['test/**/*.test.ts'], exclude: ['e2e/**', 'node_modules/**'] },
});
