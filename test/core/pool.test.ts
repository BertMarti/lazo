import { describe, expect, it } from 'vitest';
import { minTransfers, poolBalances, type PoolPurchase } from '../../src/core/pool';

const fam = ['alberto', 'juancarlos', 'samira', 'mama', 'papa'];
const sum = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0);

describe('hucha común', () => {
  it('nadie paga sus propios regalos y los saldos suman 0', () => {
    // Samira adelanta 100 € para Mamá: lo pagan Alberto, Juan Carlos, Samira y Papá (25 € cada uno).
    const b = poolBalances(fam, [{ recipient: 'mama', paidBy: 'samira', amount: 10000 }]);
    expect(b).toEqual({ alberto: -2500, juancarlos: -2500, samira: 7500, mama: 0, papa: -2500 });
    expect(sum(b)).toBe(0);
  });

  it('el saldo de X no cambia con lo que se compra para X (no se puede deducir)', () => {
    const others: PoolPurchase[] = [
      { recipient: 'papa', paidBy: 'alberto', amount: 8000 },
      { recipient: 'samira', paidBy: 'juancarlos', amount: 4499 },
    ];
    for (const x of fam) {
      const sin = poolBalances(fam, others.filter((p) => p.recipient !== x))[x];
      const con = poolBalances(fam, [...others.filter((p) => p.recipient !== x), { recipient: x, paidBy: fam.find((f) => f !== x)!, amount: 33333 }])[x];
      expect(con, x).toBe(sin);
    }
  });

  it('pagos ya hechos y transferencias mínimas que cuadran', () => {
    const b = poolBalances(
      fam,
      [
        { recipient: 'mama', paidBy: 'samira', amount: 10000 },
        { recipient: 'papa', paidBy: 'alberto', amount: 6000 },
      ],
      [{ from: 'juancarlos', to: 'samira', amount: 2500 }],
    );
    expect(sum(b)).toBe(0);
    const t = minTransfers(b);
    expect(t.length).toBeLessThanOrEqual(fam.length - 1);
    const after = { ...b };
    for (const x of t) {
      after[x.from]! += x.amount;
      after[x.to]! -= x.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it('plaza sin reclamar: lo pagan todos', () => {
    expect(poolBalances(['a', 'b'], [{ paidBy: 'a', amount: 1001 }])).toEqual({ a: 500, b: -500 });
  });
});
