import { EyeSlash } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../core/money';
import type { ItemStatus } from '../core/status';
import type { Item } from '../core/types';
import { Bow, Confetti } from './Bow';
import { Button } from './Button';
import { Seal, type Flavor } from './kit';
import type { CardAction, StatusLine } from './statusText';

export const PRIORITY: Record<1 | 2 | 3, string> = { 1: 'Me encantaría', 2: 'Me gustaría', 3: 'Si sobra' };

/**
 * Un regalo del tablero: foto grande con su etiqueta de precio, la etiqueta de estado y la cinta
 * (reservado = una banda; comprado = el paquete atado en cruz). Debajo, título, la frase de estado y la acción.
 * En la lista propia (`line` undefined) no hay ni cinta ni etiqueta: la sorpresa no deja rastro.
 */
export function GiftCard({ item, flavor, status, line, owner, forName, fresh, busy, onOpen, onAction }: {
  item: Item;
  flavor: Flavor;
  status?: ItemStatus;
  line?: StatusLine;
  /** Nombre del dueño, para «Marta lo ha quitado de su lista». */
  owner?: string;
  /** En el tablero del grupo: «Para Marta». */
  forName?: string;
  fresh?: boolean;
  busy?: string | null;
  onOpen: () => void;
  onAction?: (a: CardAction) => void;
}) {
  const k = status?.kind;
  const tied = !!line && (k === 'reserved' || k === 'pot' || k === 'bought' || k === 'covered');
  const bought = k === 'bought' || k === 'covered';
  const mine = line?.tone === 'mine';
  const price = item.priceCents !== undefined ? formatMoney(item.priceCents, item.currency) : null;

  // Confeti al pasar a comprado (solo cuando ocurre aquí, nunca al cargar).
  const [burst, setBurst] = useState(0);
  const prev = useRef(k);
  useEffect(() => {
    if (fresh && bought && prev.current !== k) setBurst((n) => n + 1);
    prev.current = k;
  }, [k, fresh, bought]);

  return (
    <article className="gift" data-tone={line?.tone ?? 'open'} data-flavor={flavor}>
      <button type="button" className="gift-open" onClick={onOpen} aria-label={`${item.title}${price ? `, ${price}` : ''}${line ? `. ${line.text}` : ''}. Ver detalles`}>
        <span className="gift-photo" aria-hidden>
          {item.image ? (
            <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <span className="noimg">
              <Bow size={56} />
            </span>
          )}
          {tied && (
            <>
              <span className={`band${mine ? ' band-mine' : ''}`} data-enter={fresh || undefined} />
              {bought && <span className={`band-v${mine ? ' band-mine' : ''}`} data-enter={fresh || undefined} />}
              <span className="band-bow">
                <Bow size={52} tie={fresh} />
              </span>
            </>
          )}
          {price && (
            <span className="price" data-long={price.length > 7 || undefined}>
              {price}
            </span>
          )}
          {item.secret && (
            <span className="tags-top">
              <span className="tag" data-k="secret">
                <EyeSlash size={16} weight="bold" />
                Sorpresa
              </span>
            </span>
          )}
          {line && status && k !== 'free' && (
            <span className="tags">
              <Seal status={status} mine={mine} />
            </span>
          )}
        </span>
        <span className="gift-text">
          <span className="gift-title">{item.title}</span>
          {forName && (
            <span className="gift-store">
              Para <b>{forName}</b>
            </span>
          )}
          {!forName && (item.store || (!item.secret && item.priority === 1)) && (
            <span className="gift-store">
              {!item.secret && item.priority === 1 && <span className="prio">{PRIORITY[1]}</span>}
              {!item.secret && item.priority === 1 && item.store && ' · '}
              {item.store}
            </span>
          )}
          {price === null && <span className="gift-store">Sin precio</span>}
          {item.removed && <span className="meta">{owner ?? 'Su dueño'} lo ha quitado de su lista</span>}
        </span>
      </button>
      {line && status && (
        <div className="gift-foot">
          <span className="status">
            {bold(line.text, line.strong)}
          </span>
          {onAction && line.actions.length > 0 && (
            <span className="gift-actions">
              {line.actions.map((a, i) => (
                <Button
                  key={a.kind}
                  variant={i === 0 && (a.kind === 'reserve-self' || a.kind === 'reserve-pot' || a.kind === 'buy' || a.kind === 'buy-pot') ? 'primary' : 'secondary'}
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
          <Confetti fire={burst} />
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
