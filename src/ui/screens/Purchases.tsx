import { formatMoney } from '../../core/money';
import { useApi } from '../ctx';
import { Seal, useLoad } from '../kit';

export function Purchases() {
  const api = useApi();
  const me = api.me();
  const { data, error } = useLoad(() => api.purchases(), [api, me?.id]);
  if (error) return <p className="notice notice-error">{error}</p>;
  if (!data) return <p className="meta">Contando…</p>;
  const total = data.reduce((s, p) => s + (p.contribution?.amountCents ?? (p.claim ? (p.item.priceCents ?? 0) : 0)), 0);
  const pending = data.filter((p) => p.claim?.status === 'reserved');
  return (
    <div className="stack-lg">
      <div className="section-head">
        <p className="lead">Lo que has reservado, comprado o pagas a medias.</p>
        <div style={{ textAlign: 'right' }}>
          <p className="price" style={{ fontSize: 'var(--t-2xl)' }}>{formatMoney(total)}</p>
          <p className="meta">en total{pending.length ? ` · ${pending.length} por comprar` : ''}</p>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="empty">
          <h2>Aún no has reservado nada</h2>
          <p>Abre la lista de alguien y reserva un regalo: así nadie más lo comprará.</p>
        </div>
      ) : (
        <ul className="list-plain panel">
          {data.map((p) => {
            const kind = p.contribution ? 'partial' : p.claim!.status;
            return (
              <li key={(p.claim?.id ?? p.contribution!.id) + kind}>
                <Seal status={{ kind, unitsLeft: 0, raised: 0, by: [] }} />
                <a className="grow" href={`#/l/${p.list.id}`} style={{ textDecoration: 'none' }}>
                  <p className="truncate" style={{ fontWeight: 700 }}>{p.item.title}</p>
                  <p className="meta truncate">Para {p.list.name} · {p.group.name}</p>
                </a>
                <div style={{ textAlign: 'right' }}>
                  <p className="price" style={{ fontSize: 'var(--t-md)' }}>
                    {p.contribution ? formatMoney(p.contribution.amountCents) : p.item.priceCents ? formatMoney(p.item.priceCents) : '—'}
                  </p>
                  <p className="meta">{p.contribution ? (p.contribution.paid ? 'A medias · pagado' : 'A medias') : p.claim!.status === 'bought' ? 'Comprado' : 'Por comprar'}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
