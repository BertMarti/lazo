import { EyeSlash, Plus } from '@phosphor-icons/react';
import type { Member } from '../api/types';
import type { BudgetProgress } from '../core/budget';
import type { GiftList } from '../core/types';
import { BudgetBar } from './BudgetBar';
import { Button } from './Button';
import { Avatar, initial, type Flavor } from './kit';

/**
 * Una persona del grupo: avatar grande, nombre, cuántos regalos y su presupuesto. Toda la tarjeta abre su lista.
 * La de uno mismo NO lleva barra ni cifras: «Lo que te regalan es sorpresa» (y el servidor ni las envía).
 */
export function MemberCard({ list, owner, flavor, mine, giftCount, freeCount, budget, onAdd, onSetBudget, onInvite }: {
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
  /** Plaza libre y quien mira es admin: enviarle su enlace. */
  onInvite?: () => void;
}) {
  const free = list.kind !== 'child' && !list.user;
  const name = mine ? 'Tu lista' : list.name;
  const gifts = `${giftCount} ${giftCount === 1 ? 'regalo' : 'regalos'}`;
  const meta = free
    ? `Aún no ha entrado${giftCount ? ` · ${gifts}` : ''}`
    : mine
      ? giftCount
        ? gifts
        : 'Aún no has pedido nada'
      : giftCount === 0
        ? 'Aún no ha pedido nada'
        : freeCount === 0
          ? `${gifts} · todo cogido`
          : freeCount === null
            ? gifts
            : `${gifts} · ${freeCount} ${freeCount === 1 ? 'libre' : 'libres'}`;

  return (
    <article className="member" data-flavor={flavor} data-mine={mine || undefined} data-free={free || undefined}>
      {free ? (
        <span className="avatar avatar-lg avatar-free" aria-hidden>
          {initial(list.name)}
        </span>
      ) : (
        <Avatar user={{ name: list.name, color: owner?.color ?? flavor }} size="lg" />
      )}
      <h2>
        <a className="member-link" href={`#/l/${list.id}`}>
          {name}
        </a>
      </h2>
      <p className="meta">{meta}</p>
      {list.kind === 'child' && <p className="meta">La llevan sus padres</p>}
      {mine ? (
        <>
          <p className="vis-line">
            <EyeSlash size={18} weight="bold" aria-hidden /> Lo que te regalan es sorpresa
          </p>
          {onAdd && (
            <span className="on-top">
              <Button variant="primary" size="sm" icon={Plus} onClick={onAdd}>
                Añadir
              </Button>
            </span>
          )}
        </>
      ) : (
        <>
          {budget ? (
            <BudgetBar p={budget} size="sm" label={`Presupuesto para ${list.name}`} />
          ) : (
            onSetBudget && !free && (
              <span className="on-top">
                <Button variant="link" size="sm" onClick={onSetBudget}>
                  Poner presupuesto
                </Button>
              </span>
            )
          )}
          {free && onInvite && (
            <span className="on-top">
              <Button variant="secondary" size="sm" onClick={onInvite}>
                Invitar
              </Button>
            </span>
          )}
        </>
      )}
    </article>
  );
}
