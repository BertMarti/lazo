import { Check } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Purchase } from '../../api/types';
import { formatMoney } from '../../core/money';
import { Button } from '../Button';
import { useApi } from '../ctx';
import { errorText, Seal, useLoad, useToast } from '../kit';

/** Mi lista de la compra: lo que he reservado, comprado o pago a medias, por persona. Solo lo veo yo. */
export function Purchases() {
  const api = useApi();
  const me = api.me();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api.purchases(), [api, me?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className="meta">Cargando…</p>;

  const cost = (p: Purchase) => p.contribution?.amountCents ?? (p.item.priceCents ?? 0);
  const sum = (f: (p: Purchase) => boolean) => data.filter(f).reduce((s, p) => s + cost(p), 0);
  const toBuy = sum((p) => p.claim?.status === 'reserved');
  const bought = sum((p) => p.claim?.status === 'bought');
  const pots = sum((p) => !!p.contribution);
  const byPerson = new Map<string, Purchase[]>();
  for (const p of data) byPerson.set(p.list.id, [...(byPerson.get(p.list.id) ?? []), p]);

  const buy = async (p: Purchase) => {
    setBusy(p.claim!.id);
    try {
      await api.setClaimStatus(p.claim!.id, 'bought');
      toast('Apuntado como comprado.', { action: { label: 'Deshacer', run: () => api.setClaimStatus(p.claim!.id, 'reserved').then(reload) } });
      reload();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (data.length === 0)
    return (
      <div className="empty">
        <h2>Aún no has reservado nada</h2>
        <p>Abre la lista de alguien y pulsa «Reservar»: así nadie más lo comprará.</p>
      </div>
    );

  return (
    <div className="stack-lg">
      <section className="panel stack" aria-label="Resumen">
        <p className="row between">
          <span className="lead">En total</span>
          <span className="money" style={{ fontSize: 'var(--t-2xl)' }}>{formatMoney(toBuy + bought + pots)}</span>
        </p>
        <p className="meta">
          Por comprar {formatMoney(toBuy)} · Comprado {formatMoney(bought)} · A medias {formatMoney(pots)}
        </p>
      </section>
      {[...byPerson.values()].map((rows) => (
        <section key={rows[0]!.list.id} className="purchase-group" aria-label={`Para ${rows[0]!.list.name}`}>
          <h3>Para {rows[0]!.list.name}</h3>
          <ul className="list-plain panel" style={{ paddingBlock: 'var(--s-2)' }}>
            {rows.map((p) => {
              const kind = p.contribution ? 'partial' : p.claim!.status;
              return (
                <li key={(p.claim?.id ?? p.contribution!.id) + kind}>
                  <Seal status={{ kind, unitsLeft: 0, raised: 0, by: [] }} size={24} />
                  <a className="grow" href={`#/l/${p.list.id}`} style={{ textDecoration: 'none' }}>
                    <p className="truncate" style={{ fontWeight: 700 }}>{p.item.title}</p>
                    <p className="meta">
                      <span className="money">{p.item.priceCents !== undefined || p.contribution ? formatMoney(cost(p)) : 'Sin precio'}</span>
                      {' · '}
                      {p.contribution ? (p.contribution.paid ? 'A medias, pagado' : 'A medias') : p.claim!.status === 'bought' ? 'Comprado' : 'Por comprar'}
                    </p>
                  </a>
                  {p.claim?.status === 'reserved' && (
                    <Button variant="secondary" size="sm" icon={Check} loading={busy === p.claim.id} onClick={() => buy(p)}>
                      Ya lo compré
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
