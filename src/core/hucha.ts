import { equalShares } from './split';
import type { Cents, Claim, GiftList, Id, Item, Payment } from './types';

/**
 * Hucha común (spec 2026-11-11-plazas-hucha §6). Funciones PURAS sobre las filas que el servidor ha
 * entregado a quien mira: nunca recibe filas de su propia plaza, y aun así aquí se excluye explícitamente.
 *
 * Reglas:
 * - Nadie paga sus propios regalos: el gasto de hucha en la plaza r lo pagan los miembros menos su ocupante.
 * - La hucha la lleva un tesorero (T); las cuentas de los regalos de T las lleva un suplente (T2).
 * - Cada persona salda solo con T (y, por los regalos de T, con T2). Nada global: así nadie deduce lo suyo.
 */
export interface HuchaCtx {
  me: Id;
  members: Id[];
  lists: GiftList[];
  items: Item[];
  claims: Claim[];
  payments: Payment[];
  /** Usuarios que llevan la hucha y las cuentas de sus regalos, y la plaza del tesorero. */
  treasurer?: Id;
  deputy?: Id;
  treasurerList?: Id;
}

export interface Ledger {
  spent: Cents;
  quota: Record<Id, Cents>;
  adv: Record<Id, Cents>;
  sharers: Id[];
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Cuenta de la plaza r: lo comprado con la hucha, quién lo adelantó y la parte de cada pagador. */
export function ledger(r: GiftList, ctx: Pick<HuchaCtx, 'members' | 'items' | 'claims'>): Ledger {
  const itemIds = new Set(ctx.items.filter((i) => i.list === r.id).map((i) => i.id));
  const sharers = ctx.members.filter((m) => m !== r.user);
  const rows = ctx.claims.filter((c) => c.kind === 'pot' && c.status === 'bought' && itemIds.has(c.item));
  const spent = sum(rows.map((c) => c.paidCents ?? 0));
  const quota = sharers.length ? equalShares(spent, sharers) : {};
  const adv: Record<Id, Cents> = {};
  for (const c of rows) if (c.paidBy) adv[c.paidBy] = (adv[c.paidBy] ?? 0) + (c.paidCents ?? 0);
  return { spent, quota, adv, sharers };
}

export const lambda = (j: Id, r: GiftList, ctx: HuchaCtx): Cents => {
  const L = ledger(r, ctx);
  return (L.adv[j] ?? 0) - (L.quota[j] ?? 0);
};

const paid = (ps: Payment[], from: Id | undefined, to: Id | undefined, sub: boolean) =>
  sum(ps.filter((p) => p.from === from && p.to === to && p.sub === sub).map((p) => p.amountCents));

/** Lo que j tiene pendiente (positivo = le falta poner; negativo = hay que devolverle), con T y con T2. */
export function due(j: Id, ctx: HuchaCtx): { general: Cents; aparte: Cents } {
  const mainLists = ctx.lists.filter((r) => r.user !== j && r.id !== ctx.treasurerList);
  const general =
    j === ctx.treasurer
      ? 0
      : -sum(mainLists.map((r) => lambda(j, r, ctx))) - paid(ctx.payments, j, ctx.treasurer, false) + paid(ctx.payments, ctx.treasurer, j, false);
  const tl = ctx.treasurerList ? ctx.lists.find((l) => l.id === ctx.treasurerList) : undefined;
  const aparte =
    tl && j !== ctx.treasurer && j !== ctx.deputy
      ? -lambda(j, tl, ctx) - paid(ctx.payments, j, ctx.deputy, true) + paid(ctx.payments, ctx.deputy, j, true)
      : 0;
  return { general, aparte };
}

/** «Tu parte, persona a persona»: todas las plazas menos la mía. */
export function myShares(ctx: HuchaCtx) {
  return ctx.lists
    .filter((r) => r.user !== ctx.me)
    .map((r) => {
      const L = ledger(r, ctx);
      return { list: r, spent: L.spent, count: L.sharers.length, mine: L.quota[ctx.me] ?? 0, advanced: L.adv[ctx.me] ?? 0 };
    })
    .filter((x) => x.spent > 0);
}

/** Previsión: lo apuntado para la hucha y aún sin comprar, a precio de lista, en mi parte. */
export function forecast(ctx: HuchaCtx): Cents {
  let total = 0;
  for (const r of ctx.lists.filter((l) => l.user !== ctx.me)) {
    const items = ctx.items.filter((i) => i.list === r.id);
    const ids = new Map(items.map((i) => [i.id, i]));
    const pending = sum(ctx.claims.filter((c) => c.kind === 'pot' && c.status === 'reserved' && ids.has(c.item)).map((c) => ids.get(c.item)!.priceCents ?? 0));
    const sharers = ctx.members.filter((m) => m !== r.user);
    if (pending && sharers.includes(ctx.me)) total += equalShares(pending, sharers)[ctx.me] ?? 0;
  }
  return total;
}

/** Tabla de cobro: solo para quien lleva esa caja (T: cuenta general; T2: regalos de T). */
export function collectTable(ctx: HuchaCtx): { who: Id; due: Cents }[] {
  if (ctx.me === ctx.treasurer) return ctx.members.filter((j) => j !== ctx.me).map((j) => ({ who: j, due: due(j, ctx).general }));
  if (ctx.me === ctx.deputy) return ctx.members.filter((j) => j !== ctx.me && j !== ctx.treasurer).map((j) => ({ who: j, due: due(j, ctx).aparte }));
  return [];
}
