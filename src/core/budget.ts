import { claimCost } from './status';
import type { BuyMode, Cents, Claim, Contribution, Item } from './types';

export interface BudgetProgress {
  target: Cents;
  committed: Cents;
  left: Cents;
  over: boolean;
  /** 0–100, para la barra. */
  percent: number;
}

/**
 * Comprometido en una plaza. Solo para quien PUEDE verlo (nunca su destinatario).
 * - `pot`: «Para la hucha» (a precio de lista) y «Ya comprado» con la hucha (a precio real).
 * - `own`: lo que cada uno paga por su cuenta («Me lo reservo», comprado individual y regalos a medias).
 */
export function committedOn(items: Item[], claims: Claim[], contributions: Contribution[]): { pot: Cents; own: Cents } {
  const byId = new Map(items.map((i) => [i.id, i]));
  let pot = 0;
  let own = 0;
  for (const c of claims) {
    const item = byId.get(c.item);
    if (!item) continue;
    if (c.kind === 'pot') pot += claimCost(c, item) * c.units;
    else own += claimCost(c, item) * c.units;
  }
  for (const c of contributions) if (byId.has(c.item)) own += Math.max(0, c.amountCents);
  return { pot, own };
}

/** La barra del presupuesto según el modo del grupo. En `individual` cuenta lo de cada uno; si no, la hucha. */
export function budgetProgress(target: Cents, items: Item[], claims: Claim[], contributions: Contribution[], mode: BuyMode = 'individual'): BudgetProgress {
  const c = committedOn(items, claims, contributions);
  const committed = mode === 'individual' ? c.own + c.pot : c.pot;
  return {
    target,
    committed,
    left: target - committed,
    over: committed > target,
    percent: target > 0 ? Math.min(100, Math.round((committed * 100) / target)) : 0,
  };
}
