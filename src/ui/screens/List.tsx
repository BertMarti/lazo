import { Gift as GiftIcon, FileXls, Lightbulb, Plus, Printer, ShareNetwork, X } from '@phosphor-icons/react';
import { Bow, Loading } from '../Bow';
import { useEffect, useState } from 'react';
import type { ListDetail } from '../../api/types';
import { budgetProgress, committedOn } from '../../core/budget';
import { ledger } from '../../core/hucha';
import { formatMoney } from '../../core/money';
import { itemStatus } from '../../core/status';
import type { Claim, Item } from '../../core/types';
import { BudgetBar } from '../BudgetBar';
import { Button } from '../Button';
import { go, listFlavor, useApi } from '../ctx';
import { GiftCard } from '../Gift';
import { errorText, useLive, useLoad, useToast, VisibilityNote } from '../kit';
import { statusLine, type CardAction } from '../statusText';
import type { Title } from '../title';
import { AddGift } from './AddGift';
import { BudgetSheet } from './BudgetSheet';
import { BuySheet, keeperFor } from './BuySheet';
import { loadGroup, MemberGrid } from './Group';
import { IdeasSheet } from './Ideas';
import { ImportSheet } from './Import';
import { ItemForm } from './ItemForm';
import { ItemSheet } from './ItemSheet';
import { ShareSheet } from './Printable';

const SEEN_KEY = 'lazo:explicado';

