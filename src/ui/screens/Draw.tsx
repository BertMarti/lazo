import { CopySimple, EyeSlash, PaperPlaneTilt, Shuffle, Warning, X } from '@phosphor-icons/react';
import { Bow, Loading } from '../Bow';
import { useEffect, useRef, useState } from 'react';
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
  if (!data) return <Loading />;
  const { detail, info } = data;
  const isAdmin = detail.members.some((m) => m.id === me?.id && m.role === 'admin');

  return (
    <div className="stack-lg">
      <p className="lead">Solo tú sabes a quién regalas. Ni quien organiza ve el resto.</p>
      {info.receiver ? (
        <Package
          receiver={info.receiver}
          groupName={detail.group.name}
          budgetCents={info.draw?.budgetCents}
          listId={detail.lists.find((x) => x.user === info.receiver!.id)?.id}
          opened={opened}
          setOpened={setOpened}
        />
      ) : info.draw ? (
        <p className="notice">Este grupo ya tiene sorteo, pero tú no participas.</p>
      ) : (
        <div className="empty">
          <Bow size={88} />
          <h2>Todavía no hay sorteo</h2>
          <p>{isAdmin ? 'Elige quién participa y qué parejas no pueden tocarse.' : 'Cuando quien organiza el grupo lo haga, aquí verás a quién te toca regalar.'}</p>
        </div>
      )}
      {isAdmin && !setup && (
        <ButtonGroup>
          {info.draw ? (
            <Button variant="link" onClick={() => setSetup(true)}>Repetir el sorteo</Button>
          ) : (
            <Button variant="primary" icon={Shuffle} onClick={() => setSetup(true)}>Preparar el sorteo</Button>
          )}
        </ButtonGroup>
      )}
      {isAdmin && setup && (
        <DrawSetup
          members={detail.members}
          redo={!!info.draw}
          onCancel={() => setSetup(false)}
          onRun={async (participants, exclusions, budget) => {
            await api.runDraw(groupId, participants, exclusions, budget);
            toast('Sorteo hecho. Cada uno ya sabe a quién regala.');
            setSetup(false);
            setOpened(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Texto para reenviárselo uno mismo: solo tu persona y su lista, nada del resto del sorteo. */
export function shareMessage(groupName: string, receiver: string, listUrl?: string) {
  const text = `Amigo invisible de ${groupName}: te toca regalar a ${receiver}.`;
  return { text, url: listUrl, copy: listUrl ? `${text} ${listUrl}` : text };
}

/**
 * El paquete en abeto atado con cinta dorada. Al abrirlo (≈900 ms, solo transform y opacity): el lazo se
 * deshace, las dos bandas de cinta salen por los bordes, la tapa se levanta y aparece la persona.
 * «Taparlo» lo cierra al momento. Con reduced-motion, fundido de 150 ms.
 */
function Package({ receiver, groupName, budgetCents, listId, opened, setOpened }: {
  receiver: { name: string; color: string };
  groupName: string;
  budgetCents?: number;
  listId?: Id;
  opened: boolean;
  setOpened: (o: boolean) => void;
}) {
  const toast = useToast();
  const coverRef = useRef<HTMLButtonElement>(null);
  const whoRef = useRef<HTMLParagraphElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    (opened ? whoRef : coverRef).current?.focus({ preventScroll: true });
  }, [opened]);

  const listUrl = listId ? `${location.origin}${location.pathname}#/l/${listId}` : undefined;
  const msg = shareMessage(groupName, receiver.name, listUrl);
  const canShare = typeof navigator.share === 'function';
  const send = async () => {
    if (canShare) {
      try { await navigator.share({ title: 'Amigo invisible', text: msg.text, url: msg.url }); } catch { /* cancelado */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(msg.copy);
      toast('Copiado. Pégatelo en un chat contigo mismo');
    } catch {
      toast('No se ha podido copiar. Apúntatelo a mano.');
    }
  };

  return (
    <div className="envelope" data-open={opened || undefined}>
      <div className="envelope-inside" inert={!opened} aria-hidden={!opened}>
        <p className="meta">Te ha tocado regalar a</p>
        <Avatar user={receiver} size="lg" />
        <p className="who" ref={whoRef} tabIndex={-1}>{receiver.name}</p>
        {budgetCents ? <p>Presupuesto: <span className="money">{formatMoney(budgetCents)}</span></p> : null}
        {listId && <ButtonLink variant="primary" href={`#/l/${listId}`}>Ver la lista de {receiver.name}</ButtonLink>}
        <p className="notice envelope-warn"><Warning size={20} weight="bold" aria-hidden />Es solo para ti: no lo reenvíes al grupo de la familia.</p>
        <ButtonGroup align="stretch">
          <Button variant="secondary" icon={canShare ? PaperPlaneTilt : CopySimple} onClick={send}>{canShare ? 'Enviármelo' : 'Copiar'}</Button>
          <Button variant="ghost" icon={EyeSlash} onClick={() => setOpened(false)}>Taparlo</Button>
        </ButtonGroup>
      </div>
      <button ref={coverRef} type="button" className="cover" inert={opened} onClick={() => setOpened(true)} aria-label="Abrir el paquete del amigo invisible">
        <span className="ribbon ribbon-v" aria-hidden />
        <span className="ribbon ribbon-h" aria-hidden />
        <span className="cover-bow"><Bow size={96} /></span>
        <span className="h-section">Te ha tocado…</span>
        <span className="cover-cta">Abrir el paquete</span>
        <span>Mira que nadie te esté mirando</span>
      </button>
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
        <h3 className="h-section" style={{ fontSize: 'var(--t-3)' }}>Quién participa</h3>
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
        <h3 className="h-section" style={{ fontSize: 'var(--t-3)' }}>Quién no puede tocarse</h3>
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
      {sure && <p className="notice" role="alert">El sorteo anterior se borrará y a cada persona le tocará alguien nuevo. Pulsa otra vez para confirmar.</p>}
      <ButtonGroup>
        <Button variant="primary" icon={Shuffle} loading={busy} disabled={chosen.size < 3} onClick={run}>{sure ? 'Sí, sortear de nuevo' : `Sortear entre ${chosen.size}`}</Button>
        <Button variant="ghost" icon={X} onClick={onCancel}>Cancelar</Button>
      </ButtonGroup>
    </section>
  );
}
