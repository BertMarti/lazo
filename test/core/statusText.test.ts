import { describe, expect, it } from 'vitest';
import { itemStatus } from '../../src/core/status';
import type { BuyMode, Claim, Contribution, Item } from '../../src/core/types';
import { people, statusLine } from '../../src/ui/statusText';

const N: Record<string, string> = { samira: 'Samira', papa: 'Papá', jc: 'Javier', marta: 'Marta' };
const nameOf = (id: string) => N[id] ?? id;
const item = (o: Partial<Item> = {}): Item => ({ id: 'i', list: 'l', title: 'Robot', currency: 'EUR', priority: 1, quantity: 1, createdBy: 'marta', priceCents: 10000, ...o });
const claim = (user: string, status: Claim['status'] = 'reserved', kind: 'self' | 'pot' = 'self', o: Partial<Claim> = {}): Claim => ({ id: `c-${user}-${kind}`, item: 'i', user, kind, status, units: 1, ...o });
const pot = (user: string, amountCents: number): Contribution => ({ id: `p-${user}`, item: 'i', user, amountCents, paid: false });
const line = (it: Item, claims: Claim[], pots: Contribution[] = [], mode: BuyMode = 'individual') => statusLine(it, itemStatus(it, claims, pots), claims, pots, 'me', nameOf, mode);
const labels = (l: ReturnType<typeof line>) => l.actions.map((a) => a.label);

describe('people', () => {
  it('yo voy al final como «tú» y se abrevia a partir de 4', () => {
    expect(people(['samira'], 'me', nameOf)).toBe('Samira');
    expect(people(['me', 'samira'], 'me', nameOf)).toBe('Samira y tú');
    expect(people(['samira', 'papa', 'me'], 'me', nameOf)).toBe('Samira, Papá y tú');
    expect(people(['samira', 'papa', 'jc', 'me'], 'me', nameOf)).toBe('Samira, Papá y 2 más');
  });
});

describe('statusLine por modo', () => {
  it('libre: botones según el modo', () => {
    expect(labels(line(item(), [], [], 'individual'))).toEqual(['Me lo reservo']);
    expect(labels(line(item(), [], [], 'hucha'))).toEqual(['Para la hucha']);
    expect(labels(line(item(), [], [], 'mixto'))).toEqual(['Me lo reservo', 'Para la hucha']);
    expect(line(item({ quantity: 3 }), [claim('samira')], [], 'individual')).toMatchObject({ text: 'Quedan 2 de 3' });
  });
  it('lo mío', () => {
    expect(line(item(), [claim('me')])).toMatchObject({ text: 'Lo reservas tú', tone: 'mine' });
    expect(labels(line(item(), [claim('me')]))).toEqual(['Ya lo compré']);
    expect(line(item(), [claim('me', 'bought')])).toMatchObject({ text: 'Lo compraste tú', actions: [] });
  });
  it('de otros: sujeto y verbo', () => {
    expect(line(item(), [claim('samira')])).toMatchObject({ text: 'Lo reserva Samira', tone: 'taken', actions: [] });
    expect(line(item(), [claim('papa', 'bought', 'self', { paidBy: 'papa' })])).toMatchObject({ text: 'Lo compró Papá' });
  });
  it('hucha: apuntado y comprado', () => {
    const l = line(item(), [claim('samira', 'reserved', 'pot')], [], 'mixto');
    expect(l).toMatchObject({ text: 'Para la hucha · lo apuntó Samira', tone: 'open' });
    expect(labels(l)).toEqual(['Ya comprado']);
    expect(line(item(), [claim('samira', 'bought', 'pot', { paidBy: 'papa', paidCents: 9000 })], [], 'mixto')).toMatchObject({ text: 'Comprado con la hucha · adelantó Papá', tone: 'taken' });
    expect(line(item(), [claim('samira', 'bought', 'pot', { paidBy: 'me', paidCents: 9000 })], [], 'hucha')).toMatchObject({ text: 'Comprado con la hucha · lo adelantaste tú', tone: 'mine' });
  });
  it('a medias y cubierto', () => {
    expect(line(item(), [], [pot('samira', 6300)])).toMatchObject({ text: 'A medias · 63 % · ponen Samira', tone: 'open' });
    expect(line(item(), [], [pot('samira', 3000), pot('me', 3300)])).toMatchObject({ text: 'A medias · 63 % · ponéis Samira y tú', tone: 'mine' });
    expect(line(item(), [], [pot('samira', 5000), pot('papa', 5000)])).toMatchObject({ text: 'Cubierto · ponen Samira y Papá', tone: 'taken' });
  });
});
