import { formatMoney } from '../core/money';
import type { ItemStatus } from '../core/status';
import type { Item } from '../core/types';
import { Button } from './Button';
import { Seal, type Flavor } from './kit';
import type { StatusLine } from './statusText';

export const PRIORITY: Record<1 | 2 | 3, string> = { 1: 'Me encantaría', 2: 'Me gustaría', 3: 'Si sobra' };

/**
 * Un regalo. Cuerpo = abre la ficha; pie = estado en frase + la acción de UN toque.
 * En la lista propia (`line` undefined) no hay pie, ni sello, ni precinto: la sorpresa no deja rastro.
 */
export function GiftCard({ item, flavor, status, line, fresh, busy, onOpen, onAction }: {
  item: Item;
  flavor: Flavor;
  status?: ItemStatus;
  line?: StatusLine;
  fresh?: boolean;
  busy?: boolean;
  onOpen: () => void;
  onAction?: () => void;
}) {
  const taken = status && (status.kind === 'reserved' || status.kind === 'bought' || status.kind === 'covered');
  return (
    <article className="gift" data-tone={line?.tone ?? 'open'} data-flavor={flavor}>
      {taken && !item.image && <span className={`gift-top${status.kind === 'bought' ? ' gift-top-bought' : ''}`} aria-hidden />}
      <button type="button" className="gift-open" onClick={onOpen} aria-label={`${item.title}${line ? `. ${line.text}` : ''}. Ver detalles`}>
        {item.image && (
          <span className="gift-thumb" aria-hidden>
            <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
            {taken && <span className={`band${status.kind === 'bought' ? ' band-bought' : ''}`} data-enter={fresh || undefined} />}
          </span>
        )}
        <span className="gift-text">
          <span className="gift-title">{item.title}</span>
          <span className="gift-price">
            {item.priceCents !== undefined ? <span className="money">{formatMoney(item.priceCents, item.currency)}</span> : 'Sin precio'}
            {item.store && ` · ${item.store}`}
          </span>
          {item.priority === 1 && <span className="prio">{PRIORITY[1]}</span>}
        </span>
      </button>
      {line && status && (
        <div className="gift-foot">
          <span className="status">
            <Seal status={status} size={24} animate={fresh} />
            <span className="status-text">{bold(line.text, line.strong)}</span>
          </span>
          {line.action && onAction && (
            <Button variant={line.action === 'reserve' ? 'primary' : 'secondary'} size="sm" loading={busy} onClick={onAction}>
              {line.actionLabel}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

/** «Lo compró Samira» con el nombre en negrita. */
function bold(text: string, strong?: string) {
  const i = strong ? text.lastIndexOf(strong) : -1;
  if (!strong || i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <b>{strong}</b>
      {text.slice(i + strong.length)}
    </>
  );
}
