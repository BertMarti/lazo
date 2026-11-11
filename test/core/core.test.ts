import { describe, expect, it } from 'vitest';
import { parseAmount, formatMoney } from '../../src/core/money';
import { canSeeStatus, canEditList } from '../../src/core/visibility';
import { byWeights, equalShares, settle } from '../../src/core/split';
import { itemStatus } from '../../src/core/status';
import { drawPairs, DrawImpossible } from '../../src/core/draw';
import type { Claim, Contribution, Item } from '../../src/core/types';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1', list: 'l1', title: 'Bici', currency: 'EUR', priority: 1, quantity: 1, createdBy: 'ana', ...over,
});
const claim = (over: Partial<Claim> = {}): Claim => ({ id: 'c', item: 'i1', user: 'pablo', status: 'reserved', units: 1, ...over });
const contrib = (user: string, amountCents: number, paid = false): Contribution => ({
  id: user, item: 'i1', user, amountCents, paid,
});

/** Generador determinista para los tests (mulberry32). */
const seeded = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('dinero', () => {
  it.each([
    ['12,5', 1250], ['12.50', 1250], ['1.234,56', 123456], ['1,234.56', 123456], ['€ 7', 700], ['19,99 €', 1999], ['1.000', 100000],
  ])('%s → %i', (input, cents) => expect(parseAmount(input)).toBe(cents));
  it('acepta números de Excel', () => expect(parseAmount(19.99)).toBe(1999));
  it.each(['', 'abc', '0', '-5', '12..5', '12.3456'])('rechaza «%s»', (input) => expect(parseAmount(input)).toBeNull());
  it('formatea en español; sin «,00» si es redondo salvo en modo exacto', () => {
    expect(formatMoney(123456)).toBe('1234,56 €');
    expect(formatMoney(34900)).toBe('349 €');
    expect(formatMoney(34900, 'EUR', true)).toBe('349,00 €');
  });
});

describe('sorpresa', () => {
  it('el dueño no ve el estado de su lista; los demás sí', () => {
    expect(canSeeStatus('ana', { user: 'ana' })).toBe(false);
    expect(canSeeStatus('pablo', { user: 'ana' })).toBe(true);
  });
  it('la lista de un niño la ven todos, padres incluidos', () => {
    expect(canSeeStatus('ana', { user: undefined })).toBe(true);
  });
  it('editan el dueño y quien gestiona la lista', () => {
    expect(canEditList('ana', { user: undefined, managers: ['ana'] })).toBe(true);
    expect(canEditList('pablo', { user: 'ana', managers: [] })).toBe(false);
  });
});

describe('reparto', () => {
  it('cuadra al céntimo y es determinista', () => {
    expect(byWeights(1000, { c: 1, a: 1, b: 1 })).toEqual({ a: 334, b: 333, c: 333 });
    const r = equalShares(9999, ['x', 'y', 'z', 'w', 'x']);
    expect(Object.values(r).reduce((s, v) => s + v, 0)).toBe(9999);
    expect(Object.keys(r)).toHaveLength(4);
  });
  it('quien compra cobra lo pendiente de los demás', () => {
    expect(settle('ana', [contrib('ana', 3000), contrib('pablo', 3000), contrib('lucia', 2000, true)])).toEqual([
      { from: 'pablo', to: 'ana', amount: 3000 },
    ]);
  });
});

