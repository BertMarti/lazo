import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { androidBack } from './ui/atras';
import { guardaCompartido } from './ui/compartido';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DemoApi } from './api/demo';
import { PocketBaseApi } from './api/pocketbase';
import { Connect } from './ui/screens/Connect';
import './styles.css';

const SERVER_KEY = 'lazo:server';
const native = Capacitor.isNativePlatform();
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

// Web: la PWA la sirve PocketBase (mismo origen). Pages: la demo. Android: el servidor sale del enlace de invitación.
// ?bienvenida=1 solo existe en la demo: las E2E ven la pantalla del primer arranque del APK.
const server = import.meta.env.VITE_DEMO ? (new URLSearchParams(location.search).has('bienvenida') ? null : 'demo') :import.meta.env.VITE_SERVER_URL || (native ? read(SERVER_KEY) : location.origin);
const root = createRoot(document.getElementById('root')!);
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

async function start(srv: string | null) {
  if (!srv) {
    return render(
      <Connect
        onReady={(s, token) => {
          try {
            localStorage.setItem(SERVER_KEY, s);
          } catch {
            /* sin almacenamiento */
          }
          if (token) location.hash = `/unirse/${token}`;
          void start(s);
        }}
      />,
    );
  }
  if (srv === 'demo') {
    const demo = new DemoApi();
    // Solo en la demo: las pruebas E2E actúan como otra persona desde la misma página (tiempo real).
    if (import.meta.env.VITE_DEMO) Object.assign(window, { __lazoDemo: demo });
    return render(<App api={demo} />);
  }
  const pb = new PocketBaseApi(srv);
  await pb.resume();
  render(<App api={pb} />);
}
void start(server);

// Android: «Compartir → Lazo» con texto (la lista de Amazon seleccionada y compartida). Plugin propio en MainActivity.
if (native) {
  const share = registerPlugin<{ take(): Promise<{ text?: string }>; addListener(e: 'share', f: (d: { text?: string }) => void): Promise<unknown> }>('LazoShare');
  const open = (text?: string) => {
    if (!text) return;
    guardaCompartido(text);
    location.hash = '/amazon';
  };
  share.take().then((r) => open(r.text), () => {});
  void share.addListener('share', (d) => open(d.text));
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    if (androidBack(!!document.querySelector('dialog[open]'), canGoBack) === 'back') history.back();
    else void CapApp.exitApp();
  });
  // App Links (APK compilado con LAZO_HOST): un enlace de invitación abre la app en «Unirse».
  const invite = (url?: string) => {
    if (!url) return;
    const u = new URL(url);
    if (!/^#\/unirse\/[A-Za-z0-9]{20,64}$/.test(u.hash)) return;
    if (!read(SERVER_KEY)) {
      // Primera vez: el servidor es el del enlace, como si se hubiera pegado en «Tengo un enlace».
      try {
        localStorage.setItem(SERVER_KEY, u.origin);
      } catch {
        return;
      }
      location.hash = u.hash;
      return location.reload();
    }
    if (u.origin === read(SERVER_KEY)) location.hash = u.hash;
  };
  void CapApp.addListener('appUrlOpen', (e) => invite(e.url));
  CapApp.getLaunchUrl().then((r) => invite(r?.url), () => {});
}

if (import.meta.env.PROD && !native && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('sw.js').catch(() => {});
}
