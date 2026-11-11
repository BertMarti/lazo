import { ArrowSquareOut, Check, HandCoins, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import type { Member } from '../../api/types';
import { budgetProgress } from '../../core/budget';
import { formatMoney, parseAmount } from '../../core/money';
import { equalShares, settle } from '../../core/split';
import { itemStatus } from '../../core/status';
import { BudgetBar } from '../BudgetBar';
import { Button, ButtonGroup, ButtonLink } from '../Button';
import { listFlavor, useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { Avatar, errorText, Seal, Sheet, useLoad, useToast, VisibilityNote } from '../kit';
import { statusLine } from '../statusText';
import { ItemForm } from './ItemForm';

/** Ficha de un regalo: detalles, estado en frase, «a medias» y el pie con la acción principal. */
export function ItemSheet({ listId, itemId, users, focusPot, onClose, onChanged }: { listId: string; itemId: string; users: Member[]; focusPot?: boolean; onClose: () => void; onChanged: () => void }) {
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
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Alguien';
  const st = data.canSee ? itemStatus(item, data.claims, data.contributions) : undefined;
  const line = st ? statusLine(item, st, data.claims, data.contributions, me.id, nameOf) : undefined;
  const myClaim = line?.myClaim;
  const potRows = data.contributions.filter((c) => c.item === item.id);
  const myPart = potRows.find((c) => c.user === me.id);
  const buyer = data.claims.find((c) => c.item === item.id && c.status === 'bought')?.user;
  const helpers = users.filter((u) => u.id !== data.list.user);
  const share = item.priceCents ? equalShares(item.priceCents, helpers.map((u) => u.id))[me.id] : undefined;

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

  // Pie: una acción principal a la izquierda; siempre presente salvo si lo tiene otro.
  let footer: ReactNode;
  if (data.canEdit && !data.canSee) {
    footer = confirming ? (
      <>
        <p style={{ fontWeight: 700 }}>¿Quitar este regalo de tu lista?</p>
        <ButtonGroup align="stretch">
          <Button variant="danger" loading={busy === 'del'} onClick={() => act('del', () => api.deleteItem(item.id), 'Regalo quitado.', onClose)}>Sí, quitar</Button>
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
    if (myClaim?.status === 'reserved')
      footer = (
        <ButtonGroup align="stretch">
          <Button variant="primary" icon={Check} loading={busy === 'buy'} onClick={() => act('buy', () => api.setClaimStatus(myClaim.id, 'bought'), 'Apuntado como comprado.')}>Ya lo compré</Button>
          <Button variant="secondary" icon={X} loading={busy === 'rel'} onClick={() => act('rel', () => api.releaseClaim(myClaim.id), 'Lo has soltado. Vuelve a estar libre.')}>Soltar</Button>
        </ButtonGroup>
      );
    else if (myClaim?.status === 'bought')
      footer = (
        <ButtonGroup align="stretch">
          <Button variant="secondary" loading={busy === 'unbuy'} onClick={() => act('unbuy', () => api.setClaimStatus(myClaim.id, 'reserved'), 'Vuelve a estar reservado por ti.')}>Deshacer compra</Button>
        </ButtonGroup>
      );
    else if (line.action === 'reserve')
      footer = (
        <ButtonGroup align="stretch">
          <Button variant="primary" loading={busy === 'res'} onClick={() => act('res', () => api.claim(item.id, 'reserved'), `Reservado. ${who} no lo verá.`)}>Reservar</Button>
          <Button variant="secondary" icon={HandCoins} onClick={openPot}>Poner a medias</Button>
        </ButtonGroup>
      );
    else if (line.action === 'pot')
      footer = <ButtonGroup align="stretch"><Button variant="primary" icon={HandCoins} onClick={openPot}>Poner dinero</Button></ButtonGroup>;
    else if (line.action === 'mypart' || line.action === 'buy-pot')
      footer = (
        <ButtonGroup align="stretch">
          {line.action === 'buy-pot' ? (
            <Button variant="primary" icon={Check} loading={busy === 'bp'} onClick={() => act('bp', () => api.claim(item.id, 'bought'), 'Apuntado como comprado.')}>Ya lo compré</Button>
          ) : (
            <Button variant="primary" onClick={openPot}>Cambiar mi parte</Button>
          )}
          {myPart && <Button variant="danger" loading={busy === 'rm'} onClick={() => act('rm', () => api.removeContribution(myPart.id), 'Aportación quitada.')}>Quitar mi parte</Button>}
        </ButtonGroup>
      );
  }

  return (
    <Sheet title={item.title} onClose={onClose} footer={footer}>
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
          {[PRIORITY[item.priority], item.size && `Talla ${item.size}`, item.color, item.quantity > 1 && `${item.quantity} unidades`].filter(Boolean).join(' · ')}
        </p>
      </div>
      {item.notes && <p>{item.notes}</p>}
      {item.url && /^https?:\/\//i.test(item.url) && (
        <ButtonLink variant="secondary" wide iconEnd={ArrowSquareOut} href={item.url} target="_blank" rel="noopener noreferrer nofollow">
          Ver en la tienda
        </ButtonLink>
      )}
      {data.canEdit && data.canSee && (
        <Button variant="ghost" icon={PencilSimple} onClick={() => setEditing(true)}>Editar este regalo</Button>
      )}

      {!st || !line ? (
        <VisibilityNote>Si alguien lo reserva, tú no lo verás.</VisibilityNote>
      ) : (
        <section className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s-4)' }} aria-label="Estado">
          <div className="row">
            <Seal status={st} />
            <p className="grow" style={{ fontWeight: 700 }}>{line.text}</p>
          </div>
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
                      <span className="grow">{c.user === me.id ? 'Tú' : nameOf(c.user)}</span>
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
                  {t.from === me.id ? 'Debes' : `${nameOf(t.from)} debe`} {formatMoney(t.amount, item.currency)} a {t.to === me.id ? 'ti' : nameOf(t.to)}.
                </p>
              ))}
            </>
          )}
          {pot && (
            <div className="stack">
              <label className="field">
                <span>¿Cuánto pones?</span>
                <div className="input-row">
                  <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" autoFocus />
                  <Button variant="primary" loading={busy === 'pot'} onClick={contribute}>Apuntar</Button>
                </div>
                {share !== undefined && <small>A partes iguales entre {helpers.length} serían {formatMoney(share, item.currency)} por cabeza.</small>}
              </label>
              <ButtonGroup>
                {share !== undefined && <Button variant="ghost" size="sm" onClick={() => setAmount((share / 100).toFixed(2).replace('.', ','))}>Usar {formatMoney(share, item.currency)}</Button>}
                <Button variant="ghost" size="sm" onClick={() => setPot(false)}>Cancelar</Button>
              </ButtonGroup>
            </div>
          )}
          {data.list.user && <VisibilityNote>{who} no ve esto</VisibilityNote>}
        </section>
      )}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
