import type { Cents, Contribution, Id } from './types';

/**
 * Reparte `amount` según los pesos con el método del mayor resto (de Repartito): el total cuadra
 * siempre al céntimo y los céntimos sobrantes van a quien más se acercaba, desempatando por id.
 */
export function byWeights(amount: Cents, weights: Record<Id, number>): Record<Id, Cents> {
  const ids = Object.keys(weights).filter((id) => weights[id]! > 0).sort();
  const total = ids.reduce((s, id) => s + weights[id]!, 0);
  if (total <= 0) return {};
  const out: Record<Id, Cents> = {};
  const rest: { id: Id; frac: number }[] = [];
  let assigned = 0;
  for (const id of ids) {
    const exact = (amount * weights[id]!) / total;
    out[id] = Math.floor(exact);
    assigned += out[id]!;
    rest.push({ id, frac: exact - out[id]! });
  }
  rest.sort((a, b) => b.frac - a.frac || (a.id < b.id ? -1 : 1));
  for (let i = 0; i < amount - assigned; i++) out[rest[i % rest.length]!.id]! += 1;
  return out;
}

export const equalShares = (amount: Cents, ids: Id[]): Record<Id, Cents> =>
  byWeights(amount, Object.fromEntries([...new Set(ids)].map((id) => [id, 1])));

export interface Transfer {
  from: Id;
  to: Id;
  amount: Cents;
}

/** Quien compró el regalo adelantó el dinero: el resto le debe lo que aportó y aún no ha pagado. */
export const settle = (buyer: Id, contributions: Contribution[]): Transfer[] =>
  contributions
    .filter((c) => c.user !== buyer && !c.paid && c.amountCents > 0)
    .map((c) => ({ from: c.user, to: buyer, amount: c.amountCents }));
