import { UserPlus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { Api, GroupDetail, ListDetail } from '../../api/types';
import { budgetProgress } from '../../core/budget';
import { itemStatus } from '../../core/status';
import { Button, ButtonGroup, IconButton } from '../Button';
import { go, lastGroup, listFlavor, useApi } from '../ctx';
import { errorText, useLoad, useToast } from '../kit';
import { MemberCard } from '../MemberCard';
import type { Title } from '../title';
import { BudgetSheet } from './BudgetSheet';
import { InviteSheet } from './Invite';

/** Grupo = elegir persona. Tarjetas de plaza: la mía primero, luego por nombre; las libres al final. */
export function GroupScreen({ id, onTitle }: { id: string; onTitle: (t: Title) => void }) {
  const api = useApi();
  const me = api.me();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => loadGroup(api, id, true), [api, id, me?.id]);
  const [inviting, setInviting] = useState<string | boolean>(false);
  const [budgetFor, setBudgetFor] = useState<ListDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const isAdmin = !!data?.detail.members.some((m) => m.id === me?.id && m.role === 'admin');
  useEffect(() => {
    if (!data) return;
    const g = data.detail.group;
    lastGroup.set(id);
    onTitle({
      name: g.name,
      date: g.date,
      back: '/',
      actions: isAdmin ? <IconButton icon={UserPlus} label="Invitar a la familia" onBox onClick={() => setInviting(true)} /> : undefined,
    });
  }, [data, id, isAdmin, onTitle]);

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data || !me) return <p className="meta">Cargando…</p>;
  const g = data.detail.group;
  const nameOf = (uid?: string) => data.detail.members.find((m) => m.id === uid)?.name ?? 'Alguien';
  const myPlaza = data.detail.lists.find((l) => l.user === me.id);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      reload();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const past = g.date ? new Date(g.date + 'T23:59:59') < new Date() : false;

  return (
    <>
      {data.requests.map((r) => (
        <div key={r.id} className="banner" role="region" aria-label="Solicitud de entrada">
          <p>
            Alguien quiere entrar como <b>{r.name}</b> · código <b className="money">{r.code}</b>
          </p>
          <p className="meta">Pregúntale el código a {r.name} antes de aceptar.</p>
          <ButtonGroup>
            <Button variant="primary" size="sm" loading={busy === `a${r.id}`} onClick={() => run(`a${r.id}`, () => api.decideJoin(r.id, true), `${r.name} ya está dentro.`)}>Aceptar</Button>
            <Button variant="secondary" size="sm" loading={busy === `r${r.id}`} onClick={() => run(`r${r.id}`, () => api.decideJoin(r.id, false), 'Entrada rechazada.')}>No es {r.name}</Button>
          </ButtonGroup>
        </div>
      ))}
      {!g.revealedAt && g.revealAskedBy && g.revealAskedBy !== me.id && (
        <div className="banner">
          <p><b>{nameOf(g.revealAskedBy)} quiere abrir la entrega.</b> Cada uno podrá ver qué le regalaron.</p>
          <ButtonGroup>
            <Button variant="primary" size="sm" loading={busy === 'rv'} onClick={() => run('rv', () => api.reveal(id, 'confirm'), 'Entrega abierta.')}>De acuerdo</Button>
          </ButtonGroup>
        </div>
      )}
      {!g.revealedAt && g.revealAskedBy === me.id && (
        <div className="banner">
          <p>Falta que alguien más diga que sí para abrir la entrega.</p>
          <ButtonGroup><Button variant="link" onClick={() => run('rc', () => api.reveal(id, 'cancel'), 'Propuesta retirada.')}>Retirar</Button></ButtonGroup>
        </div>
      )}
      {!g.revealedAt && !g.revealAskedBy && isAdmin && past && (
        <div className="banner">
          <p><b>Ya ha pasado la fecha.</b> ¿Abrís la entrega? Cada uno podrá ver qué le regalaron y de parte de quién. Los precios no se enseñan.</p>
          <ButtonGroup><Button variant="primary" size="sm" loading={busy === 'ask'} onClick={() => run('ask', () => api.reveal(id, 'ask'), 'Propuesta enviada.')}>Proponer abrirla</Button></ButtonGroup>
        </div>
      )}
      {!!g.revealedAt && myPlaza && (
        <div className="banner">
          <p><b>La entrega está abierta.</b></p>
          <ButtonGroup><Button variant="secondary" size="sm" onClick={() => go(`/recibido/${id}`)}>Ver qué me regalaron</Button></ButtonGroup>
        </div>
      )}
      <MemberGrid data={data} meId={me.id} onAdd={(l) => go(`/l/${l}/nuevo`)} onSetBudget={setBudgetFor} onInvite={isAdmin ? (l) => setInviting(l) : undefined} />
      {inviting && <InviteSheet groupId={id} focusList={typeof inviting === 'string' ? inviting : undefined} onClose={() => setInviting(false)} onChanged={reload} />}
      {budgetFor && (
        <BudgetSheet
          list={budgetFor.list}
          budget={budgetFor.budget}
          onClose={() => setBudgetFor(null)}
          onSaved={() => {
            setBudgetFor(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export async function loadGroup(api: Api, id: string, withRequests = false) {
  const detail = await api.groupDetail(id);
  const lists = await Promise.all(detail.lists.map((l) => api.listDetail(l.id)));
  const me = api.me()?.id;
  const admin = detail.members.some((m) => m.id === me && m.role === 'admin');
  const requests = withRequests && admin ? await api.joinRequests(id) : [];
  return { detail, lists, requests };
}

export function MemberGrid({ data, meId, compact, currentList, onAdd, onSetBudget, onInvite }: {
  data: { detail: GroupDetail; lists: ListDetail[] };
  meId?: string;
  compact?: boolean;
  currentList?: string;
  onAdd?: (listId: string) => void;
  onSetBudget?: (l: ListDetail) => void;
  onInvite?: (listId: string) => void;
}) {
  const rank = (l: ListDetail) => (l.list.user === meId ? 0 : l.list.user || l.list.kind === 'child' ? 1 : 2);
  const sorted = [...data.lists].sort((a, b) => rank(a) - rank(b) || a.list.name.localeCompare(b.list.name, 'es'));
  const mode = data.detail.group.buyMode;
  return (
    <div className={compact ? 'list-side' : 'members'} role="list" aria-label="Familia">
      {sorted.map((l) => {
        const mine = l.list.user === meId;
        const owner = data.detail.members.find((m) => m.id === l.list.user);
        return (
          <div role="listitem" key={l.list.id}>
            <MemberCard
              list={l.list}
              owner={owner}
              flavor={listFlavor(l.list, data.detail.members)}
              mine={mine}
              giftCount={l.items.length}
              freeCount={l.canSee ? l.items.filter((i) => !i.removed && itemStatus(i, l.claims, l.contributions).kind === 'free').length : null}
              budget={l.canSee && l.budget ? budgetProgress(l.budget.amountCents, l.items, l.claims, l.contributions, mode) : undefined}
              compact={compact}
              current={currentList === l.list.id}
              onAdd={mine && onAdd ? () => onAdd(l.list.id) : undefined}
              onSetBudget={l.canSee && onSetBudget ? () => onSetBudget(l) : undefined}
              onInvite={onInvite ? () => onInvite(l.list.id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
