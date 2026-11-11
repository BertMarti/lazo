import { formatMoney } from '../core/money';
import type { ItemStatus } from '../core/status';
import type { Item } from '../core/types';
import { Button } from './Button';
import { Seal, type Flavor } from './kit';
import type { CardAction, StatusLine } from './statusText';

export const PRIORITY: Record<1 | 2 | 3, string> = { 1: 'Me encantaría', 2: 'Me gustaría', 3: 'Si sobra' };

/**
 * Un regalo. Cuerpo = abre la ficha; pie = estado en frase + la acción de UN toque.
 * En la lista propia (`line` undefined) no hay pie, ni sello, ni precinto: la sorpresa no deja rastro.
 */
export function GiftCard({ item, flavor, status, line, owner, fresh, busy, onOpen, onAction }: {
  item: Item;
  flavor: Flavor;
  status?: ItemStatus;
  line?: StatusLine;
  /** Nombre del dueño, para «Mamá lo ha quitado de su lista». */
  owner?: string;
  fresh?: boolean;
  busy?: string | null;
  onOpen: () => void;
  onAction?: (a: CardAction) => void;
}) {
  const taken = status && (status.kind === 'reserved' || status.kind === 'pot' || status.kind === 'bought' || status.kind === 'covered');
  return (
    <article className="gift" data-tone={line?.tone ?? 'open'} data-flavor={flavor}>
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
          {item.secret ? <span className="prio">Sorpresa</span> : item.priority === 1 && <span className="prio">{PRIORITY[1]}</span>}
          {item.removed && <span className="meta">{owner ?? 'Su dueño'} lo ha quitado de su lista</span>}
        </span>
      </button>
      {line && status && (
        <div className="gift-foot">
          <span className="status">
            <Seal status={status} size={24} animate={fresh} />
            <span className="status-text">{bold(line.text, line.strong)}</span>
          </span>
          {onAction && line.actions.length > 0 && (
            <span className="gift-actions">
              {line.actions.map((a, i) => (
                <Button
                  key={a.kind}
                  variant={i === 0 && (a.kind === 'reserve-self' || a.kind === 'reserve-pot') ? 'primary' : 'secondary'}
                  size="sm"
                  loading={busy === a.kind}
                  disabled={!!busy && busy !== a.kind}
                  onClick={() => onAction(a)}
                >
                  {a.label}
                </Button>
              ))}
            </span>
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
