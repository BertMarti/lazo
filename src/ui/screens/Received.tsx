import { useState } from 'react';
import type { Received } from '../../core/types';
import { Button } from '../Button';
import { useApi } from '../ctx';
import { errorText } from '../kit';

/** Día de la entrega: lo que te regalaron y de parte de quién. Sin precios. Opcional: no se pide hasta que lo pides. */
export function ReceivedScreen({ groupId }: { groupId: string }) {
  const api = useApi();
  const [items, setItems] = useState<Received[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!items)
    return (
      <div className="envelope" style={{ margin: '0 auto' }}>
        <p className="h-section">¿Quieres verlo?</p>
        <p>Verás los regalos y de parte de quién. Si prefieres quedarte con la sorpresa, vuelve atrás.</p>
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setItems(await api.received(groupId));
            } catch (e) {
              setErr(errorText(e));
              setBusy(false);
            }
          }}
        >
          Verlo
        </Button>
        {err && <p className="notice notice-error" role="alert">{err}</p>}
      </div>
    );
  return (
    <div className="stack-lg" style={{ maxWidth: 744 }}>
      {items.length === 0 ? (
        <p className="lead">Aún no hay nada apuntado como comprado para ti.</p>
      ) : (
        <ul className="rows">
          {items.map((r, i) => (
            <li key={i}>
              {r.image && <span className="gift-thumb"><img src={r.image} alt="" referrerPolicy="no-referrer" /></span>}
              <span className="grow">
                <b>{r.title}</b>
                <br />
                <span className="meta">De parte de {r.fromAll ? 'todos' : r.from.map((f) => f.name).join(' y ')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="meta">No se enseñan precios ni cuentas.</p>
    </div>
  );
}