describe('estado de un regalo', () => {
  it('libre, reservado y comprado', () => {
    expect(itemStatus(item(), [], []).kind).toBe('free');
    expect(itemStatus(item(), [claim()], []).kind).toBe('reserved');
    expect(itemStatus(item(), [claim({ status: 'bought' })], []).kind).toBe('bought');
  });
  it('con cantidad 2 y una reserva sigue libre una unidad', () => {
    const s = itemStatus(item({ quantity: 2 }), [claim()], []);
    expect(s).toMatchObject({ kind: 'free', unitsLeft: 1 });
  });
  it('a medias: porcentaje, cubierto y sin precio', () => {
    expect(itemStatus(item({ priceCents: 10000 }), [], [contrib('a', 6000)])).toMatchObject({ kind: 'partial', percent: 60 });
    expect(itemStatus(item({ priceCents: 10000 }), [], [contrib('a', 7000), contrib('b', 7000)])).toMatchObject({
      kind: 'covered', percent: 100,
    });
    const s = itemStatus(item(), [], [contrib('a', 500)]);
    expect(s.kind).toBe('partial');
    expect(s.percent).toBeUndefined();
  });
  it('ignora reservas de otros regalos', () => {
    expect(itemStatus(item(), [claim({ item: 'otro' })], []).kind).toBe('free');
  });
});

describe('amigo invisible', () => {
  const family = ['ana', 'pablo', 'lucia', 'jorge', 'vera', 'abuela'];
  const couples: [string, string][] = [['ana', 'pablo'], ['lucia', 'jorge']];
  it('nadie se regala a sí mismo y se respetan las exclusiones (200 semillas)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = drawPairs(family, couples, seeded(seed));
      expect(m.size).toBe(family.length);
      expect(new Set(m.values()).size).toBe(family.length);
      for (const [g, r] of m) {
        expect(g).not.toBe(r);
        expect(couples.some(([a, b]) => (a === g && b === r) || (a === r && b === g))).toBe(false);
      }
    }
  });
  it('falla con explicación si no hay solución', () => {
    expect(() => drawPairs(['a', 'b'], [], seeded(1))).toThrow(DrawImpossible);
    expect(() => drawPairs(['a', 'b', 'c'], [['a', 'b'], ['a', 'c']], seeded(1))).toThrow(/no puede regalar/);
    // Hay salida para cada uno por separado, pero no en conjunto: b y c solo pueden regalar a a.
    expect(() => drawPairs(['a', 'b', 'c', 'd'], [['b', 'c'], ['b', 'd'], ['c', 'd']], seeded(3))).toThrow(DrawImpossible);
  });
});

import { budgetProgress, committedOn } from '../../src/core/budget';
describe('presupuesto', () => {
  const items = [item({ id: 'a', priceCents: 3000, quantity: 2 }), item({ id: 'b', priceCents: 10000 }), item({ id: 'c' })];
  it('suma unidades reservadas por precio y, si va a medias, las aportaciones', () => {
    const claims = [claim({ item: 'a' }), claim({ item: 'a', user: 'x' }), claim({ item: 'c' })];
    const pot = [{ ...contrib('p', 2500), item: 'b' }];
    expect(committedOn(items, claims, pot)).toEqual({ pot: 0, own: 6000 + 2500 });
  });
  it('restante, exceso y barra', () => {
    expect(budgetProgress(5000, items, [claim({ item: 'b' })], [])).toMatchObject({ committed: 10000, left: -5000, over: true, percent: 100 });
    expect(budgetProgress(0, items, [], [])).toMatchObject({ percent: 0, over: false });
  });
});

import { normName, parsePlazas } from '../../src/core/plazas';
describe('plazas (U-10)', () => {
  it('normaliza, quita repetidos, vacíos y al creador; máximo 40', () => {
    expect(normName('  Mamá  Rosa ')).toBe('mama rosa');
    expect(parsePlazas('Mamá\nmama\n\nPapá, Samira\nAlberto', 'alberto')).toEqual(['Mamá', 'Papá', 'Samira']);
    expect(parsePlazas(Array.from({ length: 60 }, (_, i) => `P${i}`))).toHaveLength(40);
  });
  it('estado «para la hucha» y comprado con la hucha (U-1)', () => {
    const it2 = item({ quantity: 2, priceCents: 1000 });
    expect(itemStatus(it2, [claim({ kind: 'pot' }), claim({ id: 'd', kind: 'self' })], []).kind).toBe('pot');
    expect(itemStatus(item(), [claim({ kind: 'pot', status: 'bought' })], [])).toMatchObject({ kind: 'bought', fromPot: true });
  });
});
