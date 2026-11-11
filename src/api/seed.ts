import type { Budget, Claim, Contribution, Draw, GiftList, Group, Item, Membership, User } from '../core/types';

/** Datos ficticios de la demo: una familia de cinco. Productos, tiendas y precios inventados. */
export interface DemoData {
  users: User[];
  groups: Group[];
  memberships: Membership[];
  lists: GiftList[];
  items: Item[];
  claims: Claim[];
  contributions: Contribution[];
  budgets: Budget[];
  draws: Draw[];
  assignments: { draw: string; giver: string; receiver: string }[];
}

const u = (id: string, name: string, color: string): User => ({ id, name, color });

export const FAMILY = ['alberto', 'juancarlos', 'samira', 'mama', 'papa'] as const;

export function seed(): DemoData {
  const users = [
    u('alberto', 'Alberto', 'cielo'),
    u('juancarlos', 'Juan Carlos', 'menta'),
    u('samira', 'Samira', 'fresa'),
    u('mama', 'Mamá', 'violeta'),
    u('papa', 'Papá', 'canela'),
  ];
  const groups: Group[] = [
    { id: 'navidad', name: 'Navidad en familia', occasion: 'navidad', date: '2026-12-24', currency: 'EUR', owner: 'alberto' },
    { id: 'cumple-mama', name: 'Cumpleaños de Mamá', occasion: 'cumpleanos', date: '2027-03-14', currency: 'EUR', owner: 'samira' },
  ];
  const memberships: Membership[] = [
    ...users.map((x) => ({ id: `m-n-${x.id}`, group: 'navidad', user: x.id, role: x.id === 'alberto' ? ('admin' as const) : ('member' as const) })),
    ...users.map((x) => ({ id: `m-c-${x.id}`, group: 'cumple-mama', user: x.id, role: x.id === 'samira' ? ('admin' as const) : ('member' as const) })),
  ];
  const lists: GiftList[] = [
    ...users.map((x) => ({ id: `l-${x.id}`, group: 'navidad', name: x.name, user: x.id, managers: [] })),
    { id: 'l-mama-cumple', group: 'cumple-mama', name: 'Mamá', user: 'mama', managers: [] },
  ];
  let n = 0;
  const it = (list: string, title: string, o: Partial<Item> = {}): Item => ({
    id: `i${++n}`, list, title, currency: 'EUR', priority: 2, quantity: 1, createdBy: list.replace(/^l-|-cumple$/g, ''), ...o,
  });
  const items: Item[] = [
    // Mamá
    it('l-mama', 'Marco digital de fotos', { priceCents: 12900, store: 'Amazon', url: 'https://www.amazon.es/s?k=marco+digital+fotos', priority: 1, notes: 'Para ver las fotos de los nietos.' }), // i1
    it('l-mama', 'Chal de lana merino', { priceCents: 4900, store: 'Lanas Norte', color: 'Burdeos', priority: 2 }), // i2
    it('l-mama', 'Robot de cocina', { priceCents: 34900, store: 'Hogar Plaza', priority: 1, notes: 'El que tiene báscula.' }), // i3
    it('l-mama', 'Novela «La casa de los veranos»', { priceCents: 2190, store: 'Librería del Puerto', priority: 3 }), // i4
    // Papá
    it('l-papa', 'Cafetera italiana de 6 tazas', { priceCents: 3495, store: 'Amazon', url: 'https://www.amazon.es/s?k=cafetera+italiana+6+tazas', priority: 1 }), // i5
    it('l-papa', 'Guantes de piel para conducir', { priceCents: 3900, store: 'Marroquinería Sol', size: 'L', priority: 2 }), // i6
    it('l-papa', 'Entradas para el fútbol', { priceCents: 9000, store: 'Taquilla', quantity: 2, priority: 1 }), // i7
    // Alberto
    it('l-alberto', 'Auriculares inalámbricos con cancelación de ruido', { priceCents: 8999, store: 'Amazon', url: 'https://www.amazon.es/s?k=auriculares+cancelacion+ruido', priority: 1, color: 'Negro' }), // i8
    it('l-alberto', 'Teclado mecánico compacto', { priceCents: 7900, store: 'Amazon', url: 'https://www.amazon.es/s?k=teclado+mecanico+compacto', priority: 2 }), // i9
    it('l-alberto', 'Sudadera de algodón orgánico', { priceCents: 4500, store: 'Textil Robles', size: 'M', color: 'Gris', priority: 3 }), // i10
    // Juan Carlos
    it('l-juancarlos', 'Juego de mesa cooperativo', { priceCents: 4495, store: 'Amazon', url: 'https://www.amazon.es/s?k=juego+de+mesa+cooperativo', priority: 1 }), // i11
    it('l-juancarlos', 'Cuchillo de chef', { priceCents: 7900, store: 'Cuchillería Toledo', priority: 2 }), // i12
    it('l-juancarlos', 'Mochila de senderismo 30 L', { priceCents: 6900, store: 'Montaña Shop', priority: 2 }), // i13
    // Samira
    it('l-samira', 'Lámpara de lectura de pinza', { priceCents: 3990, store: 'Casa Clara', priority: 1 }), // i14
    it('l-samira', 'Monstera mediana', { priceCents: 2800, store: 'Vivero San Juan', priority: 2 }), // i15
    it('l-samira', 'Taller de cerámica para dos', { priceCents: 6500, store: 'Barro y Fuego', priority: 1 }), // i16
    it('l-samira', 'Pijama de franela', { priceCents: 3500, store: 'Textil Robles', size: 'S', color: 'Verde', priority: 3 }), // i17
    // Cumpleaños de Mamá
    it('l-mama-cumple', 'Escapada a Lisboa con sus hermanas', { priceCents: 60000, store: 'Agencia Brisa', priority: 1 }), // i18
    it('l-mama-cumple', 'Álbum de fotos de familia', { priceCents: 3900, store: 'Papelería Olga', priority: 2 }), // i19
  ];
  const claims: Claim[] = [
    { id: 'c1', item: 'i1', user: 'alberto', status: 'reserved', units: 1 }, // marco de Mamá: Mamá no lo ve
    { id: 'c2', item: 'i2', user: 'samira', status: 'bought', units: 1 },
    { id: 'c3', item: 'i5', user: 'juancarlos', status: 'bought', units: 1 },
    { id: 'c4', item: 'i7', user: 'alberto', status: 'reserved', units: 1 },
    { id: 'c5', item: 'i8', user: 'samira', status: 'bought', units: 1 }, // auriculares de Alberto: Alberto no lo ve
    { id: 'c6', item: 'i14', user: 'mama', status: 'reserved', units: 1 },
    { id: 'c7', item: 'i11', user: 'papa', status: 'reserved', units: 1 },
  ];
  const contributions: Contribution[] = [
    { id: 'p1', item: 'i3', user: 'juancarlos', amountCents: 10000, paid: false }, // robot de cocina a medias
    { id: 'p2', item: 'i3', user: 'papa', amountCents: 15000, paid: true },
    { id: 'p3', item: 'i18', user: 'alberto', amountCents: 15000, paid: false },
    { id: 'p4', item: 'i18', user: 'samira', amountCents: 15000, paid: false },
  ];
  const budgets: Budget[] = [
    { id: 'b1', list: 'l-mama', amountCents: 40000 },
    { id: 'b2', list: 'l-papa', amountCents: 20000 },
    { id: 'b3', list: 'l-alberto', amountCents: 15000 },
    { id: 'b4', list: 'l-juancarlos', amountCents: 15000 },
    { id: 'b5', list: 'l-samira', amountCents: 15000 },
    { id: 'b6', list: 'l-mama-cumple', amountCents: 50000 },
  ];
  const draws: Draw[] = [
    { id: 'd1', group: 'navidad', budgetCents: 3000, exclusions: [['mama', 'papa']], participants: users.map((x) => x.id), createdBy: 'alberto' },
  ];
  const assignments = [
    { draw: 'd1', giver: 'alberto', receiver: 'samira' },
    { draw: 'd1', giver: 'samira', receiver: 'papa' },
    { draw: 'd1', giver: 'papa', receiver: 'juancarlos' },
    { draw: 'd1', giver: 'juancarlos', receiver: 'mama' },
    { draw: 'd1', giver: 'mama', receiver: 'alberto' },
  ];
  return { users, groups, memberships, lists, items, claims, contributions, budgets, draws, assignments };
}

/** Fichas preparadas para enlaces de ejemplo: la demo no tiene servidor que descargue páginas. */
export const DEMO_UNFURL: { match: RegExp; meta: { title: string; priceCents?: number; store: string } }[] = [
  { match: /amazon\./i, meta: { title: 'Altavoz inteligente compacto', priceCents: 5499, store: 'Amazon' } },
  { match: /./, meta: { title: 'Producto de ejemplo', priceCents: 2500, store: 'Tienda de ejemplo' } },
];
