import { Plus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { BuyMode, Occasion } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { go, useApi } from '../ctx';
import { Bow, Loading } from '../Bow';
import { Avatar, daysUntil, errorText, OCCASION, Sheet, useLoad } from '../kit';

export function Home() {
  const api = useApi();
  const { data: groups, error, reload } = useLoad(() => api.groups(), [api]);
  const [creating, setCreating] = useState(false);
  // Con un solo grupo, directo a él (la mayoría llega invitada a uno).
  useEffect(() => {
    if (groups?.length === 1 && !sessionStorage.getItem('lazo:inicio')) {
      sessionStorage.setItem('lazo:inicio', '1');
      go(`/g/${groups[0]!.id}`);
    }
  }, [groups]);
  return (
    <div className="stack-lg">
      {error && <p className="notice notice-error">{error}</p>}
      {groups && groups.length === 0 && (
        <div className="empty">
          <Bow size={88} />
          <h2>Aún no tienes ningún grupo</h2>
          <p>Crea uno para Navidad, un cumpleaños o una boda, o pide a alguien de tu familia que te invite.</p>
        </div>
      )}
      {!groups && !error && <Loading />}
      <div className="groups">
        {groups?.map((g) => (
          <GroupCard key={g.id} id={g.id} name={g.name} occasion={g.occasion} date={g.date} />
        ))}
      </div>
      <div>
        <Button variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
          {groups?.length ? 'Crear otro grupo' : 'Crear grupo'}
        </Button>
      </div>
      {creating && (
        <NewGroup
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            reload();
            go(`/g/${id}`);
          }}
        />
      )}
    </div>
  );
}

function NewGroup({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const api = useApi();
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState<Occasion>('navidad');
  const [date, setDate] = useState('');
  const [buyMode, setBuyMode] = useState<BuyMode>('mixto');
  const [plazas, setPlazas] = useState('');
  const [allowNew, setAllowNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim()) return setErr('Ponle un nombre al grupo.');
    setBusy(true);
    try {
      const g = await api.createGroup({ name: name.trim(), occasion, date: date || undefined, currency: 'EUR', buyMode, plazas: plazas.split('\n'), allowNewNames: allowNew });
      onCreated(g.id);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Nuevo grupo"
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button variant="primary" loading={busy} onClick={submit}>Crear grupo</Button>
        </ButtonGroup>
      }
    >
      <label className="field">
        <span>Nombre</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Navidad en casa de la abuela" maxLength={80} autoFocus />
      </label>
      <label className="field">
        <span>Ocasión</span>
        <select className="select" value={occasion} onChange={(e) => setOccasion(e.target.value as Occasion)}>
          {Object.entries(OCCASION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Fecha</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <small>Para la cuenta atrás. Puedes dejarla vacía.</small>
      </label>
      <fieldset className="field">
        <legend>¿Cómo compráis?</legend>
        <div className="segmented">
          {(['hucha', 'individual', 'mixto'] as const).map((m) => (
            <label key={m}>
              <input type="radio" name="mode" checked={buyMode === m} onChange={() => setBuyMode(m)} />
              {MODE[m].label}
            </label>
          ))}
        </div>
        <small>{MODE[buyMode].help}</small>
      </fieldset>
      <label className="field">
        <span>¿Quiénes sois? (opcional)</span>
        <textarea className="textarea" value={plazas} onChange={(e) => setPlazas(e.target.value)} placeholder={'Mamá\nPapá\nSamira'} />
        <small>Un nombre por línea. Cada uno tendrá su sitio aunque aún no haya entrado.</small>
      </label>
      <label className="check">
        <input type="checkbox" checked={allowNew} onChange={(e) => setAllowNew(e.target.checked)} />
        <span>Dejar que alguien entre con un nombre que no esté en la lista <span className="meta">(tendrás que aceptarlo tú)</span></span>
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}

export const MODE: Record<BuyMode, { label: string; help: string }> = {
  hucha: { label: 'Hucha común', help: 'Ponéis dinero entre todos y los regalos salen de ahí.' },
  individual: { label: 'Cada uno lo suyo', help: 'Cada regalo lo paga quien lo reserva.' },
  mixto: { label: 'Mixto', help: 'Se decide regalo a regalo.' },
};

/** Tarjeta de un grupo: la ocasión, la cuenta atrás, las caras de la familia y cuatro deseos. */
function GroupCard({ id, name, occasion, date }: { id: string; name: string; occasion: string; date?: string }) {
  const api = useApi();
  const me = api.me()?.id;
  const { data } = useLoad(async () => {
    const d = await api.groupDetail(id);
    const others = d.lists.filter((l) => l.user !== me);
    const photos = (await Promise.all(others.slice(0, 6).map((l) => api.listDetail(l.id))))
      .flatMap((l) => l.items.filter((i) => i.image && !i.removed).slice(0, 1))
      .slice(0, 4);
    return { members: d.members, photos };
  }, [api, id, me]);
  const d = daysUntil(date);
  return (
    <a className="group-card" href={`#/g/${id}`}>
      <Bow size={40} />
      <h2>{name}</h2>
      <span className="meta">
        {OCCASION[occasion]}
        {d !== null && ` · ${d > 1 ? `faltan ${d} días` : d === 1 ? 'es mañana' : d === 0 ? 'es hoy' : 'ya pasó'}`}
      </span>
      {data && (
        <span className="faces" aria-label={`${data.members.length} personas`}>
          {data.members.slice(0, 7).map((m) => (
            <Avatar key={m.id} user={m} size="md" />
          ))}
        </span>
      )}
      {data && data.photos.length > 0 && (
        <span className="photos" aria-hidden>
          {data.photos.map((i) => (
            <img key={i.id} src={i.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ))}
        </span>
      )}
    </a>
  );
}
