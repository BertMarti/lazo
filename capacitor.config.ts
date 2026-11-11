import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bertmarti.lazo',
  appName: 'Lazo',
  webDir: 'dist',
  // Nunca depurable en las versiones publicadas (se podría leer la sesión desde chrome://inspect).
  android: { webContentsDebuggingEnabled: false, allowMixedContent: false },
  plugins: {
    // Peticiones nativas: NVIDIA NIM no admite CORS desde el navegador.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
