/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: { environment: 'happy-dom', include: ['test/**/*.test.ts'], exclude: ['e2e/**', 'node_modules/**'] },
});
