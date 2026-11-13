import { ArrowSquareOut, CaretLeft, CaretRight, Key, LinkSimple, UsersThree, type Icon } from '@phosphor-icons/react';
import { useState } from 'react';
import { PocketBaseApi } from '../../api/pocketbase';
import { Bow } from '../Bow';
import { Button, ButtonLink } from '../Button';
import { CodeForm } from '../kit';

const GUIA = 'https://github.com/BertMarti/lazo/blob/main/docs/PRUEBA-REAL.md';

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

/** Antes de canjear el código: ¿hay un Lazo (PocketBase) en esa dirección? */
export async function checkLazo(origin: string, ms = 8000): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(ms) });
  } catch {
    throw new Error('No encuentro tu Lazo en esa dirección. Comprueba que tienes internet y que la dirección está bien escrita. Si sigue sin salir, avisa a quien organiza.');
  }
  const body = await r.json().catch(() => null);
  if (!r.ok || typeof body?.message !== 'string') throw new Error('Esa dirección no es un Lazo. Revisa que sea la que te han dado.');
}

type Path = 'invite' | 'code' | 'host';

export function Connect({ onReady }: { onReady: (server: string, token?: string) => void }) {
  const [path, setPath] = useState<Path | null>(null);
  return (
    <div className="app connect">
      <header className="masthead">
        <div className="masthead-in">
          <span className="brand">
            <Bow size={30} />
            <span>Lazo</span>
          </span>
        </div>
      </header>
      <main className="stack-lg">
        {path === null ? (
          <>
            <div className="join-hero">
              <h1>Te damos la bienvenida a Lazo</h1>
              <p className="lead">Listas de regalos en familia, sin repetir regalos y sin estropear la sorpresa. ¿Cómo quieres empezar?</p>
            </div>
            <ul className="doors" aria-label="Cómo empezar">
              <Door icon={LinkSimple} title="Me han invitado" text="Tengo un enlace de invitación por WhatsApp" onClick={() => setPath('invite')} />
              <Door icon={Key} title="Tengo un código" text="Me han dado una dirección y un código de 8 caracteres" onClick={() => setPath('code')} />
              <Door icon={UsersThree} title="Quiero organizar un grupo" text="Montar Lazo para mi familia o mis amistades" onClick={() => setPath('host')} />
            </ul>
            <Button variant="ghost" wide onClick={() => onReady('demo')}>Probar la demo</Button>
          </>
        ) : (
          <div className="stack connect-path">
            <Button variant="ghost" icon={CaretLeft} onClick={() => setPath(null)}>Volver</Button>
            {path === 'invite' && <Invite onReady={onReady} />}
            {path === 'code' && <Code onReady={onReady} />}
            {path === 'host' && <Host onCode={() => setPath('code')} />}
          </div>
        )}
      </main>
    </div>
  );
}

function Door({ icon: I, title, text, onClick }: { icon: Icon; title: string; text: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="door" onClick={onClick}>
        <I size={28} weight="duotone" aria-hidden />
        <span className="door-text">
          <b>{title}</b>
          <span>{text}</span>
        </span>
        <CaretRight size={20} weight="bold" aria-hidden />
      </button>
    </li>
  );
}

function Invite({ onReady }: { onReady: (server: string, token?: string) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  return (
    <form
      className="panel stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const inv = parseInvite(text);
        if (!inv) return setErr('Ese enlace no parece una invitación de Lazo. Pide a quien organiza que te lo reenvíe.');
        onReady(inv.server, inv.token);
      }}
    >
      <h2 className="h-section">Me han invitado</h2>
      <p>En WhatsApp, mantén el dedo sobre el mensaje de la invitación y toca «Copiar». Después vuelve aquí y pégalo en este recuadro.</p>
      <label className="field">
        <span>Enlace de invitación</span>
        <input className="input" type="url" inputMode="url" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí el mensaje" autoFocus />
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
      <Button type="submit" variant="primary" size="lg" wide icon={LinkSimple}>Entrar</Button>
    </form>
  );
}

function Code({ onReady }: { onReady: (server: string) => void }) {
  const [server, setServer] = useState('');
  return (
    <CodeForm
      claim={async (code) => {
        let origin = '';
        try {
          const s = server.trim();
          const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
          if (u.protocol === 'https:') origin = u.origin;
        } catch {
          /* no es una dirección */
        }
        if (!origin) throw new Error('Escribe la dirección de tu Lazo, empezando por https://');
        await checkLazo(origin);
        await new PocketBaseApi(origin).claimDevice(code); // la sesión queda guardada en este móvil
        onReady(origin);
      }}
    >
      <label className="field">
        <span>Dirección de tu Lazo</span>
        <input className="input" type="text" inputMode="url" autoCapitalize="none" spellCheck={false} value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://milazo.duckdns.org" />
        <small>Te la da quien organiza. Si ya tienes Lazo en otro móvil, sale junto al código en «Ajustes → Entrar en otro móvil». Ejemplo: https://milazo.duckdns.org</small>
      </label>
    </CodeForm>
  );
}

function Host({ onCode }: { onCode: () => void }) {
  return (
    <section className="panel stack" aria-labelledby="host-h">
      <h2 className="h-section" id="host-h">Quiero organizar un grupo</h2>
      <p>Lazo no guarda vuestras listas en ninguna empresa: se monta en un ordenador de tu casa. Lo hace una vez quien organiza; el resto solo recibe un enlace. Si no te manejas con ordenadores, pídeselo a alguien de la familia: tú solo necesitarás el enlace.</p>
      <ol className="steps">
        <li>Consigue un ordenador que pueda quedarse encendido, por ejemplo una Raspberry Pi.</li>
        <li>Sigue la guía: instalas Lazo y le das una dirección, como https://milazo.duckdns.org.</li>
        <li>Al final, el comando <code>lazo-alta</code> crea tu grupo y te da un código de 8 caracteres.</li>
        <li>Vuelve aquí y entra con «Tengo un código».</li>
      </ol>
      <ButtonLink variant="primary" wide href={GUIA} target="_blank" rel="noopener noreferrer" iconEnd={ArrowSquareOut}>Abrir la guía</ButtonLink>
      <Button variant="secondary" wide icon={Key} onClick={onCode}>Ya tengo mi código</Button>
    </section>
  );
}
