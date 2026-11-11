import { CaretRight, Plus, UserPlus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { itemStatus } from '../../core/status';
import type { GiftList } from '../../core/types';
import type { GroupDetail, ListDetail } from '../../api/types';
import { Button, ButtonGroup } from '../Button';
import { go, lastGroup, listFlavor, useApi } from '../ctx';
import { GiftTag } from '../Gift';
import { Avatar, useLoad } from '../kit';
import { ItemSheet } from './ItemSheet';
import { InviteSheet } from './Invite';

export function GroupScreen({ id, onTitle }: { id: string; onTitle: (g: GroupDetail['group']) => void }) {
  const api = useApi();
  const me = api.me();
  const { data, error, reload } = useLoad(async () => {
    const detail = await api.groupDetail(id);
    const lists = await Promise.all(detail.lists.map((l) => api.listDetail(l.id)));
    return { detail, lists };
  }, [api, id, me?.id]);
  const [open, setOpen] = useState<{ list: ListDetail; itemId: string } | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (data) {
      onTitle(data.detail.group);
      lastGroup.set(id);
    }
  }, [data, id, onTitle]);

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className="meta">Abriendo la caja…</p>;
  const { detail, lists } = data;
  const isAdmin = detail.members.some((m) => m.id === me?.id && m.role === 'admin');
  // Mi lista primero; luego el resto por nombre.
  const sorted = [...lists].sort((a, b) => Number(b.list.user === me?.id) - Number(a.list.user === me?.id) || a.list.name.localeCompare(b.list.name, 'es'));
  const myList = lists.find((l) => l.list.user === me?.id);

  return (
    <div className="stack-lg">
      <div className="section-head">
        <p className="lead">{detail.members.length} personas · {lists.reduce((s, l) => s + l.items.length, 0)} regalos en {lists.length} listas</p>
        <ButtonGroup>
          {myList && <Button variant="primary" icon={Plus} onClick={() => go(`/l/${myList.list.id}/nuevo`)}>Añadir a mi lista</Button>}
          {isAdmin && <Button variant="secondary" icon={UserPlus} onClick={() => setInviting(true)}>Invitar</Button>}
        </ButtonGroup>
      </div>
      <div className="family">
        {sorted.map((l) => (
          <PersonRow key={l.list.id} detail={l} users={detail.members} mine={l.list.user === me?.id} onOpen={(itemId) => setOpen({ list: l, itemId })} />
        ))}
      </div>
      {open && (
        <ItemSheet
          listId={open.list.list.id}
          itemId={open.itemId}
          users={detail.members}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
      {inviting && <InviteSheet groupId={id} onClose={() => setInviting(false)} onChanged={reload} />}
    </div>
  );
}

function PersonRow({ detail, users, mine, onOpen }: { detail: ListDetail; users: GroupDetail['members']; mine: boolean; onOpen: (itemId: string) => void }) {
  const { list, items, claims, contributions, canSee } = detail;
  const owner = users.find((u) => u.id === list.user);
  const flavor = listFlavor(list, users);
  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  const free = canSee ? items.filter((i) => itemStatus(i, claims, contributions).kind === 'free').length : null;
  return (
    <section className="person" aria-labelledby={`p-${list.id}`}>
      <a className="person-head" href={`#/l/${list.id}`}>
        <Avatar user={{ name: list.name, color: owner?.color ?? flavor }} size="lg" />
        <div>
          <h2 id={`p-${list.id}`}>{mine ? 'Tu lista' : list.name}</h2>
          <p className="meta">{subtitle(list, items.length, free, mine)}</p>
        </div>
        <CaretRight className="go" size={22} weight="bold" aria-hidden />
      </a>
      {items.length === 0 ? (
        <div className="rail-empty">{mine ? 'Tu lista está vacía. Añade lo primero que se te ocurra.' : 'Todavía no ha apuntado nada.'}</div>
      ) : (
        <div className="rail" role="list">
          {sorted.map((i) => (
            <div role="listitem" key={i.id}>
              <GiftTag item={i} flavor={flavor} status={canSee ? itemStatus(i, claims, contributions) : undefined} onOpen={() => onOpen(i.id)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function subtitle(list: GiftList, n: number, free: number | null, mine: boolean) {
  const gifts = `${n} ${n === 1 ? 'regalo' : 'regalos'}`;
  if (mine) return `${gifts} · aquí no verás lo que te reservan`;
  const child = !list.user ? ` · la llevan sus padres` : '';
  return free === null ? gifts + child : `${gifts} · ${free} ${free === 1 ? 'libre' : 'libres'}${child}`;
}
