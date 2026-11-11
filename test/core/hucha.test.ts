import { describe, expect, it } from 'vitest';
import { collectTable, due, forecast, ledger, myShares, type HuchaCtx } from '../../src/core/hucha';
import type { Claim, GiftList, Item, Payment } from '../../src/core/types';

// Familia de las pruebas: alberto (tesorero), samira (suplente), juancarlos, mama, papa.
const FAM = ['alberto', 'juancarlos', 'samira', 'mama', 'papa'];
const L = (u: string): GiftList => ({ id: `l-${u}`, group: 'g', name: u, kind: 'person', user: u, managers: [] });
const lists = FAM.map(L);
const item = (id: string, owner: string, priceCents = 1000): Item => ({ id, list: `l-${owner}`, title: id, currency: 'EUR', priority: 2, quantity: 1, createdBy: owner, priceCents });
let n = 0;
const bought = (it: string, paidBy: string, paidCents: number): Claim => ({ id: `c${++n}`, item: it, user: paidBy, kind: 'pot', status: 'bought', units: 1, paidBy, paidCents });
const reservedPot = (it: string, user: string): Claim => ({ id: `c${++n}`, item: it, user, kind: 'pot', status: 'reserved', units: 1 });
const pay = (from: string, to: string, amountCents: number, sub = false): Payment => ({ id: `p${++n}`, group: 'g', from, to, amountCents, sub });

const ctxFor = (me: string, claims: Claim[], items: Item[], payments: Payment[] = []): HuchaCtx => ({
  me, members: FAM, lists, items, claims, payments, treasurer: 'alberto', deputy: 'samira', treasurerList: 'l-alberto',
});

/** Lo que el servidor le entrega a X: nada de su plaza, y solo los pagos en los que es parte. */
const asSeenBy = (x: string, claims: Claim[], items: Item[], payments: Payment[]) => {
  const own = new Set(items.filter((i) => i.list === `l-${x}`).map((i) => i.id));
  return ctxFor(x, claims.filter((c) => !own.has(c.item)), items, payments.filter((p) => p.from === x || p.to === x));
};

describe('hucha · reparto', () => {
  it('U-4: las cuotas suman el gasto al céntimo y no dependen del orden', () => {
    for (const amount of [1, 99, 100, 10_001])
      for (let k = 2; k <= 5; k++) {
        const members = FAM.slice(0, k);
        const items = [item('i', 'mama')];
        const c1 = { members, items, claims: [bought('i', members[0]!, amount)] };
        const Lg = ledger({ ...L('mama') }, c1);
        expect(Object.values(Lg.quota).reduce((s, v) => s + v, 0)).toBe(Lg.sharers.length ? amount : 0);
        expect(ledger(L('mama'), { ...c1, members: [...members].reverse() }).quota).toEqual(Lg.quota);
      }
  });

  it('U-7: plaza libre y lista de niño: pagan todos; al ocuparse, su ocupante no paga la suya', () => {
    const free: GiftList = { id: 'l-libre', group: 'g', name: 'Tía', kind: 'person', managers: [] };
    const items = [{ ...item('t', 'x'), list: 'l-libre' }];
    expect(ledger(free, { members: FAM, items, claims: [bought('t', 'papa', 500)] }).sharers).toHaveLength(5);
    expect(ledger({ ...free, user: 'mama' }, { members: FAM, items, claims: [bought('t', 'papa', 500)] }).sharers).not.toContain('mama');
  });
});

describe('hucha · no interferencia (∀X)', () => {
  const items = [item('m1', 'mama'), item('p1', 'papa'), item('s1', 'samira'), item('a1', 'alberto'), item('j1', 'juancarlos'), item('m2', 'mama')];
  const base = [bought('m1', 'samira', 12490), bought('p1', 'juancarlos', 9000), bought('a1', 'papa', 4000), reservedPot('m2', 'papa')];
  const payments = [pay('papa', 'alberto', 2000), pay('mama', 'samira', 1000, true)];

  it.each(FAM)('U-5: lo que ve %s no cambia con lo que pasa en su plaza', (x) => {
    const own = items.filter((i) => i.list === `l-${x}`);
    const extra = own.length ? [bought(own[0]!.id, FAM.find((f) => f !== x)!, 33333)] : [];
    const a = asSeenBy(x, base, items, payments);
    const b = asSeenBy(x, [...base, ...extra], items, payments);
    expect(myShares(b)).toEqual(myShares(a));
    expect(due(x, b)).toEqual(due(x, a));
    expect(forecast(b)).toEqual(forecast(a));
    // Aunque por error se le pasaran filas de su plaza, sus cifras no las usan.
    const leaked = ctxFor(x, [...base, ...extra], items, payments.filter((p) => p.from === x || p.to === x));
    expect(due(x, leaked)).toEqual(due(x, a));
    expect(myShares(leaked).some((s) => s.list.user === x)).toBe(false);
  });

  it('U-8: la tabla del tesorero no depende de sus regalos; la del suplente, solo de ellos; el resto, vacía', () => {
    const extraT = [bought('a1', 'mama', 50000)];
    const t1 = collectTable(ctxFor('alberto', base, items, payments));
    const t2 = collectTable(ctxFor('alberto', [...base.filter((c) => c.item !== 'a1'), ...extraT], items, payments));
    expect(t2).toEqual(t1);
    const d1 = collectTable(ctxFor('samira', base, items, payments));
    const d2 = collectTable(ctxFor('samira', [...base, bought('p1', 'mama', 1)], items, payments));
    expect(d2).toEqual(d1);
    expect(d1.map((r) => r.who)).not.toContain('alberto');
    expect(collectTable(ctxFor('papa', base, items, payments))).toEqual([]);
  });

  it('U-6: aplicando los pagos sugeridos, todos quedan a cero', () => {
    const ps: Payment[] = [];
    for (const j of FAM) {
      const d = due(j, ctxFor(j, base, items, ps));
      if (d.general > 0) ps.push(pay(j, 'alberto', d.general));
      if (d.general < 0) ps.push(pay('alberto', j, -d.general));
      if (d.aparte > 0) ps.push(pay(j, 'samira', d.aparte, true));
      if (d.aparte < 0) ps.push(pay('samira', j, -d.aparte, true));
    }
    for (const j of FAM) expect(due(j, ctxFor(j, base, items, ps)), j).toEqual({ general: 0, aparte: 0 });
  });

  it('U-9: el contraejemplo del greedy global no aplica: A ve lo mismo con y sin el regalo oculto', () => {
    const fam = ['a', 'b', 'c', 'd'];
    const ls = fam.map((u) => ({ id: `l-${u}`, group: 'g', name: u, kind: 'person' as const, user: u, managers: [] }));
    const its = [{ ...item('gb', 'x'), list: 'l-b' }, { ...item('ga', 'x'), list: 'l-a' }];
    const visible = [bought('gb', 'c', 9000)];
    const ctx = (claims: Claim[]): HuchaCtx => ({ me: 'a', members: fam, lists: ls, items: its, claims, payments: [], treasurer: 'c', deputy: 'd', treasurerList: 'l-c' });
    const sinOculto = due('a', ctx(visible));
    const conOculto = due('a', ctx([...visible, bought('ga', 'd', 12000)]));
    expect(conOculto).toEqual(sinOculto);
    expect(sinOculto.general).toBe(3000);
  });
});
