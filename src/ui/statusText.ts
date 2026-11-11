import type { ItemStatus } from '../core/status';
import type { Claim, Contribution, Id, Item } from '../core/types';

export type Tone = 'open' | 'mine' | 'taken';
export type GiftAction = 'reserve' | 'buy' | 'pot' | 'mypart' | 'buy-pot';

export interface StatusLine {
  text: string;
  /** Parte de `text` que va en negrita (el nombre). */
  strong?: string;
  tone: Tone;
  action?: GiftAction;
  actionLabel?: string;
  /** Mi reserva, si la hay (para «Ya lo compré» y «Soltar»). */
  myClaim?: Claim;
}

/** «Samira», «Samira y Papá», «Samira, Papá y tú», «Samira, Papá y 2 más». Yo siempre al final, como «tú». */
export function people(ids: Id[], me: Id, nameOf: (id: Id) => string): string {
  const others = ids.filter((id) => id !== me).map(nameOf);
  const all = ids.includes(me) ? [...others, 'tú'] : others;
  if (all.length <= 1) return all[0] ?? '';
  if (all.length > 3) return `${all.slice(0, 2).join(', ')} y ${all.length - 2} más`;
  return `${all.slice(0, -1).join(', ')} y ${all[all.length - 1]}`;
}

/**
 * La frase de estado de un regalo, con sujeto y verbo, y su acción de un toque.
 * Solo para quien PUEDE ver el estado (nunca se llama en la propia lista).
 */
export function statusLine(item: Item, status: ItemStatus, claims: Claim[], pots: Contribution[], me: Id, nameOf: (id: Id) => string): StatusLine {
  const mine = claims.filter((c) => c.item === item.id);
  const myClaim = mine.find((c) => c.user === me);
  const potUsers = pots.filter((c) => c.item === item.id && c.amountCents > 0).map((c) => c.user);
  const inPot = potUsers.includes(me);

  if (myClaim) {
    return myClaim.status === 'bought'
      ? { text: 'Lo compraste tú', tone: 'mine', myClaim }
      : { text: 'Lo reservas tú', tone: 'mine', action: 'buy', actionLabel: 'Ya lo compré', myClaim };
  }
  if (status.kind === 'partial' || status.kind === 'covered') {
    const verb = inPot ? 'ponéis' : 'ponen';
    const names = people(potUsers, me, nameOf);
    const who = `${verb} ${names}`;
    if (status.kind === 'covered') {
      return inPot
        ? { text: `Cubierto · ${who}`, strong: names, tone: 'mine', action: 'buy-pot', actionLabel: 'Ya lo compré' }
        : { text: `Cubierto · ${who}`, strong: names, tone: 'taken' };
    }
    const pct = status.percent !== undefined ? ` · ${status.percent} %` : '';
    return inPot
      ? { text: `A medias${pct} · ${who}`, strong: names, tone: 'mine', action: 'mypart', actionLabel: 'Cambiar mi parte' }
      : { text: `A medias${pct} · ${who}`, strong: names, tone: 'open', action: 'pot', actionLabel: 'Poner dinero' };
  }
  if (status.kind === 'free') {
    const multi = item.quantity > 1;
    return {
      text: multi ? `Quedan ${status.unitsLeft} de ${item.quantity}` : 'Libre',
      tone: 'open',
      action: 'reserve',
      actionLabel: multi ? 'Reservar 1' : 'Reservar',
    };
  }
  const ids = [...new Set(mine.map((c) => c.user))];
  const plural = ids.length > 1;
  const names = people(ids, me, nameOf);
  return status.kind === 'bought'
    ? { text: `${plural ? 'Lo compraron' : 'Lo compró'} ${names}`, strong: names, tone: 'taken' }
    : { text: `${plural ? 'Lo reservan' : 'Lo reserva'} ${names}`, strong: names, tone: 'taken' };
}
