import { ArrowSquareOut, Check, HandCoins, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Member } from '../../api/types';
import { formatMoney, parseAmount } from '../../core/money';
import { equalShares, settle } from '../../core/split';
import { itemStatus } from '../../core/status';
import type { Claim } from '../../core/types';
import { Button, ButtonGroup, ButtonLink } from '../Button';
import { listFlavor, useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { Avatar, errorText, initial, Seal, Sheet, statusLabel, useLoad, useToast } from '../kit';
import { ItemForm } from './ItemForm';

/** Ficha de un regalo: reservar, comprar, hacerlo a medias. En la lista propia, solo editar. */
export function ItemSheet({ listId, itemId, users, onClose, onChanged }: { listId: string; itemId: string; users: Member[]; onClose: () => void; onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const me = api.me()!;
  const { data, reload } = useLoad(() => api.listDetail(listId), [api, listId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pot, setPot] = useState(false);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState('');

  const item = data?.items.find((i) => i.id === itemId);
  if (!data) return null;
  if (!item) {
    return (
      <Sheet title="Regalo" onClose={onClose}>
        <p>Este regalo ya no está en la lista.</p>
      </Sheet>
    );
  }
  if (editing) {
    return (
      <ItemForm
        listId={listId}
        item={item}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          reload();
          onChanged();
        }}
      />
    );
  }

  const name = (id: string) => (id === me.id ? 'Tú' : (users.find((u) => u.id === id)?.name ?? 'Alguien'));
  const status = data.canSee ? itemStatus(item, data.claims, data.contributions) : undefined;
  const myClaim = data.claims.find((c) => c.item === item.id && c.user === me.id);
  const potRows = data.contributions.filter((c) => c.item === item.id);
  const myPart = potRows.find((c) => c.user === me.id);
  const buyer = data.claims.find((c) => c.item === item.id && c.status === 'bought')?.user;

  const act = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    setErr('');
    try {
      await fn();
      toast(ok);
      reload();
      onChanged();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const claim = (s: Claim['status']) => act(s, () => api.claim(item.id, s), s === 'bought' ? 'Apuntado como comprado.' : 'Reservado. Nadie más lo comprará.');
  const contribute = () => {
    const cents = parseAmount(amount);
    if (!cents) return setErr('Escribe cuánto pones, por ejemplo 25 o 12,50.');
    act('pot', () => api.contribute(item.id, cents), 'Aportación apuntada.');
    setPot(false);
    setAmount('');
  };
  const people = users.filter((u) => u.id !== data.list.user);
  const share = item.priceCents ? equalShares(item.priceCents, people.map((u) => u.id))[me.id] : undefined;

  return (
    <Sheet
      title={item.title}
      onClose={onClose}
      footer={
        data.canEdit && !data.canSee ? (
          <ButtonGroup align="stretch">
            <Button variant="secondary" icon={PencilSimple} onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="danger" icon={Trash} loading={busy === 'del'} onClick={() => confirm('¿Quitar este regalo de tu lista?') && act('del', async () => { await api.deleteItem(item.id); onClose(); }, 'Regalo quitado.')}>Quitar</Button>
          </ButtonGroup>
        ) : status && !myClaim && status.unitsLeft > 0 && !myPart ? (
          <ButtonGroup align="stretch">
            <Button variant="primary" loading={busy === 'reserved'} onClick={() => claim('reserved')}>Reservar</Button>
            <Button variant="secondary" icon={Check} loading={busy === 'bought'} onClick={() => claim('bought')}>Ya lo he comprado</Button>
          </ButtonGroup>
        ) : myClaim ? (
          <ButtonGroup align="stretch">
            {myClaim.status === 'reserved' && <Button variant="primary" icon={Check} loading={busy === 'buy'} onClick={() => act('buy', () => api.setClaimStatus(myClaim.id, 'bought'), 'Apuntado como comprado.')}>Marcar comprado</Button>}
            <Button variant="secondary" icon={X} loading={busy === 'rel'} onClick={() => act('rel', () => api.releaseClaim(myClaim.id), 'Lo has soltado: vuelve a estar libre.')}>Soltar</Button>
          </ButtonGroup>
        ) : undefined
      }
    >
      <div className="gift-wrap" data-flavor={listFlavor(data.list, users)} style={{ borderRadius: 'var(--r-md)', aspectRatio: '2 / 1' }}>
        {item.image ? <img src={item.image} alt="" referrerPolicy="no-referrer" /> : <span className="monogram" aria-hidden>{initial(item.title)}</span>}
      </div>

      <div className="row between wrap">
        <div className="stack" style={{ gap: 2 }}>
          <span className="meta">{item.store ?? 'Sin tienda'} · {PRIORITY[item.priority]}</span>
          {(item.size || item.color || item.quantity > 1) && (
            <span className="meta">{[item.size && `Talla ${item.size}`, item.color, item.quantity > 1 && `${item.quantity} unidades`].filter(Boolean).join(' · ')}</span>
          )}
        </div>
        {item.priceCents !== undefined && <span className="price" style={{ fontSize: 'var(--t-xl)' }}>{formatMoney(item.priceCents, item.currency)}</span>}
      </div>
      {item.notes && <p>{item.notes}</p>}
      {data.canEdit && data.canSee && (
        <Button variant="ghost" icon={PencilSimple} onClick={() => setEditing(true)}>Editar este regalo</Button>
      )}
      {item.url && (
        <ButtonLink variant="secondary" iconEnd={ArrowSquareOut} href={item.url} target="_blank" rel="noopener noreferrer nofollow">
          Ver en la tienda
        </ButtonLink>
      )}

      {!status ? (
        <p className="notice">Es tu lista: aquí no verás si alguien lo ha reservado o comprado. Es la gracia.</p>
      ) : (
        <section className="panel stack" style={{ boxShadow: 'none', background: 'var(--sunken)' }} aria-label="Estado">
          <div className="row">
            <Seal status={status} />
            <div className="grow">
              <p className={`status status-${status.kind}`}>{statusLabel(status)}</p>
              {status.by.length > 0 && <p className="meta">{status.kind === 'partial' || status.kind === 'covered' ? 'Ponen' : 'Lo tiene'}: {status.by.map(name).join(', ')}</p>}
            </div>
          </div>
          {potRows.length > 0 && (
            <>
              {status.percent !== undefined && (
                <div className="meter" role="progressbar" aria-valuenow={status.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Cubierto">
                  <i style={{ width: `${status.percent}%` }} />
                </div>
              )}
              <ul className="list-plain">
                {potRows.map((c) => {
                  const u = users.find((x) => x.id === c.user);
                  return (
                    <li key={c.id}>
                      {u && <Avatar user={u} size="sm" />}
                      <span className="grow">{name(c.user)}</span>
                      <span className="price" style={{ fontSize: 'var(--t-md)' }}>{formatMoney(c.amountCents, item.currency)}</span>
                      <label className="check" style={{ minHeight: 0 }}>
                        <input type="checkbox" checked={c.paid} onChange={(e) => act('paid', () => api.setContributionPaid(c.id, e.target.checked), e.target.checked ? 'Marcado como pagado.' : 'Marcado como pendiente.')} />
                        <span className="meta">Pagado</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="meta">Reunido {formatMoney(status.raised, item.currency)}{item.priceCents ? ` de ${formatMoney(item.priceCents, item.currency)}` : ''}</p>
              {buyer && settle(buyer, potRows).map((t) => (
                <p key={t.from} className="meta">{name(t.from)} {t.from === me.id ? 'debes' : 'debe'} {formatMoney(t.amount, item.currency)} a {name(t.to)}.</p>
              ))}
              {myPart && <Button variant="ghost" size="sm" icon={X} onClick={() => act('rm', () => api.removeContribution(myPart.id), 'Aportación quitada.')}>Quitar mi aportación</Button>}
            </>
          )}
          {!myClaim && status.unitsLeft > 0 && !pot && !myPart && (
            <Button variant="ghost" icon={HandCoins} onClick={() => setPot(true)}>Hacerlo a medias</Button>
          )}
          {pot && (
            <div className="stack">
              <label className="field">
                <span>¿Cuánto pones?</span>
                <div className="input-row">
                  <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" autoFocus />
                  <Button variant="primary" loading={busy === 'pot'} onClick={contribute}>Apuntar</Button>
                </div>
                {share !== undefined && <small>A partes iguales entre {people.length} serían {formatMoney(share, item.currency)} por cabeza.</small>}
              </label>
              {share !== undefined && <Button variant="ghost" size="sm" onClick={() => setAmount((share / 100).toFixed(2).replace('.', ','))}>Usar {formatMoney(share, item.currency)}</Button>}
            </div>
          )}
        </section>
      )}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
