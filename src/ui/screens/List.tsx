import { FileXls, Plus, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { ListDetail } from '../../api/types';
import { budgetProgress } from '../../core/budget';
import { itemStatus } from '../../core/status';
import type { Item } from '../../core/types';
import { BudgetBar } from '../BudgetBar';
import { Button } from '../Button';
import { go, listFlavor, useApi } from '../ctx';
import { GiftCard } from '../Gift';
import { errorText, useLoad, useToast, VisibilityNote } from '../kit';
import { statusLine } from '../statusText';
import type { Title } from '../title';
import { AddGift } from './AddGift';
import { BudgetSheet } from './BudgetSheet';
import { loadGroup, MemberGrid } from './Group';
import { ImportSheet } from './Import';
import { ItemSheet } from './ItemSheet';

const SEEN_KEY = 'lazo:explicado';

/** Lista = elegir regalo. Ajena: presupuesto, «Disponibles» y «Ya cogidos», reservar en 1 toque. Propia: sin estado. */
export function ListScreen({ id, adding, onTitle }: { id: string; adding: boolean; onTitle: (t: Title) => void }) {
  const api = useApi();
  const me = api.me();
  const toast = useToast();
  const { data, error, reload } = useLoad(async () => {
    const d = await api.listDetail(id);
    return { d, group: await loadGroup(api, d.list.group) };
  }, [api, id, me?.id]);
  // Copia local para pintar al instante (optimista); las secciones salen de lo cargado, para que nada se mueva bajo el dedo.
  const [view, setView] = useState<ListDetail | null>(null);
  const [open, setOpen] = useState<{ id: string; focusPot?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [explained, setExplained] = useState(() => {
    try {
      return !!localStorage.getItem(SEEN_KEY);
    } catch {
      return true;
    }
  });

  useEffect(() => setView(data?.d ?? null), [data]);
  useEffect(() => {
    if (!data || !me) return;
    const { d, group } = data;
    const owner = group.detail.members.find((m) => m.id === d.list.user);
    const mine = d.list.user === me.id;
    onTitle({
      name: mine ? 'Tu lista' : d.list.name,
      sub: d.group.name,
      back: `/g/${d.group.id}`,
      avatar: { name: d.list.name, color: owner?.color ?? listFlavor(d.list, group.detail.members) },
    });
  }, [data, me, onTitle]);

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data || !view || !me) return <p className="meta">Cargando…</p>;

  const { d, group } = data;
  const members = group.detail.members;
  const nameOf = (uid: string) => members.find((m) => m.id === uid)?.name ?? 'Alguien';
  const flavor = listFlavor(d.list, members);
  const mine = d.list.user === me.id;
  const who = d.list.name;
  const byPriority = (a: Item, b: Item) => a.priority - b.priority || a.title.localeCompare(b.title, 'es');

  const act = async (item: Item) => {
    const st = itemStatus(item, view.claims, view.contributions);
    const line = statusLine(item, st, view.claims, view.contributions, me.id, nameOf);
    if (line.action === 'pot' || line.action === 'mypart') return setOpen({ id: item.id, focusPot: true });
    setBusy(item.id);
    const fake = { id: `tmp-${item.id}`, item: item.id, user: me.id, units: 1 };
    try {
      if (line.action === 'reserve') {
        setView((v) => v && { ...v, claims: [...v.claims, { ...fake, status: 'reserved' }] });
        setFresh(item.id);
        await api.claim(item.id, 'reserved');
        toast(`Reservado. ${who} no lo verá.`, { action: { label: 'Deshacer', run: () => undo(item.id) } });
      } else if (line.action === 'buy' && line.myClaim) {
        setView((v) => v && { ...v, claims: v.claims.map((c) => (c.id === line.myClaim!.id ? { ...c, status: 'bought' } : c)) });
        setFresh(item.id);
        await api.setClaimStatus(line.myClaim.id, 'bought');
        toast('Apuntado como comprado.', { action: { label: 'Deshacer', run: () => api.setClaimStatus(line.myClaim!.id, 'reserved').then(reload) } });
      } else if (line.action === 'buy-pot') {
        await api.claim(item.id, 'bought');
        toast('Apuntado como comprado.');
      }
      reload();
    } catch (e) {
      setView(data.d);
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const undo = async (itemId: string) => {
    try {
      const fresh = await api.listDetail(id);
      const c = fresh.claims.find((x) => x.item === itemId && x.user === me.id);
      if (c) await api.releaseClaim(c.id);
      toast('Lo has soltado. Vuelve a estar libre.');
    } catch (e) {
      toast(errorText(e));
    }
    reload();
  };

  const card = (i: Item) => {
    const st = d.canSee ? itemStatus(i, view.claims, view.contributions) : undefined;
    return (
      <GiftCard
        key={i.id}
        item={i}
        flavor={flavor}
        status={st}
        line={st ? statusLine(i, st, view.claims, view.contributions, me.id, nameOf) : undefined}
        fresh={fresh === i.id}
        busy={busy === i.id}
        onOpen={() => setOpen({ id: i.id })}
        onAction={() => act(i)}
      />
    );
  };

  // Secciones desde lo cargado (no desde lo optimista).
  const isAvailable = (i: Item) => {
    const k = itemStatus(i, d.claims, d.contributions).kind;
    return k === 'free' || k === 'partial';
  };
  const available = d.items.filter(isAvailable).sort(byPriority);
  const taken = d.items
    .filter((i) => !isAvailable(i))
    .sort((a, b) => Number(isMine(b)) - Number(isMine(a)) || byPriority(a, b));
  function isMine(i: Item) {
    return d.claims.some((c) => c.item === i.id && c.user === me!.id) || d.contributions.some((c) => c.item === i.id && c.user === me!.id);
  }
  const progress = d.budget ? budgetProgress(d.budget.amountCents, view.items, view.claims, view.contributions) : undefined;
  const noPriceClaimed = d.items.filter((i) => i.priceCents === undefined && view.claims.some((c) => c.item === i.id)).length;

  const body = (
    <div className={d.canEdit ? 'has-cta' : undefined}>
      {mine ? (
        <div className="stack" style={{ marginBottom: 'var(--s-6)' }}>
          <VisibilityNote>Tú no ves quién te regala qué. Los demás sí.</VisibilityNote>
        </div>
      ) : (
        <section className="budget-panel" aria-label={`Presupuesto para ${who}`}>
          <div className="budget-panel-head">
            <span className="meta" style={{ fontWeight: 700 }}>Presupuesto para {who}</span>
            <Button variant={d.budget ? 'ghost' : 'secondary'} size="sm" onClick={() => setBudgetOpen(true)}>
              {d.budget ? 'Cambiar' : 'Poner presupuesto'}
            </Button>
          </div>
          {progress && <BudgetBar p={progress} label={`Presupuesto para ${who}`} />}
          <p className="meta">
            {taken.length} de {d.items.length} regalos cogidos
            {noPriceClaimed > 0 && ` · ${noPriceClaimed === 1 ? '1 regalo reservado no tiene precio y no cuenta' : `${noPriceClaimed} regalos reservados no tienen precio y no cuentan`}`}
          </p>
          {d.list.user ? <VisibilityNote>{who} no ve esto</VisibilityNote> : <VisibilityNote>{who} no usa Lazo: esto lo veis todos los mayores</VisibilityNote>}
          {d.list.user && !explained && (
            <div className="notice" style={{ alignItems: 'flex-start' }}>
              <p className="grow">{who} ve su lista, pero no quién reserva, qué se ha comprado ni cuánto os gastáis. Los demás sí lo veis.</p>
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => {
                  setExplained(true);
                  try {
                    localStorage.setItem(SEEN_KEY, '1');
                  } catch {
                    /* sin almacenamiento */
                  }
                }}
              >
                Entendido
              </Button>
            </div>
          )}
        </section>
      )}

      {d.canEdit && (
        <div className="sticky-cta">
          <Button variant="primary" wide icon={Plus} onClick={() => go(`/l/${id}/nuevo`)}>
            Añadir regalo
          </Button>
        </div>
      )}

      {d.items.length === 0 ? (
        <div className="empty">
          <h2>{mine ? 'Tu lista está vacía' : `${who} aún no ha apuntado nada`}</h2>
          {mine && <p>Pega un enlace y listo.</p>}
        </div>
      ) : !d.canSee ? (
        <div className="gifts">{[...d.items].sort(byPriority).map(card)}</div>
      ) : (
        <>
          <h2 className="section-title">
            Disponibles <span className="meta">· {available.length}</span>
          </h2>
          {available.length ? <div className="gifts">{available.map(card)}</div> : <p className="lead" style={{ marginBottom: 'var(--s-8)' }}>Todo cogido para {who}.</p>}
          {taken.length > 0 && (
            <>
              <h2 className="section-title">
                Ya cogidos <span className="meta">· {taken.length}</span>
              </h2>
              <div className="gifts">{taken.map(card)}</div>
            </>
          )}
        </>
      )}
      {d.canEdit && (
        <Button variant="ghost" size="sm" icon={FileXls} onClick={() => setImporting(true)}>
          Importar desde Excel
        </Button>
      )}
    </div>
  );

  return (
    <div className="list-layout">
      <MemberGrid data={group} meId={me.id} compact currentList={id} />
      {body}
      {open && (
        <ItemSheet
          listId={id}
          itemId={open.id}
          focusPot={open.focusPot}
          users={members}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setFresh(open.id);
            reload();
          }}
        />
      )}
      {adding && d.canEdit && <AddGift listId={id} onClose={() => go(`/l/${id}`)} onSaved={reload} onImport={() => { go(`/l/${id}`); setImporting(true); }} />}
      {importing && <ImportSheet listId={id} onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload(); }} />}
      {budgetOpen && <BudgetSheet list={d.list} budget={d.budget} onClose={() => setBudgetOpen(false)} onSaved={() => { setBudgetOpen(false); reload(); }} />}
    </div>
  );
}
