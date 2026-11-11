import { UserPlus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { GroupDetail, ListDetail } from '../../api/types';
import { budgetProgress } from '../../core/budget';
import { itemStatus } from '../../core/status';
import { IconButton } from '../Button';
import { go, lastGroup, listFlavor, useApi } from '../ctx';
import { useLoad } from '../kit';
import { MemberCard } from '../MemberCard';
import type { Title } from '../title';
import { BudgetSheet } from './BudgetSheet';
import { InviteSheet } from './Invite';

/** Grupo = elegir persona. Tarjetas de miembro: la mía primero, luego por nombre. */
export function GroupScreen({ id, onTitle }: { id: string; onTitle: (t: Title) => void }) {
  const api = useApi();
  const me = api.me();
  const { data, error, reload } = useLoad(() => loadGroup(api, id), [api, id, me?.id]);
  const [inviting, setInviting] = useState(false);
  const [budgetFor, setBudgetFor] = useState<ListDetail | null>(null);

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
  if (!data) return <p className="meta">Cargando…</p>;

  return (
    <>
      <MemberGrid data={data} meId={me?.id} onAdd={(l) => go(`/l/${l}/nuevo`)} onSetBudget={setBudgetFor} />
      {inviting && <InviteSheet groupId={id} onClose={() => setInviting(false)} onChanged={reload} />}
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

export async function loadGroup(api: ReturnType<typeof useApi>, id: string) {
  const detail = await api.groupDetail(id);
  const lists = await Promise.all(detail.lists.map((l) => api.listDetail(l.id)));
  return { detail, lists };
}

export function MemberGrid({ data, meId, compact, currentList, onAdd, onSetBudget }: {
  data: { detail: GroupDetail; lists: ListDetail[] };
  meId?: string;
  compact?: boolean;
  currentList?: string;
  onAdd?: (listId: string) => void;
  onSetBudget?: (l: ListDetail) => void;
}) {
  const sorted = [...data.lists].sort((a, b) => Number(b.list.user === meId) - Number(a.list.user === meId) || a.list.name.localeCompare(b.list.name, 'es'));
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
              freeCount={l.canSee ? l.items.filter((i) => itemStatus(i, l.claims, l.contributions).kind === 'free').length : null}
              budget={l.canSee && l.budget ? budgetProgress(l.budget.amountCents, l.items, l.claims, l.contributions) : undefined}
              compact={compact}
              current={currentList === l.list.id}
              onAdd={mine && onAdd ? () => onAdd(l.list.id) : undefined}
              onSetBudget={l.canSee && onSetBudget ? () => onSetBudget(l) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
