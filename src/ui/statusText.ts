import type { ItemStatus } from '../core/status';
import type { BuyMode, Claim, Contribution, Id, Item } from '../core/types';

export type Tone = 'open' | 'mine' | 'taken';
export type GiftActionKind = 'reserve-self' | 'reserve-pot' | 'buy' | 'pot' | 'mypart' | 'buy-pot';

export interface CardAction {
  kind: GiftActionKind;
  label: string;
  /** La unidad sobre la que se actúa (comprar una reserva o algo apuntado para la hucha). */
  claim?: Claim;
}

export interface StatusLine {
  text: string;
  /** Parte de `text` que va en negrita (el nombre). */
  strong?: string;
  tone: Tone;
  /** Como mucho dos: la principal primero. */
  actions: CardAction[];
  /** Mi reserva, si la hay. */
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
 * La frase de estado de un regalo, con sujeto y verbo, y sus acciones de un toque según el modo del grupo
 * (spec plazas-hucha §10.6). Solo para quien PUEDE ver el estado (nunca en la propia lista).
 */
export function statusLine(item: Item, status: ItemStatus, claims: Claim[], pots: Contribution[], me: Id, nameOf: (id: Id) => string, mode: BuyMode = 'individual'): StatusLine {
  const mine = claims.filter((c) => c.item === item.id);
  const myClaim = mine.find((c) => c.user === me && (c.kind ?? 'self') === 'self');
  const potUsers = pots.filter((c) => c.item === item.id && c.amountCents > 0).map((c) => c.user);
  const inPot = potUsers.includes(me);
  const potRow = mine.find((c) => c.kind === 'pot' && c.status === 'reserved');
  const name = (id: Id) => (id === me ? 'tú' : nameOf(id));

  // Lo mío primero: lo que yo he reservado.
  if (myClaim) {
    return myClaim.status === 'bought'
      ? { text: 'Lo compraste tú', tone: 'mine', actions: [], myClaim }
      : { text: 'Lo reservas tú', tone: 'mine', actions: [{ kind: 'buy', label: 'Ya lo compré', claim: myClaim }], myClaim };
  }
  if (status.kind === 'partial' || status.kind === 'covered') {
    const names = people(potUsers, me, nameOf);
    const who = `${inPot ? 'ponéis' : 'ponen'} ${names}`;
    if (status.kind === 'covered') {
      return inPot
        ? { text: `Cubierto · ${who}`, strong: names, tone: 'mine', actions: [{ kind: 'buy-pot', label: 'Ya lo compré' }] }
        : { text: `Cubierto · ${who}`, strong: names, tone: 'taken', actions: [] };
    }
    const pct = status.percent !== undefined ? ` · ${status.percent} %` : '';
    return inPot
      ? { text: `A medias${pct} · ${who}`, strong: names, tone: 'mine', actions: [{ kind: 'mypart', label: 'Cambiar mi parte' }] }
      : { text: `A medias${pct} · ${who}`, strong: names, tone: 'open', actions: [{ kind: 'pot', label: 'Poner dinero' }] };
  }
  if (status.kind === 'free') {
    const multi = item.quantity > 1;
    const actions: CardAction[] = [];
    if (mode !== 'hucha') actions.push({ kind: 'reserve-self', label: multi ? 'Me reservo 1' : 'Me lo reservo' });
    if (mode !== 'individual') actions.push({ kind: 'reserve-pot', label: 'Para la hucha' });
    return { text: multi ? `Quedan ${status.unitsLeft} de ${item.quantity}` : 'Libre', tone: 'open', actions };
  }
  if (status.kind === 'pot' && potRow) {
    const by = name(potRow.user);
    const verb = potRow.user === me ? 'lo apuntaste' : 'lo apuntó';
    return { text: `Para la hucha · ${verb} ${by}`, strong: by, tone: potRow.user === me ? 'mine' : 'open', actions: [{ kind: 'buy', label: 'Ya comprado', claim: potRow }] };
  }
  if (status.kind === 'bought') {
    const potBought = mine.find((c) => c.kind === 'pot' && c.status === 'bought');
    if (potBought) {
      const payer = potBought.paidBy ?? potBought.user;
      const by = name(payer);
      return { text: `Comprado con la hucha · ${payer === me ? 'lo adelantaste' : 'adelantó'} ${by}`, strong: by, tone: potBought.paidBy === me ? 'mine' : 'taken', actions: [] };
    }
    const ids = [...new Set(mine.map((c) => c.paidBy ?? c.user))];
    const names = people(ids, me, nameOf);
    return { text: `${ids.length > 1 ? 'Lo compraron' : 'Lo compró'} ${names}`, strong: names, tone: 'taken', actions: [] };
  }
  const ids = [...new Set(mine.filter((c) => (c.kind ?? 'self') === 'self').map((c) => c.user))];
  const names = people(ids, me, nameOf);
  return { text: `${ids.length > 1 ? 'Lo reservan' : 'Lo reserva'} ${names}`, strong: names, tone: 'taken', actions: [] };
}
