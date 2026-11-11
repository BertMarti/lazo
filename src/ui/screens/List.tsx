import { FileXls, Gift as GiftIcon, Plus } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { itemStatus } from '../../core/status';
import { Button, ButtonGroup } from '../Button';
import { go, listFlavor, useApi } from '../ctx';
import { GiftTag } from '../Gift';
import { useLoad } from '../kit';
import { ImportSheet } from './Import';
import { ItemForm } from './ItemForm';
import { ItemSheet } from './ItemSheet';

export function ListScreen({ id, adding, onTitle }: { id: string; adding: boolean; onTitle: (t: { name: string; sub: string; groupId: string }) => void }) {
  const api = useApi();
  const me = api.me();
  const { data, error, reload } = useLoad(async () => {
    const d = await api.listDetail(id);
    const g = await api.groupDetail(d.list.group);
    return { ...d, members: g.members };
  }, [api, id, me?.id]);
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (data) onTitle({ name: data.list.user === me?.id ? 'Tu lista' : data.list.name, sub: data.group.name, groupId: data.group.id });
  }, [data, me?.id, onTitle]);

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className="meta">Abriendo la lista…</p>;
  const { list, items, claims, contributions, canSee, canEdit, members } = data;
  const mine = list.user === me?.id;
  const flavor = listFlavor(list, members);
  const sorted = [...items].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'es'));
  const closeAdd = () => go(`/l/${id}`);
  const age = list.birthYear ? new Date().getFullYear() - list.birthYear : undefined;

  return (
    <div>
      <header className="list-head" data-flavor={flavor} hidden={!canEdit && !list.notes && !!list.user}>
        {!list.user && <p>La llevan {list.managers.map((m) => members.find((u) => u.id === m)?.name ?? 'sus padres').join(' y ')}{age ? ` · ${age} años` : ''}.</p>}
        {list.notes && <p>{list.notes}</p>}
        {mine && (
          <div className="secret">
            <GiftIcon size={22} weight="bold" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p>Aquí no verás lo que te han reservado ni comprado. Ni tú ni nadie desde tu cuenta: es la gracia.</p>
          </div>
        )}
        {canEdit && (
          <ButtonGroup>
            <Button variant="primary" icon={Plus} onClick={() => go(`/l/${id}/nuevo`)}>Añadir regalo</Button>
            <Button variant="secondary" icon={FileXls} onClick={() => setImporting(true)}>Importar Excel</Button>
          </ButtonGroup>
        )}
      </header>

      {items.length === 0 ? (
        <div className="empty">
          <h2>{canEdit ? 'Lista vacía' : 'Todavía no hay nada'}</h2>
          <p>{canEdit ? 'Pega un enlace de Amazon o de cualquier tienda, escríbelo a mano o sube un Excel.' : `${list.name} aún no ha apuntado regalos.`}</p>
        </div>
      ) : (
        <div className="gifts">
          {sorted.map((i) => (
            <GiftTag key={i.id} item={i} flavor={flavor} status={canSee ? itemStatus(i, claims, contributions) : undefined} fresh={fresh.has(i.id)} onOpen={() => setOpen(i.id)} />
          ))}
        </div>
      )}

      {open && (
        <ItemSheet
          listId={id}
          itemId={open}
          users={members}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setFresh(new Set([open]));
            reload();
          }}
        />
      )}
      {adding && canEdit && <ItemForm listId={id} onClose={closeAdd} onSaved={() => { closeAdd(); reload(); }} />}
      {importing && <ImportSheet listId={id} onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload(); }} />}
    </div>
  );
}
