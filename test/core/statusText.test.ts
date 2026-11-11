import { describe, expect, it } from 'vitest';
import { itemStatus } from '../../src/core/status';
import type { Claim, Contribution, Item } from '../../src/core/types';
import { people, statusLine } from '../../src/ui/statusText';

const N: Record<string, string> = { samira: 'Samira', papa: 'Papá', jc: 'Juan Carlos', mama: 'Mamá' };
const nameOf = (id: string) => N[id] ?? id;
const item = (o: Partial<Item> = {}): Item => ({ id: 'i', list: 'l', title: 'Robot', currency: 'EUR', priority: 1, quantity: 1, createdBy: 'mama', priceCents: 10000, ...o });
const claim = (user: string, status: Claim['status'] = 'reserved'): Claim => ({ id: `c-${user}`, item: 'i', user, status, units: 1 });
const pot = (user: string, amountCents: number): Contribution => ({ id: `p-${user}`, item: 'i', user, amountCents, paid: false });
const line = (it: Item, claims: Claim[], pots: Contribution[] = []) => statusLine(it, itemStatus(it, claims, pots), claims, pots, 'me', nameOf);

describe('people', () => {
  it('yo voy al final como «tú» y se abrevia a partir de 4', () => {
    expect(people(['samira'], 'me', nameOf)).toBe('Samira');
    expect(people(['me', 'samira'], 'me', nameOf)).toBe('Samira y tú');
    expect(people(['samira', 'papa', 'me'], 'me', nameOf)).toBe('Samira, Papá y tú');
    expect(people(['samira', 'papa', 'jc', 'me'], 'me', nameOf)).toBe('Samira, Papá y 2 más');
  });
});

describe('statusLine', () => {
  it('libre y con varias unidades', () => {
    expect(line(item(), [])).toMatchObject({ text: 'Libre', tone: 'open', action: 'reserve', actionLabel: 'Reservar' });
    expect(line(item({ quantity: 3 }), [claim('samira')])).toMatchObject({ text: 'Quedan 2 de 3', actionLabel: 'Reservar 1' });
  });
  it('mío: reservado y comprado', () => {
    expect(line(item(), [claim('me')])).toMatchObject({ text: 'Lo reservas tú', tone: 'mine', action: 'buy', actionLabel: 'Ya lo compré' });
    expect(line(item(), [claim('me', 'bought')])).toMatchObject({ text: 'Lo compraste tú', tone: 'mine' });
  });
  it('de otros: siempre sujeto y verbo', () => {
    expect(line(item(), [claim('samira')])).toMatchObject({ text: 'Lo reserva Samira', tone: 'taken' });
    expect(line(item(), [claim('papa', 'bought')])).toMatchObject({ text: 'Lo compró Papá', tone: 'taken' });
    expect(line(item({ quantity: 2 }), [claim('papa', 'bought'), claim('samira', 'bought')]).text).toBe('Lo compraron Papá y Samira');
  });
  it('a medias y cubierto, participe o no', () => {
    expect(line(item(), [], [pot('samira', 6300)])).toMatchObject({ text: 'A medias · 63 % · ponen Samira', tone: 'open', action: 'pot', actionLabel: 'Poner dinero' });
    expect(line(item(), [], [pot('samira', 3000), pot('me', 3300)])).toMatchObject({ text: 'A medias · 63 % · ponéis Samira y tú', tone: 'mine', action: 'mypart' });
    expect(line(item(), [], [pot('samira', 5000), pot('papa', 5000)])).toMatchObject({ text: 'Cubierto · ponen Samira y Papá', tone: 'taken' });
    expect(line(item(), [], [pot('me', 5000), pot('papa', 5000)])).toMatchObject({ text: 'Cubierto · ponéis Papá y tú', tone: 'mine', action: 'buy-pot' });
    expect(line(item({ priceCents: undefined }), [], [pot('samira', 500)]).text).toBe('A medias · ponen Samira');
  });
});
