import { CaretRight, EyeSlash, Plus } from '@phosphor-icons/react';
import type { Member } from '../api/types';
import type { BudgetProgress } from '../core/budget';
import type { GiftList } from '../core/types';
import { BudgetBar } from './BudgetBar';
import { Button } from './Button';
import { Avatar, type Flavor } from './kit';

/**
 * Tarjeta de una persona del grupo: toda ella abre su lista. La de uno mismo NO lleva barra ni cifras:
 * «Tu presupuesto y tus reservas son sorpresa» (y el servidor ni siquiera las envía).
 */
export function MemberCard({ list, owner, flavor, mine, giftCount, freeCount, budget, compact, current, onAdd, onSetBudget }: {
  list: GiftList;
  owner?: Member;
  flavor: Flavor;
  mine: boolean;
  giftCount: number;
  freeCount: number | null;
  budget?: BudgetProgress;
  compact?: boolean;
  current?: boolean;
  onAdd?: () => void;
  onSetBudget?: () => void;
}) {
  const name = mine ? 'Tu lista' : list.name;
  const gifts = `${giftCount} ${giftCount === 1 ? 'regalo' : 'regalos'}`;
  const meta = mine
    ? giftCount
      ? gifts
      : 'Tu lista está vacía'
    : giftCount === 0
      ? 'Aún no ha apuntado nada'
      : freeCount === 0
        ? `${gifts} · todo cogido`
        : freeCount === null
          ? gifts
          : `${gifts} · ${freeCount} ${freeCount === 1 ? 'libre' : 'libres'}`;

  return (
    <article className={`member${compact ? ' member-compact' : ''}`} data-flavor={flavor} aria-current={current || undefined}>
      <div className="member-head">
        <Avatar user={{ name: list.name, color: owner?.color ?? flavor }} size={compact ? undefined : 'md'} />
        <div className="grow">
          <h2>
            <a className="member-link" href={`#/l/${list.id}`}>
              {name}
            </a>
          </h2>
          {!compact && <p className="meta">{meta}</p>}
        </div>
        {mine && onAdd && !compact ? (
          <span className="on-top">
            <Button variant="primary" size="sm" icon={Plus} onClick={onAdd}>
              Añadir
            </Button>
          </span>
        ) : (
          <CaretRight className="go" size={20} weight="bold" aria-hidden />
        )}
      </div>
      {mine ? (
        !compact && (
          <p className="vis-band">
            <EyeSlash size={18} weight="bold" aria-hidden /> Tu presupuesto y tus reservas son sorpresa
          </p>
        )
      ) : budget ? (
        <BudgetBar p={budget} size={compact ? 'sm' : 'md'} label={`Presupuesto para ${list.name}`} />
      ) : (
        !compact && (
          <div className="row between">
            <span className="meta">Sin presupuesto</span>
            {onSetBudget && (
              <span className="on-top">
                <Button variant="ghost" size="sm" onClick={onSetBudget}>
                  Poner presupuesto
                </Button>
              </span>
            )}
          </div>
        )
      )}
      {!list.user && !compact && <p className="meta">La llevan sus padres</p>}
    </article>
  );
}
