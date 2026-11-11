import { LinkSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../Button';

/** Solo en la app de Android, la primera vez: el enlace de invitación dice dónde está tu Lazo. */
export function parseInvite(text: string): { server: string; token: string } | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    const token = u.hash.match(/^#\/unirse\/([A-Za-z0-9]{20,64})$/)?.[1];
    if (u.protocol !== 'https:' || !token) return null;
    return { server: u.origin, token };
  } catch {
    return null;
  }
}

export function Connect({ onReady }: { onReady: (server: string, token?: string) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <h1>Bienvenida a Lazo</h1>
        </div>
      </header>
      <main>
        <form
          className="panel stack"
          style={{ maxWidth: 480, margin: '0 auto' }}
          onSubmit={(e) => {
            e.preventDefault();
            const inv = parseInvite(text);
            if (!inv) return setErr('Ese enlace no parece una invitación de Lazo. Pídele a quien organiza que te lo reenvíe.');
            onReady(inv.server, inv.token);
          }}
        >
          <p>Pega aquí el enlace de invitación que te han mandado por WhatsApp.</p>
          <label className="field">
            <span>Enlace de invitación</span>
            <input className="input" type="url" inputMode="url" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…/#/unirse/…" autoFocus />
          </label>
          {err && <p className="notice notice-error" role="alert">{err}</p>}
          <Button type="submit" variant="primary" size="lg" wide icon={LinkSimple}>Entrar</Button>
          <p className="divider">o</p>
          <Button variant="secondary" wide onClick={() => onReady('demo')}>Probar la demo</Button>
        </form>
      </main>
    </div>
  );
}
