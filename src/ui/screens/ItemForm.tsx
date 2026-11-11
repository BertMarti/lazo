import { CaretDown } from '@phosphor-icons/react';
import { useState } from 'react';
import { parseAmount } from '../../core/money';
import { LIMITS, type Item, type Priority } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { errorText, Sheet, useToast } from '../kit';

/** Escribir un regalo a mano o editarlo: 3 campos a la vista; el resto, en «Más detalles». */
export function ItemForm({ listId, item, initialUrl, hint, onClose, onSaved }: { listId: string; item?: Item; initialUrl?: string; hint?: string; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [title, setTitle] = useState(item?.title ?? '');
  const [price, setPrice] = useState(item?.priceCents ? (item.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 2);
  const [url, setUrl] = useState(item?.url ?? initialUrl ?? '');
  const [store, setStore] = useState(item?.store ?? '');
  const [size, setSize] = useState(item?.size ?? '');
  const [color, setColor] = useState(item?.color ?? '');
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    if (!title.trim()) return setErr('¿Qué regalo es? Escribe al menos el nombre.');
    const priceCents = price.trim() ? parseAmount(price) : undefined;
    if (price.trim() && !priceCents) return setErr('El precio no se entiende. Escribe, por ejemplo, 19,99.');
    if (url.trim()) {
      try {
        const u = new URL(url.trim());
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
      } catch {
        return setErr('El enlace no parece válido. Debe empezar por https://');
      }
    }
    setBusy(true);
    try {
      await api.saveItem(
        listId,
        {
          title: title.trim().slice(0, LIMITS.title),
          url: url.trim() || undefined,
          priceCents: priceCents ?? undefined,
          store: store.trim() || undefined,
          image: item?.image,
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          priority,
          quantity: Math.min(Math.max(1, quantity), LIMITS.quantity),
          notes: notes.trim().slice(0, LIMITS.notes) || undefined,
        },
        item?.id,
      );
      toast(item ? 'Regalo guardado.' : 'Añadido a tu lista.');
      onSaved();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={item ? 'Editar regalo' : 'Añadir a tu lista'}
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button variant="primary" loading={busy} onClick={save}>
            {item ? 'Guardar' : 'Añadir a mi lista'}
          </Button>
        </ButtonGroup>
      }
    >
      {hint && <p className="notice" role="status">{hint}</p>}
      <label className="field">
        <span>Regalo</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} placeholder="Auriculares, un libro, un taller…" autoFocus />
      </label>
      <label className="field">
        <span>Precio</span>
        <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29,90" />
      </label>
      <fieldset className="field">
        <legend>¿Cuántas ganas?</legend>
        <div className="segmented">
          {([1, 2, 3] as const).map((p) => (
            <label key={p}>
              <input type="radio" name="priority" checked={priority === p} onChange={() => setPriority(p)} />
              {PRIORITY[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <details className="more" open={!!item || !!initialUrl}>
        <summary>
          <CaretDown size={18} weight="bold" aria-hidden /> Más detalles
        </summary>
        <div className="stack">
          <label className="field">
            <span>Enlace de la tienda</span>
            <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Tienda</span>
              <input className="input" value={store} onChange={(e) => setStore(e.target.value)} maxLength={80} />
            </label>
            <label className="field">
              <span>Cantidad</span>
              <input className="input" type="number" min={1} max={LIMITS.quantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
            </label>
            <label className="field">
              <span>Talla</span>
              <input className="input" value={size} onChange={(e) => setSize(e.target.value)} maxLength={20} />
            </label>
            <label className="field">
              <span>Color</span>
              <input className="input" value={color} onChange={(e) => setColor(e.target.value)} maxLength={40} />
            </label>
          </div>
          <label className="field">
            <span>Notas</span>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={LIMITS.notes} placeholder="Modelo, alternativas, dónde lo viste…" />
          </label>
        </div>
      </details>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
