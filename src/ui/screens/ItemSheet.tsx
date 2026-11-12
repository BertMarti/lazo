import { ArrowSquareOut, PencilSimple, Trash } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import type { Member } from '../../api/types';
import { budgetProgress } from '../../core/budget';
import { formatMoney, parseAmount } from '../../core/money';
import { equalShares, settle } from '../../core/split';
import { itemStatus } from '../../core/status';
import type { Claim, GiftList, Item } from '../../core/types';
import { BudgetBar } from '../BudgetBar';
import { Button, ButtonGroup, ButtonLink } from '../Button';
import { listFlavor, useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { Avatar, errorText, Seal, Sheet, useLoad, useToast, VisibilityNote } from '../kit';
import { statusLine } from '../statusText';
import { ItemForm } from './ItemForm';

/** Ficha de un regalo: detalles, estado en frase, «a medias» y el pie con las acciones. */
export function ItemSheet({ listId, itemId, users, focusPot, onBuy, onClose, onChanged }: {
  listId: string;
  itemId: string;
  users: Member[];
  lists?: GiftList[];
  focusPot?: boolean;
  onBuy: (item: Item, claim?: Claim) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const api = useApi();
  const toast = useToast();
  const me = api.me()!;
  const { data, reload } = useLoad(() => api.listDetail(listId), [api, listId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pot, setPot] = useState(!!focusPot);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');

  const item = data?.items.find((i) => i.id === itemId);
  if (!data) return null;
  if (!item) return <Sheet title="Regalo" onClose={onClose}><p>Este regalo ya no está en la lista.</p></Sheet>;
  if (editing) return <ItemForm listId={listId} item={item} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); onChanged(); }} />;

  const who = data.list.name;
  const mode = data.group.buyMode;
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Alguien';
  const st = data.canSee ? itemStatus(item, data.claims, data.contributions) : undefined;
  const line = st ? statusLine(item, st, data.claims, data.contributions, me.id, nameOf, mode) : undefined;
  const rows = data.claims.filter((c) => c.item === item.id);
  const myReserved = rows.find((c) => c.user === me.id && c.status === 'reserved' && (c.kind ?? 'self') === 'self');
  const potReserved = rows.find((c) => c.kind === 'pot' && c.status === 'reserved');
  const isAdmin = users.some((u) => u.id === me.id && u.role === 'admin');
  const undoable = rows.find((c) => c.status === 'bought' && (c.user === me.id || c.paidBy === me.id || isAdmin));
  const potRows = data.contributions.filter((c) => c.item === item.id);
  const myPart = potRows.find((c) => c.user === me.id);
  const buyer = rows.find((c) => c.status === 'bought')?.paidBy;
  const helpers = users.filter((u) => u.id !== data.list.user);
  const share = item.priceCents ? equalShares(item.priceCents, helpers.map((u) => u.id))[me.id] : undefined;
  const editableSurprise = item.secret && item.createdBy === me.id;

  const act = async (key: string, fn: () => Promise<unknown>, ok: string, then?: () => void) => {
    setBusy(key);
    setErr('');
    try {
      await fn();
      toast(ok);
      reload();
      onChanged();
      then?.();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const contribute = () => {
    const cents = parseAmount(amount);
    if (!cents) return setErr('Escribe cuánto pones, por ejemplo 25 o 12,50.');
    act('pot', () => api.contribute(item.id, cents), `Apuntado. ${who} no lo verá.`, () => {
      setPot(false);
      setAmount('');
    });
  };
  const openPot = () => {
    setAmount(myPart ? (myPart.amountCents / 100).toFixed(2).replace('.', ',') : '');
    setPot(true);
  };

  let footer: ReactNode;
  if ((data.canEdit && !data.canSee) || (editableSurprise && !rows.some((c) => c.status === 'bought'))) {
    footer = confirming ? (
      <>
        <p style={{ fontWeight: 700 }}>{item.secret ? '¿Quitar esta sorpresa?' : '¿Quitar este regalo de tu lista?'}</p>
        <ButtonGroup align="stretch">
          <Button variant="danger" loading={busy === 'del'} onClick={() => act('del', () => api.deleteItem(item.id), item.secret ? 'Sorpresa quitada.' : 'Quitado de tu lista.', onClose)}>Sí, quitar</Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>No</Button>
        </ButtonGroup>
      </>
    ) : (
      <ButtonGroup align="stretch">
        <Button variant="secondary" icon={PencilSimple} onClick={() => setEditing(true)}>Editar</Button>
        <Button variant="danger" icon={Trash} onClick={() => setConfirming(true)}>Quitar</Button>
      </ButtonGroup>
    );
  } else if (line && !pot) {
    const buttons: ReactNode[] = line.actions.map((a, i) => (
      <Button
        key={a.kind}
        variant={i === 0 ? 'primary' : 'secondary'}
        loading={busy === a.kind}
        onClick={() => {
          if (a.kind === 'pot' || a.kind === 'mypart') return openPot();
          if (a.kind === 'buy') return onBuy(item, a.claim);
          if (a.kind === 'buy-pot') return onBuy(item);
          const kind = a.kind === 'reserve-pot' ? 'pot' : 'self';
          act(a.kind, () => api.gift({ action: 'reserve', item: item.id, kind }), kind === 'pot' ? `Apuntado para la hucha. ${who} no lo verá.` : `Reservado. ${who} no lo verá.`);
        }}
      >
        {a.label}
      </Button>
    ));
    if (st?.kind === 'free' && mode !== 'hucha') buttons.push(<Button key="medias" variant="secondary" onClick={openPot}>A medias</Button>);
    if (myReserved) buttons.push(<Button key="rel" variant="secondary" loading={busy === 'rel'} onClick={() => act('rel', () => api.gift({ action: 'release', claim: myReserved.id }), 'Lo has soltado. Vuelve a estar libre.')}>Soltar</Button>);
    if (myReserved && mode === 'mixto') buttons.push(<Button key="mv" variant="ghost" onClick={() => act('mv', () => api.gift({ action: 'move', claim: myReserved.id, kind: 'pot' }), 'Pasado a la hucha.')}>A la hucha</Button>);
    if (potReserved) buttons.push(<Button key="unpot" variant="secondary" loading={busy === 'unpot'} onClick={() => act('unpot', () => api.gift({ action: 'release', claim: potReserved.id }), 'Quitado de la hucha.')}>Quitar de la hucha</Button>);
    if (potReserved && mode === 'mixto') buttons.push(<Button key="mine" variant="ghost" onClick={() => act('mine', () => api.gift({ action: 'move', claim: potReserved.id, kind: 'self' }), `Reservado para ti. ${who} no lo verá.`)}>Me lo quedo yo</Button>);
    if (undoable) buttons.push(<Button key="unbuy" variant="secondary" loading={busy === 'unbuy'} onClick={() => act('unbuy', () => api.gift({ action: 'unbuy', claim: undoable.id }), 'Compra deshecha: vuelve a estar reservado.')}>Deshacer compra</Button>);
    if (myPart) buttons.push(<Button key="rm" variant="danger" loading={busy === 'rm'} onClick={() => act('rm', () => api.removeContribution(myPart.id), 'Aportación quitada.')}>Quitar mi parte</Button>);
    footer = buttons.length ? <ButtonGroup align="stretch">{buttons.slice(0, 3)}</ButtonGroup> : undefined;
  }

  return (
    <Sheet title={item.title} onClose={onClose} footer={footer}>
      {data.list.user && data.canSee && <VisibilityNote>{who} no ve esto</VisibilityNote>}
      {item.image && (
        <div className="sheet-photo paper" data-flavor={listFlavor(data.list, users)}>
          <img src={item.image} alt="" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="stack" style={{ gap: 'var(--s-1)' }}>
        <p>
          {item.priceCents !== undefined ? <span className="money money-lg">{formatMoney(item.priceCents, item.currency)}</span> : <span className="meta">Sin precio</span>}
          {item.store && <span className="meta"> · {item.store}</span>}
        </p>
        <p className="meta">
          {[item.secret ? `Sorpresa de ${item.createdBy === me.id ? 'ti' : nameOf(item.createdBy)}` : PRIORITY[item.priority], item.size && `Talla ${item.size}`, item.color, item.quantity > 1 && `${item.quantity} unidades`].filter(Boolean).join(' · ')}
        </p>
        {item.removed && <p className="meta">{who} lo ha quitado de su lista.</p>}
      </div>
      {item.notes && <p>{item.notes}</p>}
      {item.url && /^https?:\/\//i.test(item.url) && (
        <ButtonLink variant="secondary" wide iconEnd={ArrowSquareOut} href={item.url} target="_blank" rel="noopener noreferrer nofollow">
          Ver en la tienda
        </ButtonLink>
      )}
      {data.canEdit && data.canSee && !item.secret && (
        <Button variant="link" icon={PencilSimple} onClick={() => setEditing(true)}>Editar este regalo</Button>
      )}

      {!st || !line ? (
        <VisibilityNote>Si alguien lo reserva, tú no lo verás.</VisibilityNote>
      ) : (
        <section className="stack" style={{ borderTop: '1px solid var(--linea)', paddingTop: 'var(--s-4)' }} aria-label="Estado">
          <div className="row">
            <Seal status={st} />
            <p className="grow">{line.text}</p>
          </div>
          {rows
            .filter((c) => c.status === 'bought' && c.paidCents !== undefined)
            .map((c) => (
              <p key={c.id} className="meta">
                Costó {formatMoney(c.paidCents!, item.currency, true)} · {c.kind === 'pot' ? 'de la hucha' : 'por su cuenta'} · lo pagó {c.paidBy === me.id ? 'tú' : nameOf(c.paidBy ?? c.user)}
              </p>
            ))}
          {potRows.length > 0 && (
            <>
              {item.priceCents ? (
                <BudgetBar p={budgetProgress(item.priceCents, [item], [], potRows)} label="Dinero reunido" leftWord="Faltan" fullText="Cubierto" overWord="Sobran" />
              ) : (
                <p className="meta">Reunido {formatMoney(st.raised, item.currency)}</p>
              )}
              <ul className="list-plain">
                {potRows.map((c) => {
                  const u = users.find((x) => x.id === c.user);
                  return (
                    <li key={c.id}>
                      {u && <Avatar user={u} size="sm" />}
                      <span className="grow" style={{ whiteSpace: 'nowrap' }}>{c.user === me.id ? 'Tú' : nameOf(c.user)}</span>
                      <span className="money">{formatMoney(c.amountCents, item.currency)}</span>
                      <label className="check">
                        <input type="checkbox" checked={c.paid} onChange={(e) => act('paid', () => api.setContributionPaid(c.id, e.target.checked), e.target.checked ? 'Marcado como pagado.' : 'Marcado como pendiente.')} />
                        <span className="meta">Pagado</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {buyer && settle(buyer, potRows).map((t) => (
                <p key={t.from} className="meta">
                  {t.from === me.id ? 'Debes' : `${nameOf(t.from)} debe`} {formatMoney(t.amount, item.currency, true)} a {t.to === me.id ? 'ti' : nameOf(t.to)}.
                </p>
              ))}
            </>
          )}
          {pot && (
            <div className="stack">
              <label className="field">
                <span>¿Cuánto pones?</span>
                <div className="input-row">
                  <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" autoFocus data-autofocus />
                  <Button variant="primary" loading={busy === 'pot'} onClick={contribute}>Apuntar</Button>
                </div>
                {share !== undefined && <small>A partes iguales entre {helpers.length} serían {formatMoney(share, item.currency)} por cabeza.</small>}
              </label>
              <ButtonGroup>
                {share !== undefined && <Button variant="link" size="sm" onClick={() => setAmount((share / 100).toFixed(2).replace('.', ','))}>Usar {formatMoney(share, item.currency)}</Button>}
                <Button variant="link" size="sm" onClick={() => setPot(false)}>Cancelar</Button>
              </ButtonGroup>
            </div>
          )}
        </section>
      )}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
