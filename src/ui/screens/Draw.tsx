import { Shuffle, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { DrawImpossible } from '../../core/draw';
import { formatMoney, parseAmount } from '../../core/money';
import type { Id } from '../../core/types';
import { Button, ButtonGroup, ButtonLink, IconButton } from '../Button';
import { useApi } from '../ctx';
import { Avatar, errorText, useLoad, useToast } from '../kit';

export function DrawScreen({ groupId }: { groupId: string }) {
  const api = useApi();
  const me = api.me();
  const toast = useToast();
  const { data, error, reload } = useLoad(async () => ({ detail: await api.groupDetail(groupId), info: await api.drawInfo(groupId) }), [api, groupId, me?.id]);
  const [opened, setOpened] = useState(false);
  const [setup, setSetup] = useState(false);

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className="meta">Cargando…</p>;
  const { detail, info } = data;
  const isAdmin = detail.members.some((m) => m.id === me?.id && m.role === 'admin');

  return (
    <div className="stack-lg">
      <p className="lead">Solo tú sabes a quién regalas. Ni quien organiza ve el resto.</p>
      {info.receiver ? (
        <div className="envelope" data-open={opened || undefined}>
          <p className="meta" style={{ color: 'var(--on-box-2)' }}>Te ha tocado regalar a</p>
          <Avatar user={info.receiver} size="lg" />
          <p className="who">{info.receiver.name}</p>
          {info.draw?.budgetCents ? <p>Presupuesto: <span className="money">{formatMoney(info.draw.budgetCents)}</span></p> : null}
          {(() => {
            const l = detail.lists.find((x) => x.user === info.receiver!.id);
            return l && opened ? <ButtonLink variant="on-box" href={`#/l/${l.id}`}>Ver la lista de {info.receiver.name}</ButtonLink> : null;
          })()}
          <button type="button" className="cover" onClick={() => setOpened(true)} aria-label="Abrir tu sobre del amigo invisible">
            <span className="h-section" style={{ color: 'var(--foil)' }}>Tu sobre</span>
            <span>Toca para ver a quién regalas</span>
            <span className="meta" style={{ color: 'var(--on-box-2)' }}>Mira que nadie te esté mirando.</span>
          </button>
        </div>
      ) : info.draw ? (
        <p className="notice">Este grupo ya tiene sorteo, pero tú no participas.</p>
      ) : (
        <div className="empty">
          <h2>Todavía no hay sorteo</h2>
          <p>{isAdmin ? 'Elige quién participa y qué parejas no pueden tocarse.' : 'Cuando quien organiza el grupo lo haga, aquí verás tu sobre.'}</p>
        </div>
      )}
      {isAdmin && !setup && (
        <ButtonGroup>
          <Button variant={info.draw ? 'danger' : 'primary'} size={info.draw ? 'sm' : 'md'} icon={Shuffle} onClick={() => setSetup(true)}>{info.draw ? 'Repetir el sorteo' : 'Preparar el sorteo'}</Button>
        </ButtonGroup>
      )}
      {isAdmin && setup && (
        <DrawSetup
          members={detail.members}
          redo={!!info.draw}
          onCancel={() => setSetup(false)}
          onRun={async (participants, exclusions, budget) => {
            await api.runDraw(groupId, participants, exclusions, budget);
            toast('Sorteo hecho. Cada uno ya tiene su sobre.');
            setSetup(false);
            setOpened(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function DrawSetup({ members, redo, onCancel, onRun }: { members: { id: Id; name: string; color: string }[]; redo: boolean; onCancel: () => void; onRun: (p: Id[], e: [Id, Id][], b?: number) => Promise<void> }) {
  const [chosen, setChosen] = useState<Set<Id>>(new Set(members.map((m) => m.id)));
  const [pairs, setPairs] = useState<[Id, Id][]>([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sure, setSure] = useState(false);
  const name = (id: Id) => members.find((m) => m.id === id)?.name ?? '';

  const run = async () => {
    setErr('');
    if (redo && !sure) return setSure(true);
    const cents = budget.trim() ? parseAmount(budget) : undefined;
    if (budget.trim() && !cents) return setErr('El presupuesto no se entiende. Escribe por ejemplo 30.');
    setBusy(true);
    try {
      await onRun([...chosen], pairs.filter(([x, y]) => chosen.has(x) && chosen.has(y)), cents ?? undefined);
    } catch (e) {
      setErr(e instanceof DrawImpossible && e.who ? `${e.reason} (${name(e.who)})` : errorText(e));
      setBusy(false);
    }
  };

  return (
    <section className="panel stack-lg" aria-label="Preparar el sorteo">
      <div className="stack">
        <h3 className="h-section" style={{ fontSize: 'var(--t-lg)' }}>Quién participa</h3>
        <div className="grid-2">
          {members.map((m) => (
            <label key={m.id} className="check">
              <input type="checkbox" checked={chosen.has(m.id)} onChange={(e) => setChosen((s) => { const n = new Set(s); if (e.target.checked) n.add(m.id); else n.delete(m.id); return n; })} />
              <Avatar user={m} size="sm" />
              <span>{m.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="stack">
        <h3 className="h-section" style={{ fontSize: 'var(--t-lg)' }}>Quién no puede tocarse</h3>
        <p className="meta">Por ejemplo, las parejas, que ya se regalan entre ellas.</p>
        {pairs.length > 0 && (
          <ul className="list-plain">
            {pairs.map(([x, y], i) => (
              <li key={`${x}-${y}`}>
                <span className="grow">{name(x)} y {name(y)}</span>
                <IconButton icon={X} label={`Quitar ${name(x)} y ${name(y)}`} onClick={() => setPairs((p) => p.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ul>
        )}
        <div className="grid-2">
          <select className="select" aria-label="Primera persona" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Elige…</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="select" aria-label="Segunda persona" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Elige…</option>
            {members.filter((m) => m.id !== a).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <Button variant="secondary" disabled={!a || !b || a === b} onClick={() => { setPairs((p) => [...p, [a, b]]); setA(''); setB(''); }}>Añadir pareja</Button>
      </div>
      <label className="field">
        <span>Presupuesto por regalo</span>
        <input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="30" />
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
      {sure && <p className="notice" role="alert">El sorteo anterior se borrará y cada persona tendrá un sobre nuevo. Pulsa otra vez para confirmar.</p>}
      <ButtonGroup>
        <Button variant="primary" icon={Shuffle} loading={busy} disabled={chosen.size < 3} onClick={run}>{sure ? 'Sí, sortear de nuevo' : `Sortear entre ${chosen.size}`}</Button>
        <Button variant="ghost" icon={X} onClick={onCancel}>Cancelar</Button>
      </ButtonGroup>
    </section>
  );
}
