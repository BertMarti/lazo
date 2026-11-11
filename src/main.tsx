import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DemoApi } from './api/demo';
import { PocketBaseApi } from './api/pocketbase';
import type { Api } from './api/types';
import './styles.css';

// Demo (GitHub Pages): todo en el navegador. App real: la sirve PocketBase desde pb_public (mismo origen);
// en Android, VITE_SERVER_URL apunta a tu Lazo.
let api: Api;
if (import.meta.env.VITE_DEMO) api = new DemoApi();
else {
  const pb = new PocketBaseApi(import.meta.env.VITE_SERVER_URL || location.origin);
  await pb.resume();
  api = pb;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('sw.js').catch(() => {});
}
