import { Check, ClipboardText, PencilSimple } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../core/money';
import type { Item, Priority } from '../../core/types';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { errorText, Sheet, useToast } from '../kit';
import { ItemForm } from './ItemForm';

/** Primera URL de un texto («Mira esto en Amazon https://amzn.eu/d/…» → la URL). */
export const firstUrl = (text: string): string | null => text.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),.;]+$/, '') ?? null;

type Step = { kind: 'idle'; hint?: string } | { kind: 'reading' } | { kind: 'added'; item: Item } | { kind: 'manual'; url?: string; hint?: string };

/**
 * Añadir en 2 toques: «Añadir regalo» → «Pegar enlace». Lee el portapapeles, rellena con la tienda y GUARDA.
 * También vale pegar (Ctrl/Cmd+V) en cualquier punto de la hoja.
 */
export function AddGift({ listId, onClose, onSaved, onImport }: { listId: string; onClose: () => void; onSaved: () => void; onImport: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [manualUrl, setManualUrl] = useState('');
  const [peek, setPeek] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Si el navegador YA tiene permiso para leer el portapapeles, enseñamos qué se va a pegar. Nunca pedimos permiso al abrir.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'clipboard-read' as PermissionName })
      .then(async (p) => {
        if (p.state !== 'granted') return;
        const url = firstUrl(await navigator.clipboard.readText());
        if (url) setPeek(new URL(url).hostname.replace(/^www\./, ''));
      })
      .catch(() => {});
  }, []);

  const fromUrl = async (url: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStep({ kind: 'reading' });
    try {
      const existing = await api.listDetail(listId);
      if (existing.items.some((i) => i.url && sameUrl(i.url, url))) {
        setStep({ kind: 'idle', hint: 'Ya lo tienes en tu lista.' });
        return;
      }
      const meta = await api.unfurl(url).catch(() => null);
      if (!meta?.title) {
        // Fallback manual: el enlace se queda guardado en el formulario y solo falta el nombre.
        setStep({ kind: 'manual', url, hint: 'Esta tienda no nos deja ver los datos del regalo. Hemos guardado el enlace: escribe qué es y, si quieres, el precio.' });
        return;
      }
      const item = await api.saveItem(listId, { title: meta.title, url: meta.url ?? url, priceCents: meta.priceCents, store: meta.store, image: meta.image, priority: 2, quantity: 1 });
      setStep({ kind: 'added', item });
      onSaved();
      toast('Añadido a tu lista.', { action: { label: 'Deshacer', run: () => api.deleteItem(item.id).then(onSaved) } });
    } catch (e) {
      setStep({ kind: 'idle', hint: errorText(e) });
    } finally {
      busyRef.current = false;
    }
  };

  const paste = async () => {
    try {
      const url = firstUrl(await navigator.clipboard.readText());
      if (url) return fromUrl(url);
      setStep({ kind: 'idle', hint: 'No hay ningún enlace copiado. Pégalo aquí.' });
    } catch {
      setStep({ kind: 'idle', hint: 'Mantén pulsado el campo y elige Pegar.' });
    }
  };

  // Pegar en cualquier punto de la hoja.
  useEffect(() => {
    const on = (e: ClipboardEvent) => {
      const url = firstUrl(e.clipboardData?.getData('text') ?? '');
      if (url && (step.kind === 'idle' || step.kind === 'reading')) {
        e.preventDefault();
        void fromUrl(url);
      }
    };
    document.addEventListener('paste', on);
    return () => document.removeEventListener('paste', on);
  });

  if (step.kind === 'manual') {
    return <ItemForm listId={listId} initialUrl={step.url} hint={step.hint} onClose={onClose} onSaved={() => { onSaved(); onClose(); }} />;
  }

  if (step.kind === 'added') {
    return <Added item={step.item} onClose={onClose} onMore={() => setStep({ kind: 'idle' })} onSaved={onSaved} />;
  }

  return (
    <Sheet title="Añadir a tu lista" onClose={onClose}>
      <div className="stack">
        <Button variant="primary" size="lg" wide icon={ClipboardText} loading={step.kind === 'reading'} onClick={paste} data-autofocus>
          {step.kind === 'reading' ? 'Leyendo la tienda…' : peek ? `Pegar ${peek}` : 'Pegar enlace'}
        </Button>
        <p className="meta">Copia el enlace en Amazon o en cualquier tienda y pégalo aquí.</p>
        {step.kind === 'idle' && step.hint && (
          <>
            <p className="notice" role="status">{step.hint}</p>
            <label className="field">
              <span>Enlace</span>
              <input
                className="input"
                type="url"
                inputMode="url"
                value={manualUrl}
                autoFocus
                placeholder="https://"
                onChange={(e) => {
                  setManualUrl(e.target.value);
                  const url = firstUrl(e.target.value);
                  if (url) void fromUrl(url);
                }}
              />
            </label>
          </>
        )}
      </div>
      <div className="stack" style={{ gap: 0 }}>
        <Button variant="link" onClick={() => setStep({ kind: 'manual' })}>
          Escribirlo a mano
        </Button>
        <Button variant="link" onClick={onImport}>
          Importar desde Excel
        </Button>
      </div>
    </Sheet>
  );
}

function Added({ item, onClose, onMore, onSaved }: { item: Item; onClose: () => void; onMore: () => void; onSaved: () => void }) {
  const api = useApi();
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [editing, setEditing] = useState(false);
  if (editing) return <ItemForm listId={item.list} item={{ ...item, priority }} onClose={onClose} onSaved={() => { onSaved(); onClose(); }} />;
  return (
    <Sheet
      title="Añadido a tu lista"
      onClose={onClose}
      footer={
        <ButtonGroup align="stretch">
          <Button variant="primary" onClick={onClose}>Listo</Button>
          <Button variant="secondary" onClick={onMore}>Añadir otro</Button>
        </ButtonGroup>
      }
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="gift-thumb paper" aria-hidden>
          {item.image && <img src={item.image} alt="" referrerPolicy="no-referrer" />}
        </span>
        <div className="grow">
          <p style={{ fontWeight: 700 }}>
            <Check size={18} weight="bold" aria-hidden style={{ verticalAlign: '-3px', color: 'var(--abeto)' }} /> {item.title}
          </p>
          <p className="meta">
            {item.priceCents !== undefined && <span className="money">{formatMoney(item.priceCents)}</span>}
            {item.store && ` · ${item.store}`}
          </p>
        </div>
      </div>
      <fieldset className="field">
        <legend>¿Cuántas ganas?</legend>
        <div className="segmented">
          {([1, 2, 3] as const).map((p) => (
            <label key={p}>
              <input
                type="radio"
                name="ganas"
                checked={priority === p}
                onChange={() => {
                  setPriority(p);
                  void api.saveItem(item.list, { ...item, priority: p }, item.id).then(onSaved);
                }}
              />
              {PRIORITY[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <Button variant="ghost" icon={PencilSimple} onClick={() => setEditing(true)}>
        Más detalles (talla, color, notas)
      </Button>
    </Sheet>
  );
}

function sameUrl(a: string, b: string) {
  try {
    const x = new URL(a);
    const y = new URL(b);
    return x.hostname.replace(/^www\./, '') === y.hostname.replace(/^www\./, '') && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '');
  } catch {
    return a === b;
  }
}
