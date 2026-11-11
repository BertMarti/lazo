import { byWeights, type Transfer } from './split';
import type { Cents, Id } from './types';

/** Una compra pagada con dinero de la hucha (alguien la adelanta). */
export interface PoolPurchase {
  /** Quién recibe el regalo (dueño de la plaza). undefined = plaza sin reclamar o lista de niño. */
  recipient?: Id;
  paidBy: Id;
  amount: Cents;
}

/** Un pago ya hecho entre personas para saldar («le di 30 € a Samira»). */
export interface PoolPayment {
  from: Id;
  to: Id;
  amount: Cents;
}

/**
 * Saldos de la hucha: cada compra se reparte a partes iguales entre los participantes MENOS su
 * destinatario (nadie paga sus propios regalos). Así el saldo de X solo depende de compras para
 * otros, que X ya puede ver: no hay forma de deducir lo gastado en X a partir de su saldo.
 * Positivo = le deben; negativo = debe. Suma siempre 0.
 */
export function poolBalances(participants: Id[], purchases: PoolPurchase[], payments: PoolPayment[] = []): Record<Id, Cents> {
  const out: Record<Id, Cents> = Object.fromEntries(participants.map((p) => [p, 0]));
  for (const p of purchases) {
    const payers = participants.filter((id) => id !== p.recipient);
    if (payers.length === 0 || p.amount <= 0) continue;
    out[p.paidBy] = (out[p.paidBy] ?? 0) + p.amount;
    for (const [id, share] of Object.entries(byWeights(p.amount, Object.fromEntries(payers.map((x) => [x, 1]))))) out[id] = (out[id] ?? 0) - share;
  }
  for (const pay of payments) {
    out[pay.from] = (out[pay.from] ?? 0) + pay.amount;
    out[pay.to] = (out[pay.to] ?? 0) - pay.amount;
  }
  return out;
}

/** Transferencias mínimas para quedar a cero (de Repartito): el que más debe paga al que más le deben. Deterministas. */
export function minTransfers(bal: Record<Id, Cents>): Transfer[] {
  const creditors = Object.entries(bal).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(bal).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const order = (a: { id: Id; v: number }, b: { id: Id; v: number }) => b.v - a.v || (a.id < b.id ? -1 : 1);
  const out: Transfer[] = [];
  creditors.sort(order);
  debtors.sort(order);
  while (creditors.length && debtors.length) {
    const c = creditors[0]!;
    const d = debtors[0]!;
    const amount = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
    creditors.sort(order);
    debtors.sort(order);
  }
  return out;
}
