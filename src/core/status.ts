import type { Claim, Contribution, Id, Item } from './types';

export type StatusKind = 'free' | 'reserved' | 'bought' | 'partial' | 'covered';

export interface ItemStatus {
  kind: StatusKind;
  unitsLeft: number;
  /** Porcentaje cubierto de un regalo a medias (0–100). Sin precio conocido no hay porcentaje. */
  percent?: number;
  raised: number;
  by: Id[];
}

/** Estado de un regalo para quien PUEDE verlo (ver `canSeeStatus`). */
export function itemStatus(item: Item, claims: Claim[], contributions: Contribution[]): ItemStatus {
  const mine = claims.filter((c) => c.item === item.id);
  const pot = contributions.filter((c) => c.item === item.id && c.amountCents > 0);
  const claimed = mine.reduce((s, c) => s + c.units, 0);
  const unitsLeft = Math.max(0, item.quantity - claimed);
  const by = [...new Set([...mine.map((c) => c.user), ...pot.map((c) => c.user)])];
  const raised = pot.reduce((s, c) => s + c.amountCents, 0);

  if (pot.length > 0 && unitsLeft > 0) {
    if (!item.priceCents) return { kind: 'partial', unitsLeft, raised, by };
    const percent = Math.min(100, Math.floor((raised * 100) / item.priceCents));
    return { kind: raised >= item.priceCents ? 'covered' : 'partial', unitsLeft, percent, raised, by };
  }
  if (unitsLeft > 0) return { kind: 'free', unitsLeft, raised, by };
  return { kind: mine.every((c) => c.status === 'bought') ? 'bought' : 'reserved', unitsLeft, raised, by };
}
