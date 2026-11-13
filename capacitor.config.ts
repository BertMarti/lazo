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
    // De serie en Capacitor 8 (sin dependencia nueva). La app va de borde a borde (viewport-fit=cover) y el CSS deja
    // sitio con --safe-area-inset-* (inyectadas con «css») o env(). DEFAULT: iconos oscuros en claro y claros en
    // oscuro, igual que el tema de la app (prefers-color-scheme sigue al sistema).
    SystemBars: { insetsHandling: 'css', style: 'DEFAULT', initialViewportFitValueHint: 'cover' },
  },
};

export default config;
