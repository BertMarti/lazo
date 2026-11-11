import { LinkSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { formatMoney, parseAmount } from '../../core/money';
import { LIMITS, type Item, type Priority } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { errorText, Sheet, useToast } from '../kit';

/** Alta o edición de un regalo. Pegar un enlace rellena título, imagen, precio y tienda si la página los publica. */
export function ItemForm({ listId, item, onClose, onSaved }: { listId: string; item?: Item; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [url, setUrl] = useState(item?.url ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [price, setPrice] = useState(item?.priceCents ? (item.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [store, setStore] = useState(item?.store ?? '');
  const [image, setImage] = useState(item?.image);
  const [size, setSize] = useState(item?.size ?? '');
  const [color, setColor] = useState(item?.color ?? '');
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 2);
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [busy, setBusy] = useState<'unfurl' | 'save' | null>(null);
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');

  const fill = async () => {
    setErr('');
    setHint('');
    try {
      new URL(url);
    } catch {
      return setErr('Pega un enlace completo, que empiece por https://');
    }
    setBusy('unfurl');
    try {
      const m = await api.unfurl(url);
      if (m.title) setTitle(m.title.slice(0, LIMITS.title));
      if (m.priceCents) setPrice((m.priceCents / 100).toFixed(2).replace('.', ','));
      if (m.store) setStore(m.store);
      if (m.image) setImage(m.image);
      if (m.url) setUrl(m.url);
      setHint(m.title ? `Rellenado desde ${m.store ?? 'la tienda'}${m.priceCents ? ` · ${formatMoney(m.priceCents)}` : ' · sin precio publicado'}. Revísalo.` : 'La tienda no publica los datos del producto. Escríbelos a mano.');
      if (api.demo) setHint((h) => `${h} (En la demo los datos son de ejemplo.)`);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setErr('');
    if (!title.trim()) return setErr('¿Qué regalo es? Escribe al menos el nombre.');
    const priceCents = price.trim() ? parseAmount(price) : undefined;
    if (price.trim() && !priceCents) return setErr('El precio no se entiende. Escribe por ejemplo 19,99.');
    setBusy('save');
    try {
      await api.saveItem(
        listId,
        {
          title: title.trim().slice(0, LIMITS.title),
          url: url.trim() || undefined,
          priceCents: priceCents ?? undefined,
          store: store.trim() || undefined,
          image,
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          priority,
          quantity: Math.min(Math.max(1, quantity), LIMITS.quantity),
          notes: notes.trim().slice(0, LIMITS.notes) || undefined,
        },
        item?.id,
      );
      toast(item ? 'Regalo actualizado.' : 'Añadido a tu lista.');
      onSaved();
    } catch (e) {
      setErr(errorText(e));
      setBusy(null);
    }
  };

  return (
    <Sheet
      title={item ? 'Editar regalo' : 'Nuevo regalo'}
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button variant="primary" loading={busy === 'save'} onClick={save}>{item ? 'Guardar' : 'Añadir a la lista'}</Button>
        </ButtonGroup>
      }
    >
      <label className="field">
        <span>Enlace de la tienda</span>
        <div className="input-row">
          <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.amazon.es/dp/…" />
          <Button variant="secondary" icon={LinkSimple} loading={busy === 'unfurl'} onClick={fill} disabled={!url.trim()}>Rellenar</Button>
        </div>
        <small>Amazon o cualquier tienda. Opcional.</small>
      </label>
      {hint && <p className="notice" role="status">{hint}</p>}
      <label className="field">
        <span>Regalo</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} placeholder="Auriculares, un libro, un taller…" />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Precio</span>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29,90" />
        </label>
        <label className="field">
          <span>Tienda</span>
          <input className="input" value={store} onChange={(e) => setStore(e.target.value)} maxLength={80} />
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
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <span>¿Cuántas ganas?</span>
        <div className="segmented">
          {([1, 2, 3] as const).map((p) => (
            <label key={p}>
              <input type="radio" name="priority" checked={priority === p} onChange={() => setPriority(p)} />
              {PRIORITY[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Cantidad</span>
        <input className="input" type="number" min={1} max={LIMITS.quantity} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
      </label>
      <label className="field">
        <span>Notas</span>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={LIMITS.notes} placeholder="Modelo, alternativas, dónde lo viste…" />
      </label>
      {err && <p className="notice notice-error" role="alert">{err}</p>}
    </Sheet>
  );
}
