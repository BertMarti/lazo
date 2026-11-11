import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DemoApi } from './api/demo';
import './styles.css';

// ponytail: de momento siempre la demo; PocketBaseApi entra en la v0.2.0 (VITE_DEMO decidirá).
const api = new DemoApi();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('sw.js').catch(() => {});
}
