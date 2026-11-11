import type { Cents, Claim, Contribution, Item } from './types';

export interface BudgetProgress {
  target: Cents;
  /** Reservas y compras (precio × unidades) + aportaciones de regalos a medias. */
  committed: Cents;
  left: Cents;
  over: boolean;
  /** 0–100, para la barra. */
  percent: number;
}

/** Cuánto se ha comprometido ya del presupuesto de una persona. Solo para quien PUEDE verlo (no el destinatario). */
export function committedOn(items: Item[], claims: Claim[], contributions: Contribution[]): Cents {
  let total = 0;
  for (const item of items) {
    const pot = contributions.filter((c) => c.item === item.id).reduce((s, c) => s + Math.max(0, c.amountCents), 0);
    if (pot > 0) {
      total += pot;
      continue;
    }
    const units = claims.filter((c) => c.item === item.id).reduce((s, c) => s + c.units, 0);
    total += units * (item.priceCents ?? 0);
  }
  return total;
}

export function budgetProgress(target: Cents, items: Item[], claims: Claim[], contributions: Contribution[]): BudgetProgress {
  const committed = committedOn(items, claims, contributions);
  return {
    target,
    committed,
    left: target - committed,
    over: committed > target,
    percent: target > 0 ? Math.min(100, Math.round((committed * 100) / target)) : 0,
  };
}
