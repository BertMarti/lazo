import { useState } from 'react';
import type { Member } from '../../api/types';
import { parseAmount } from '../../core/money';
import type { Claim, GiftList, Group, Id, Item } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { errorText, Sheet, useToast, VisibilityNote } from '../kit';

/**
 * «Ya comprado» en 2 toques (spec plazas-hucha §10.7): el botón de la tarjeta y «Guardar».
 * Precio prerrellenado con el de la lista; «La hucha» = lo pagó quien la lleva con el dinero del bote.
 */
export function BuySheet({ item, list, group, members, claim, keeper, onClose, onDone }: {
  item: Item;
  list: GiftList;
  group: Group;
  members: Member[];
  claim?: Claim;
  /** Quien lleva el dinero de la hucha para esta plaza (ver `keeperFor`). */
  keeper?: Id;
  onClose: () => void;
  onDone: () => void;
}) {
  const api = useApi();
  const toast = useToast();
  const me = api.me()!;
  const keeperId = keeper;
  const kindOf = (): 'self' | 'pot' => (claim ? (claim.kind ?? 'self') : group.buyMode === 'hucha' ? 'pot' : 'self');
  const [kind, setKind] = useState<'self' | 'pot'>(kindOf);
  const [price, setPrice] = useState(item.priceCents ? (item.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [payer, setPayer] = useState<'me' | 'pot' | 'other'>('me');
  const [other, setOther] = useState<Id>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const payers = members.filter((m) => m.id !== list.user && m.id !== me.id);
  const cents = price.trim() ? parseAmount(price) : null;

  const save = async () => {
    setErr('');
    if (cents === null) return setErr('Escribe cuánto costó, por ejemplo 29,90.');
    const paidBy = payer === 'me' ? me.id : payer === 'pot' ? keeperId : other;
    if (!paidBy) return setErr(payer === 'pot' ? 'Aún no hay nadie que lleve la hucha.' : 'Elige quién lo pagó.');
    setBusy(true);
    try {
      await api.gift(claim ? { action: 'buy', claim: claim.id, paidCents: cents, paidBy } : { action: 'buy', item: item.id, kind, paidCents: cents, paidBy });
      toast('Apuntado como comprado.');
      onDone();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Sheet
      title="Ya comprado"
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button variant="primary" loading={busy} disabled={cents === null} onClick={save} data-autofocus={item.priceCents ? true : undefined}>
            Guardar
          </Button>
        </ButtonGroup>
      }
    >
      <p style={{ fontWeight: 700 }}>{item.title}</p>
      <label className="field">
        <span>¿Cuánto costó?</span>
        <span className="input-row" style={{ alignItems: 'center' }}>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29,90" data-autofocus={item.priceCents ? undefined : true} />
          <span aria-hidden style={{ fontWeight: 700 }}>€</span>
        </span>
      </label>
      {!claim && group.buyMode === 'mixto' && (
        <fieldset className="field">
          <legend>¿De dónde sale?</legend>
          <div className="segmented">
            {(['pot', 'self'] as const).map((k) => (
              <label key={k}>
                <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
                {k === 'pot' ? 'De la hucha' : 'Lo pago yo'}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="field">
        <legend>¿Quién lo pagó?</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="payer" checked={payer === 'me'} onChange={() => setPayer('me')} />
            Yo
          </label>
          {kind === 'pot' && keeperId && keeperId !== me.id && (
            <label>
              <input type="radio" name="payer" checked={payer === 'pot'} onChange={() => setPayer('pot')} />
              La hucha
            </label>
          )}
          <label>
            <input type="radio" name="payer" checked={payer === 'other'} onChange={() => setPayer('other')} />
            Otra persona
          </label>
        </div>
      </fieldset>
      {payer === 'other' && (
        <label className="field">
          <span>¿Quién?</span>
          <select className="select" value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">Elige…</option>
            {payers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
      )}
      {list.user && <VisibilityNote>{list.name} no ve esto</VisibilityNote>}
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}

/** Quién lleva el dinero de la hucha para esta plaza: el tesorero, o el suplente si la plaza es la del tesorero. */
export function keeperFor(group: Group, list: GiftList, lists: GiftList[]): Id | undefined {
  const userOf = (id?: Id) => lists.find((l) => l.id === id)?.user;
  return list.id === group.treasurer ? userOf(group.deputy) : userOf(group.treasurer);
}