/** Lista = elegir regalo. Ajena: presupuesto, «Disponibles» y «Ya cogidos», acciones de 1 toque. Propia: sin estado. */
export function ListScreen({ id, adding, onTitle }: { id: string; adding: boolean; onTitle: (t: Title) => void }) {
  const api = useApi();
  const me = api.me();
  const toast = useToast();
  const { data, error, reload } = useLoad(async () => {
    const d = await api.listDetail(id);
    return { d, group: await loadGroup(api, d.list.group) };
  }, [api, id, me?.id]);
  useLive(data?.d.list.group, reload);
  // Copia local para pintar al instante (optimista); las secciones salen de lo cargado, para que nada se mueva bajo el dedo.
  const [view, setView] = useState<ListDetail | null>(null);
  const [open, setOpen] = useState<{ id: string; focusPot?: boolean } | null>(null);
  const [buying, setBuying] = useState<{ item: Item; claim?: Claim } | null>(null);
  const [busy, setBusy] = useState<{ item: string; kind: string } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [ideas, setIdeas] = useState(false);
  const [surprise, setSurprise] = useState(false);
  const [sharing, setSharing] = useState(false);
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
    onTitle({
      name: d.list.user === me.id ? 'Tu lista' : d.list.name,
      sub: d.group.name,
      back: `/g/${d.group.id}`,
      backLabel: d.group.name,
      avatar: { name: d.list.name, color: owner?.color ?? listFlavor(d.list, group.detail.members) },
    });
  }, [data, me, onTitle]);

  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data || !view || !me) return <Loading />;

  const { d, group } = data;
  const members = group.detail.members;
  const mode = d.group.buyMode;
  const nameOf = (uid: string) => members.find((m) => m.id === uid)?.name ?? 'Alguien';
  const flavor = listFlavor(d.list, members);
  const mine = d.list.user === me.id;
  const who = d.list.name;
  const keeper = keeperFor(d.group, d.list, group.detail.lists);
  const byPriority = (a: Item, b: Item) => a.priority - b.priority || a.title.localeCompare(b.title, 'es');

  const act = async (item: Item, a: CardAction) => {
    if (a.kind === 'pot' || a.kind === 'mypart') return setOpen({ id: item.id, focusPot: true });
    if (a.kind === 'buy') return setBuying({ item, claim: a.claim });
    if (a.kind === 'buy-pot') return setBuying({ item });
    const kind = a.kind === 'reserve-pot' ? 'pot' : 'self';
    setBusy({ item: item.id, kind: a.kind });
    setView((v) => v && { ...v, claims: [...v.claims, { id: `tmp-${item.id}`, item: item.id, user: me.id, kind, status: 'reserved', units: 1 }] });
    setFresh(item.id);
    try {
      await api.gift({ action: 'reserve', item: item.id, kind });
      toast(kind === 'pot' ? `Apuntado para la hucha. ${who} no lo verá.` : `Reservado. ${who} no lo verá.`, { action: { label: 'Deshacer', run: () => undo(item.id, kind) } });
      reload();
    } catch (e) {
      setView(data.d);
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const undo = async (itemId: string, kind: 'self' | 'pot') => {
    try {
      const now = await api.listDetail(id);
      const c = now.claims.find((x) => x.item === itemId && x.user === me.id && (x.kind ?? 'self') === kind && x.status === 'reserved');
      if (c) await api.gift({ action: 'release', claim: c.id });
      toast(kind === 'pot' ? 'Quitado de la hucha.' : 'Lo has soltado. Vuelve a estar libre.');
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
        owner={who}
        line={st ? statusLine(i, st, view.claims, view.contributions, me.id, nameOf, mode) : undefined}
        fresh={fresh === i.id}
        busy={busy?.item === i.id ? busy.kind : null}
        onOpen={() => setOpen({ id: i.id })}
        onAction={(a) => act(i, a)}
      />
    );
  };

  const isAvailable = (i: Item) => {
    const k = itemStatus(i, d.claims, d.contributions).kind;
    return (k === 'free' || k === 'partial') && !i.removed;
  };
  const isMine = (i: Item) => d.claims.some((c) => c.item === i.id && (c.user === me.id || c.paidBy === me.id)) || d.contributions.some((c) => c.item === i.id && c.user === me.id);
  const available = d.items.filter(isAvailable).sort(byPriority);
  const taken = d.items.filter((i) => !isAvailable(i)).sort((a, b) => Number(isMine(b)) - Number(isMine(a)) || byPriority(a, b));
  const progress = d.budget ? budgetProgress(d.budget.amountCents, view.items, view.claims, view.contributions, mode) : undefined;
  const pot = d.canSee ? ledger(d.list, { members: members.map((m) => m.id), items: view.items, claims: view.claims }) : undefined;
  const advancers = pot ? Object.keys(pot.adv).map(nameOf) : [];
  const ownExtra = mode === 'mixto' ? committedOn(view.items, view.claims, view.contributions).own : 0;
  const noPrice = d.items.filter((i) => i.priceCents === undefined && view.claims.some((c) => c.item === i.id && c.status === 'reserved')).length;

  const body = (
    <div className={d.canEdit ? 'has-cta' : undefined}>
      {mine ? (
        <div style={{ marginBottom: 'var(--s-6)' }}>
          <VisibilityNote wide>Lo que te regalan es sorpresa: aquí solo ves lo que has pedido.</VisibilityNote>
        </div>
      ) : (
        <section className="budget-panel" aria-label={`Presupuesto para ${who}`}>
          <div className="budget-panel-head">
            <span className="meta">Presupuesto para {who}</span>
            <Button variant={d.budget ? 'link' : 'secondary'} size="sm" onClick={() => setBudgetOpen(true)}>
              {d.budget ? 'Cambiar' : 'Poner presupuesto'}
            </Button>
          </div>
          {progress && <BudgetBar p={progress} label={`Presupuesto para ${who}`} />}
          {pot && pot.spent > 0 && (
            <p className="meta">
              Hucha de {who}: {formatMoney(pot.spent, d.group.currency, true)} entre {pot.sharers.length} · sale a {formatMoney(Math.round(pot.spent / Math.max(1, pot.sharers.length)), d.group.currency, true)} por persona
              {advancers.length > 0 && ` · adelantó ${advancers.join(' y ')}`}
            </p>
          )}
          {ownExtra > 0 && <p className="meta">Además, por su cuenta: {formatMoney(ownExtra)}</p>}
          <p className="meta">
            {taken.length} de {d.items.length} regalos cogidos
            {noPrice > 0 && ` · ${noPrice === 1 ? '1 reservado no tiene precio y no cuenta' : `${noPrice} reservados no tienen precio y no cuentan`}`}
          </p>
          {d.list.user ? <VisibilityNote>{who} no ve esto</VisibilityNote> : d.list.kind === 'child' ? <VisibilityNote wide>{who} no usa Lazo: esto lo veis todos los mayores</VisibilityNote> : <p className="meta">{who} aún no ha entrado. Cuando entre, dejará de ver todo esto.</p>}
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

      {d.items.length === 0 && d.canSee === false ? (
        <div className="empty">
          <Bow size={88} />
          <h2>Tu lista está vacía</h2>
          <p>Pega un enlace y listo.</p>
        </div>
      ) : !d.canSee ? (
        <div className="gifts">{[...d.items].sort(byPriority).map(card)}</div>
      ) : (
        <>
          <h2 className="section-title">
            Disponibles <span className="meta">· {available.length}</span>
          </h2>
          {available.length ? (
            <div className="gifts">{available.map(card)}</div>
          ) : (
            <p className="lead" style={{ marginBottom: 'var(--s-4)' }}>{d.items.length ? `Todo cogido para ${who}.` : `${who} aún no ha apuntado nada.`}</p>
          )}
          {d.list.kind !== 'child' && !mine && (
            <Button variant="link" icon={GiftIcon} onClick={() => setSurprise(true)}>
              Apuntar una sorpresa
            </Button>
          )}
          {taken.length > 0 && (
            <>
              <h2 className="section-title" style={{ marginTop: 'var(--s-6)' }}>
                Ya cogidos <span className="meta">· {taken.length}</span>
              </h2>
              <div className="gifts">{taken.map(card)}</div>
            </>
          )}
        </>
      )}
      <div className="btn-group">
        <Button variant="link" icon={Lightbulb} onClick={() => setIdeas(true)}>
          {d.canEdit ? 'Ideas para la lista' : `Ideas para ${who}`}
        </Button>
        {d.canEdit && (
          <Button variant="link" icon={FileXls} onClick={() => setImporting(true)}>
            Importar desde Excel
          </Button>
        )}
        <Button variant="link" icon={Printer} onClick={() => go(`/imprimir/${id}`)}>
          Imprimir la lista
        </Button>
        {d.canEdit && (
          <Button variant="link" icon={ShareNetwork} onClick={() => setSharing(true)}>
            {mine ? 'Compartir mi lista (solo lectura)' : `Compartir la lista de ${who} (solo lectura)`}
          </Button>
        )}
      </div>
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
          lists={group.detail.lists}
          onBuy={(item, claim) => {
            setOpen(null);
            setBuying({ item, claim });
          }}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setFresh(open.id);
            reload();
          }}
        />
      )}
      {buying && (
        <BuySheet
          item={buying.item}
          list={d.list}
          group={d.group}
          members={members}
          claim={buying.claim}
          keeper={keeper}
          onClose={() => setBuying(null)}
          onDone={() => {
            setFresh(buying.item.id);
            setBuying(null);
            reload();
          }}
        />
      )}
      {surprise && (
        <ItemForm
          listId={id}
          surpriseFor={who}
          onClose={() => setSurprise(false)}
          onSaved={() => {
            setSurprise(false);
            reload();
          }}
        />
      )}
      {adding && d.canEdit && <AddGift listId={id} onClose={() => go(`/l/${id}`)} onSaved={reload} onImport={() => { go(`/l/${id}`); setImporting(true); }} />}
      {importing && <ImportSheet listId={id} onClose={() => setImporting(false)} onDone={() => { setImporting(false); reload(); }} />}
      {sharing && <ShareSheet listId={id} who={who} mine={mine} onClose={() => setSharing(false)} />}
      {ideas && <IdeasSheet list={d.list} canAdd={d.canEdit} onClose={() => setIdeas(false)} onAdded={reload} />}
      {budgetOpen && <BudgetSheet list={d.list} budget={d.budget} onClose={() => setBudgetOpen(false)} onSaved={() => { setBudgetOpen(false); reload(); }} />}
    </div>
  );
}
