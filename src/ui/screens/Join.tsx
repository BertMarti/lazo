import { WhatsappLogo } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Bow, Loading } from '../Bow';
import type { InviteInfo } from '../../api/types';
import { Button, ButtonLink } from '../Button';
import { go, useApi } from '../ctx';
import { Avatar, errorText, useLoad } from '../kit';

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

type PendingReq = { request: string; code: string; group: string; name: string };

/** La solicitud pendiente se guarda por enlace: si el abuelo vuelve a abrirlo, sigue viendo su código. */
const pendingKey = (token: string) => `lazo:pendiente:${token}`;
function readPending(token: string): PendingReq | null {
  try {
    const v = localStorage.getItem(pendingKey(token));
    return v ? (JSON.parse(v) as PendingReq) : null;
  } catch {
    return null;
  }
}
function savePending(token: string, p: PendingReq | null) {
  try {
    if (p) localStorage.setItem(pendingKey(token), JSON.stringify(p));
    else localStorage.removeItem(pendingKey(token));
  } catch {
    /* sin almacenamiento: queda solo en memoria */
  }
}

/**
 * Entrar desde un enlace (spec plazas-hucha §10.4–10.5):
 * personal → «Eres Mamá» y dentro; general → «¿Quién eres?» → pendiente con un código que el admin comprueba.
 */
export function Join({ token, onJoined }: { token: string; onJoined: () => void }) {
  const api = useApi();
  const { data: info, error } = useLoad(() => api.inviteInfo(token), [api, token]);
  const [pending, setPending] = useState<PendingReq | null>(() => readPending(token));
  if (error) return <Box><p className="notice notice-error">{error}</p></Box>;
  if (!info) return <Loading />;
  if (pending) return <Pending {...pending} organizer={info.organizer} onJoined={onJoined} onDecided={() => savePending(token, null)} />;
  return info.personal ? (
    <Personal token={token} info={info} onJoined={onJoined} />
  ) : (
    <General
      token={token}
      info={info}
      onPending={(p) => {
        savePending(token, p);
        setPending(p);
      }}
    />
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="join">
      <div className="panel stack">{children}</div>
    </div>
  );
}

/** La pantalla de los abuelos: el lazo grande y a qué te invitan, sin jerga. */
function Head({ info }: { info: InviteInfo }) {
  return (
    <div className="join-hero">
      <Bow size={72} />
      <h1>
        Te han invitado a <span style={{ color: 'var(--terracota-tinta)' }}>{info.group.name}</span>
      </h1>
      <p className="lead">
        {info.group.date && `${DATE.format(new Date(info.group.date + 'T12:00:00'))} · `}lo organiza {info.organizer}
      </p>
    </div>
  );
}

function Personal({ token, info, onJoined }: { token: string; info: InviteInfo; onJoined: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notMe, setNotMe] = useState(false);
  const name = info.personal!.name;
  return (
    <Box>
      <Head info={info} />
      <h2 className="h-section" style={{ fontSize: 'var(--t-1)' }}>Eres {name}</h2>
      <Button
        variant="primary"
        size="lg"
        wide
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api.join(token, {});
            onJoined();
            go(`/g/${r.group}`);
          } catch (e) {
            setErr(errorText(e));
            setBusy(false);
          }
        }}
      >
        Entrar
      </Button>
      <p className="meta">Desde aquí no verás lo que te regalan a ti.</p>
      <Button variant="link" onClick={() => setNotMe(true)}>No soy {name}</Button>
      {notMe && <p className="notice">Este enlace es solo para {name}. Pide a {info.organizer} tu propio enlace.</p>}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Box>
  );
}

function General({ token, info, onPending }: { token: string; info: InviteInfo; onPending: (p: PendingReq) => void }) {
  const api = useApi();
  const [choice, setChoice] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const chosen = info.free.find((f) => f.list === choice);
  const label = choice === 'new' ? (newName.trim() ? `Soy ${newName.trim()}` : 'Escribe tu nombre') : chosen ? `Soy ${chosen.name}` : 'Primero toca tu nombre';
  const ready = choice === 'new' ? !!newName.trim() : !!chosen;

  return (
    <Box>
      <Head info={info} />
      <h2 className="h-section">¿Quién eres?</h2>
      <p>Toca tu nombre. Después, {info.organizer} te dejará entrar.</p>
      {info.free.length === 0 && !info.allowNewNames ? (
        <p>Ya han entrado todos. Pide a {info.organizer} que te añada.</p>
      ) : (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 'var(--s-2)' }}>
          <legend className="sr-only">Tu nombre</legend>
          {info.free.map((f) => (
            <label key={f.list} className="choice">
              <input type="radio" name="plaza" value={f.list} checked={choice === f.list} onChange={() => setChoice(f.list)} />
              <Avatar user={{ name: f.name, color: 'almendra' }} />
              {f.name}
            </label>
          ))}
          {info.allowNewNames && (
            <label className="choice">
              <input type="radio" name="plaza" value="new" checked={choice === 'new'} onChange={() => setChoice('new')} />
              No estoy en la lista
            </label>
          )}
          {choice === 'new' && (
            <label className="field">
              <span>Tu nombre</span>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} autoComplete="given-name" autoFocus />
            </label>
          )}
        </fieldset>
      )}
      <Button
        variant="primary"
        size="lg"
        wide
        disabled={!ready}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            const r = await api.join(token, choice === 'new' ? { name: newName.trim() } : { list: choice });
            if ('pending' in r) onPending({ request: r.request, code: r.code, group: r.group, name: choice === 'new' ? newName.trim() : chosen!.name });
            else go(`/g/${r.group}`);
          } catch (e) {
            setErr(errorText(e));
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Box>
  );
}

function Pending({ request, code, group, name, organizer, onJoined, onDecided }: PendingReq & { organizer: string; onJoined: () => void; onDecided: () => void }) {
  const api = useApi();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(() => {
      api.requestStatus(request).then((s) => {
        setStatus(s);
        if (s !== 'pending') onDecided();
        if (s === 'approved') {
          onJoined();
          go(`/g/${group}`);
        }
      }, () => {});
    }, 3000);
    return () => clearInterval(t);
  }, [api, request, status, group, onJoined, onDecided]);
  return (
    <Box>
      {status === 'rejected' ? (
        <p>{organizer} no ha aceptado esta entrada. Habla con {organizer}.</p>
      ) : (
        <>
          <h2 className="h-section">Ya casi estás, {name}</h2>
          <p>Solo falta que {organizer} te deje entrar. Mándale este código para que sepa que eres tú:</p>
          <p className="code" aria-label={`Código ${code.split('').join(' ')}`}>{code}</p>
          <ButtonLink
            variant="primary"
            size="lg"
            wide
            icon={WhatsappLogo}
            target="_blank"
            rel="noopener noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`Hola, ${organizer}. Soy ${name}. Mi código de Lazo es ${code}.`)}`}
          >
            Enviar el código por WhatsApp
          </ButtonLink>
          <p className="meta" role="status">Esperando a {organizer}… Esta pantalla cambiará sola cuando te acepte.</p>
          <p className="meta">Si la cierras, no pasa nada: cuando te acepte, abre Lazo y ya estarás dentro.</p>
        </>
      )}
    </Box>
  );
}
