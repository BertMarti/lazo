import { formatMoney } from '../core/money';
import type { ItemStatus } from '../core/status';
import type { Item } from '../core/types';
import { initial, Seal, type Flavor } from './kit';

export const PRIORITY: Record<1 | 2 | 3, string> = { 1: 'Me encantaría', 2: 'Me gustaría', 3: 'Si sobra' };

/**
 * Etiqueta de un regalo, envuelta en el papel de su dueño. Si `status` es undefined (lista propia),
 * no se pinta ningún sello ni banda: la sorpresa no deja rastro, ni siquiera visual.
 */
export function GiftTag({ item, flavor, status, fresh, onOpen }: { item: Item; flavor: Flavor; status?: ItemStatus; fresh?: boolean; onOpen: () => void }) {
  const taken = status && (status.kind === 'reserved' || status.kind === 'bought');
  return (
    <button type="button" className="gift" data-flavor={flavor} onClick={onOpen} aria-label={`${item.title}${status ? `, ${statusWord(status)}` : ''}`}>
      <div className="gift-wrap">
        {item.image ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="monogram" aria-hidden>{initial(item.title)}</span>}
        {taken && (
          <span className={`band${status.kind === 'bought' ? ' band-bought' : ''}`} data-enter={fresh || undefined} aria-hidden>
            {status.kind === 'bought' ? 'Comprado' : 'Reservado'}
          </span>
        )}
      </div>
      {status && (
        <span className="seal-slot">
          <Seal status={status} animate={fresh} />
        </span>
      )}
      <div className="gift-body">
        <span className="gift-title">{item.title}</span>
        <span className="gift-line">
          <span className="meta truncate">{item.store ?? 'Sin tienda'}</span>
          {item.priceCents !== undefined && <span className="price">{formatMoney(item.priceCents, item.currency)}</span>}
        </span>
        {item.priority === 1 && <span className="prio">{PRIORITY[1]}</span>}
      </div>
    </button>
  );
}

const statusWord = (s: ItemStatus) =>
  ({ free: 'libre', reserved: 'reservado', bought: 'comprado', partial: `a medias${s.percent !== undefined ? ` (${s.percent} %)` : ''}`, covered: 'cubierto' })[s.kind];
