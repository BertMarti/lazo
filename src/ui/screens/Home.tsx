import { Plus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { Occasion } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { go, useApi } from '../ctx';
import { daysUntil, errorText, OCCASION, Sheet, useLoad } from '../kit';

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
          <h2>Aún no tienes ningún grupo</h2>
          <p>Crea uno para Navidad, un cumpleaños o una boda, o pide a alguien de tu familia que te invite.</p>
        </div>
      )}
      <div className="groups">
        {groups?.map((g) => {
          const d = daysUntil(g.date);
          return (
            <a key={g.id} className="group-card" href={`#/g/${g.id}`}>
              <h2>{g.name}</h2>
              <span className="meta">
                {OCCASION[g.occasion]}
                {d !== null && ` · ${d > 1 ? `faltan ${d} días` : d === 1 ? 'es mañana' : d === 0 ? 'es hoy' : 'ya pasó'}`}
              </span>
            </a>
          );
        })}
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim()) return setErr('Ponle un nombre al grupo.');
    setBusy(true);
    try {
      const g = await api.createGroup({ name: name.trim(), occasion, date: date || undefined, currency: 'EUR' });
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
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
