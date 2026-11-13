import { Check, ClipboardText, PencilSimple } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../../core/money';
import type { Item, Priority } from '../../core/types';
import { Bow } from '../Bow';
import { Button, ButtonGroup } from '../Button';
import { useApi } from '../ctx';
import { PRIORITY } from '../Gift';
import { errorText, Sheet, useToast } from '../kit';
import { listaId, parseListaPegada, soloEnlace } from '../../core/amazonLista';
import { leeCompartido, olvidaCompartido } from '../compartido';
import { codigoCorto } from '../../core/amazonServidor';
import { AmazonLista, type EnlaceLista } from './AmazonLista';
import { ItemForm } from './ItemForm';

/** Primera URL de un texto («Mira esto en Amazon https://amzn.eu/d/…» → la URL). */
export const firstUrl = (text: string): string | null => text.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),.;]+$/, '') ?? null;

type Pegado = { text: string; html?: string };
type Step =
  | { kind: 'idle'; hint?: string }
  | { kind: 'reading' }
  | { kind: 'added'; item: Item }
  | { kind: 'manual'; url?: string; hint?: string }
  | { kind: 'amazon'; enlace?: EnlaceLista; corto?: string; pegado?: Pegado; deOtraApp?: boolean };


/** ¿Lo pegado es una lista de Amazon (su enlace, o la página copiada entera)? Con el enlace, el servidor puede leerla. */
function comoLista(p: Pegado): Step | null {
  const id = listaId(p.text);
  if (id && soloEnlace(p.text)) return { kind: 'amazon', enlace: { id } };
  const n = parseListaPegada(p.text, p.html).length; // V11-1: una sola pasada
  if (id && !n) return { kind: 'amazon', enlace: { id } };
  return n >= 2 ? { kind: 'amazon', pegado: p } : null;
}

/**
 * Añadir en 2 toques: «Añadir regalo» → «Pegar enlace». Lee el portapapeles, rellena con la tienda y GUARDA.
 * También vale pegar (Ctrl/Cmd+V) en cualquier punto de la hoja.
 */
export function AddGift({ listId, onClose, onSaved, onImport, amazon }: { listId: string; onClose: () => void; onSaved: () => void; onImport: () => void; amazon?: boolean }) {
  const api = useApi();
  const toast = useToast();
  // Lo compartido desde otra app: una lista va a la vista previa; el enlace de un producto suelto, al alta normal.
  const [[compartido, suelto]] = useState(() => {
    const text = amazon ? leeCompartido() : null;
    return [text, text && !comoLista({ text }) ? firstUrl(text) : null] as const;
  });
  const [step, setStep] = useState<Step>(() =>
    !amazon || suelto ? { kind: 'idle' } : { kind: 'amazon', pegado: compartido ? { text: compartido } : undefined, deOtraApp: !!compartido },
  );
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

  const fromUrl = async (url: string, noEsLista = false, deOtraApp = false) => {
    if (busyRef.current) return;
    const id = listaId(url);
    if (id) return setStep({ kind: 'amazon', enlace: { id }, deOtraApp });
    // amzn.eu/d/…: puede ser una lista o un producto. Si el servidor lee listas, lo averigua él (sin abrir la lista).
    const corto = noEsLista ? null : codigoCorto(url);
    if (corto && (await api.capacidades()).amazon) return setStep({ kind: 'amazon', enlace: { corto }, corto: url, deOtraApp });
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
        setStep({ kind: 'manual', url, hint: `${new URL(url).hostname.replace(/^www\./, '')} no nos deja ver los datos del regalo. Hemos guardado el enlace: escribe qué es y, si quieres, el precio.` });
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
      const text = await navigator.clipboard.readText();
      const lista = comoLista({ text });
      if (lista) return setStep(lista);
      const url = firstUrl(text);
      if (url) return fromUrl(url);
      setStep({ kind: 'idle', hint: 'No encuentro ningún enlace copiado. Vuelve a la tienda, cópialo y pégalo en este campo.' });
    } catch {
      setStep({ kind: 'idle', hint: 'El móvil no nos deja pegarlo solo. Mantén el dedo en el campo «Enlace» y elige «Pegar».' });
    }
  };

  useEffect(() => {
    if (!suelto) return;
    olvidaCompartido();
    void fromUrl(suelto, false, true);
  }, []);

  // Pegar en cualquier punto de la hoja.
  useEffect(() => {
    const on = (e: ClipboardEvent) => {
      if (step.kind !== 'idle' && step.kind !== 'reading') return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const lista = comoLista({ text, html: e.clipboardData?.getData('text/html') || undefined });
      if (lista) {
        e.preventDefault();
        return setStep(lista);
      }
      const url = firstUrl(text);
      if (url) {
        e.preventDefault();
        void fromUrl(url);
      }
    };
    document.addEventListener('paste', on);
    return () => document.removeEventListener('paste', on);
  });

  if (step.kind === 'amazon') {
    const corto = step.corto;
    return (
      <AmazonLista
        listId={listId}
        enlace={step.enlace}
        compartido={step.pegado}
        deOtraApp={step.deOtraApp}
        onNoEsLista={corto ? () => (setStep({ kind: 'idle' }), void fromUrl(corto, true)) : undefined}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

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
        <p className="meta">En la tienda, pulsa «Compartir» y «Copiar enlace». Luego vuelve y toca este botón. Si el móvil pregunta, pulsa «Permitir».</p>
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
        <Button variant="link" onClick={() => setStep({ kind: 'amazon' })}>
          Importar lista de Amazon
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
          {item.image ? <img src={item.image} alt="" referrerPolicy="no-referrer" /> : <span className="noimg"><Bow size={32} /></span>}
        </span>
        <div className="grow">
          <p className="purchase-title">
            <Check size={18} weight="bold" aria-hidden style={{ verticalAlign: '-3px', color: 'var(--abeto)' }} /> {item.title}
          </p>
          <p className="meta">
            {item.priceCents !== undefined && <span className="money">{formatMoney(item.priceCents)}</span>}
            {item.store && ` · ${item.store}`}
          </p>
        </div>
      </div>
      <fieldset className="field">
        <legend>¿Cuántas ganas? (puedes dejarlo así)</legend>
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
