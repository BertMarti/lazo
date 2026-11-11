import type { Budget, Claim, Contribution, Draw, GiftList, Group, Item, JoinRequest, Membership, Payment, User } from '../core/types';

/**
 * Datos ficticios de la demo. Los nombres son solo un ejemplo: en la app, cada grupo tiene las plazas que
 * su creador ponga y quien entra elige la suya. Productos, tiendas y precios inventados.
 */
export interface DemoData {
  users: User[];
  groups: Group[];
  memberships: Membership[];
  lists: GiftList[];
  items: Item[];
  claims: Claim[];
  contributions: Contribution[];
  budgets: Budget[];
  payments: Payment[];
  invites: { token: string; group: string; list?: string; uses: number; maxUses: number; createdBy: string }[];
  requests: JoinRequest[];
  draws: Draw[];
  assignments: { draw: string; giver: string; receiver: string }[];
}

const u = (id: string, name: string, color: string): User => ({ id, name, color });

export const FAMILY = ['alberto', 'juancarlos', 'samira', 'mama', 'papa'] as const;
export const DEMO_GENERAL_TOKEN = 'demoGeneralNavidad2026xx';

export function seed(): DemoData {
  const users = [
    u('alberto', 'Alberto', 'cielo'),
    u('juancarlos', 'Juan Carlos', 'menta'),
    u('samira', 'Samira', 'fresa'),
    u('mama', 'Mamá', 'violeta'),
    u('papa', 'Papá', 'canela'),
  ];
  const groups: Group[] = [
    { id: 'navidad', name: 'Navidad en familia', occasion: 'navidad', date: '2026-12-24', currency: 'EUR', owner: 'alberto', buyMode: 'mixto', allowNewNames: true, treasurer: 'l-alberto', deputy: 'l-samira' },
    { id: 'cumple-mama', name: 'Cumpleaños de Mamá', occasion: 'cumpleanos', date: '2027-03-14', currency: 'EUR', owner: 'samira', buyMode: 'hucha' },
  ];
  const memberships: Membership[] = [
    ...users.map((x) => ({ id: `m-n-${x.id}`, group: 'navidad', user: x.id, role: x.id === 'alberto' ? ('admin' as const) : ('member' as const) })),
    ...users.map((x) => ({ id: `m-c-${x.id}`, group: 'cumple-mama', user: x.id, role: x.id === 'samira' ? ('admin' as const) : ('member' as const) })),
  ];
  const lists: GiftList[] = [
    ...users.map((x) => ({ id: `l-${x.id}`, group: 'navidad', name: x.name, kind: 'person' as const, user: x.id, managers: [], via: x.id === 'alberto' ? ('creator' as const) : ('personal' as const), approvedBy: 'alberto', claimedAt: Date.UTC(2026, 10, 10) })),
    // Plaza libre: la Tía Loli aún no ha entrado, pero ya se le puede poner presupuesto y apuntar sorpresas.
    { id: 'l-loli', group: 'navidad', name: 'Tía Loli', kind: 'person', managers: [] },
    ...users.map((x) => ({ id: `l-c-${x.id}`, group: 'cumple-mama', name: x.name, kind: 'person' as const, user: x.id, managers: [], via: x.id === 'samira' ? ('creator' as const) : ('personal' as const), approvedBy: 'samira' })),
  ];
  let n = 0;
  // Fotos con licencia libre guardadas en el repo (créditos en public/demo/fotos/CREDITOS.md). El taller (i17), sin foto.
  const photo = (id: string) => (id === 'i17' ? {} : { image: `${import.meta.env.BASE_URL}demo/fotos/${id}.webp` });
  const it = (list: string, title: string, o: Partial<Item> = {}): Item => {
    const id = `i${++n}`;
    return { id, list, title, currency: 'EUR', priority: 2, quantity: 1, createdBy: list.replace(/^l-(c-)?/, ''), ...photo(id), ...o };
  };
  const items: Item[] = [
    // Mamá
    it('l-mama', 'Marco digital de fotos', { priceCents: 12900, store: 'Amazon', url: 'https://www.amazon.es/s?k=marco+digital+fotos', priority: 1, notes: 'Para ver las fotos de los nietos.' }), // i1
    it('l-mama', 'Chal de lana merino', { priceCents: 4900, store: 'Lanas Norte', color: 'Burdeos' }), // i2
    it('l-mama', 'Robot de cocina', { priceCents: 34900, store: 'Hogar Plaza', priority: 1, notes: 'El que tiene báscula.' }), // i3
    it('l-mama', 'Novela «La casa de los veranos»', { priceCents: 2190, store: 'Librería del Puerto', priority: 3 }), // i4
    it('l-mama', 'Pañuelo de seda estampado', { priceCents: 3500, store: 'Textil Robles', createdBy: 'papa', secret: true }), // i5 sorpresa
    // Papá
    it('l-papa', 'Cafetera italiana de 6 tazas', { priceCents: 3495, store: 'Amazon', url: 'https://www.amazon.es/s?k=cafetera+italiana+6+tazas', priority: 1 }), // i6
    it('l-papa', 'Guantes de piel para conducir', { priceCents: 3900, store: 'Marroquinería Sol', size: 'L' }), // i7
    it('l-papa', 'Entradas para el fútbol', { priceCents: 9000, store: 'Taquilla', quantity: 2, priority: 1 }), // i8
    // Alberto (lleva la hucha: las cuentas de sus regalos las lleva Samira)
    it('l-alberto', 'Auriculares inalámbricos con cancelación de ruido', { priceCents: 8999, store: 'Amazon', url: 'https://www.amazon.es/s?k=auriculares+cancelacion+ruido', priority: 1 }), // i9
    it('l-alberto', 'Teclado mecánico compacto', { priceCents: 7900, store: 'Amazon', url: 'https://www.amazon.es/s?k=teclado+mecanico+compacto' }), // i10
    it('l-alberto', 'Sudadera de algodón orgánico', { priceCents: 4500, store: 'Textil Robles', size: 'M', priority: 3 }), // i11
    // Juan Carlos
    it('l-juancarlos', 'Juego de mesa cooperativo', { priceCents: 4495, store: 'Amazon', url: 'https://www.amazon.es/s?k=juego+de+mesa+cooperativo', priority: 1 }), // i12
    it('l-juancarlos', 'Cuchillo de chef', { priceCents: 7900, store: 'Cuchillería Toledo' }), // i13
    it('l-juancarlos', 'Mochila de senderismo 30 L', { priceCents: 6900, store: 'Montaña Shop' }), // i14
    // Samira (lleva las cuentas de los regalos de Alberto)
    it('l-samira', 'Lámpara de lectura de pinza', { priceCents: 3990, store: 'Casa Clara', priority: 1 }), // i15
    it('l-samira', 'Monstera mediana', { priceCents: 2800, store: 'Vivero San Juan' }), // i16
    it('l-samira', 'Taller de cerámica para dos', { priceCents: 6500, store: 'Barro y Fuego', priority: 1 }), // i17
    // Tía Loli (plaza libre): sorpresa apuntada por Mamá
    it('l-loli', 'Bufanda de punto', { priceCents: 2900, store: 'Lanas Norte', createdBy: 'mama', secret: true }), // i18
    // Cumpleaños de Mamá (modo hucha)
    it('l-c-mama', 'Escapada a Lisboa con sus hermanas', { priceCents: 60000, store: 'Agencia Brisa', priority: 1 }), // i19
    it('l-c-mama', 'Álbum de fotos de familia', { priceCents: 3900, store: 'Papelería Olga' }), // i20
  ];
  const at = Date.UTC(2026, 10, 9);
  const claims: Claim[] = [
    { id: 'c1', item: 'i1', user: 'alberto', kind: 'self', status: 'reserved', units: 1 },
    { id: 'c2', item: 'i2', user: 'samira', kind: 'self', status: 'bought', units: 1, paidBy: 'samira', paidCents: 4900, boughtAt: at },
    { id: 'c3', item: 'i3', user: 'juancarlos', kind: 'pot', status: 'bought', units: 1, paidBy: 'samira', paidCents: 33990, boughtAt: at },
    { id: 'c4', item: 'i5', user: 'papa', kind: 'pot', status: 'reserved', units: 1 },
    { id: 'c5', item: 'i6', user: 'juancarlos', kind: 'self', status: 'bought', units: 1, paidBy: 'juancarlos', paidCents: 3495, boughtAt: at },
    { id: 'c6', item: 'i8', user: 'alberto', kind: 'pot', status: 'reserved', units: 1 },
    { id: 'c7', item: 'i9', user: 'samira', kind: 'pot', status: 'bought', units: 1, paidBy: 'samira', paidCents: 8999, boughtAt: at },
    { id: 'c8', item: 'i12', user: 'papa', kind: 'self', status: 'reserved', units: 1 },
    { id: 'c9', item: 'i14', user: 'alberto', kind: 'pot', status: 'bought', units: 1, paidBy: 'alberto', paidCents: 6500, boughtAt: at },
    { id: 'c10', item: 'i15', user: 'mama', kind: 'self', status: 'reserved', units: 1 },
    { id: 'c11', item: 'i18', user: 'mama', kind: 'pot', status: 'reserved', units: 1 },
  ];
  const contributions: Contribution[] = [
    { id: 'p1', item: 'i17', user: 'juancarlos', amountCents: 3000, paid: false },
    { id: 'p2', item: 'i17', user: 'papa', amountCents: 2000, paid: true },
  ];
  const budgets: Budget[] = [
    { id: 'b1', list: 'l-mama', amountCents: 40000 },
    { id: 'b2', list: 'l-papa', amountCents: 20000 },
    { id: 'b3', list: 'l-alberto', amountCents: 15000 },
    { id: 'b4', list: 'l-juancarlos', amountCents: 15000 },
    { id: 'b5', list: 'l-samira', amountCents: 15000 },
    { id: 'b6', list: 'l-loli', amountCents: 5000 },
    { id: 'b7', list: 'l-c-mama', amountCents: 50000 },
  ];
  const payments: Payment[] = [
    { id: 'y1', group: 'navidad', from: 'papa', to: 'alberto', amountCents: 3000, sub: false, at },
    { id: 'y2', group: 'navidad', from: 'mama', to: 'samira', amountCents: 1000, sub: true, at },
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
  const invites = [{ token: DEMO_GENERAL_TOKEN, group: 'navidad', uses: 0, maxUses: 30, createdBy: 'alberto' }];
  return { users, groups, memberships, lists, items, claims, contributions, budgets, payments, invites, requests: [], draws, assignments };
}

/** Fichas preparadas para enlaces de ejemplo: la demo no tiene servidor que descargue páginas. */
export const DEMO_UNFURL: { match: RegExp; meta: { title: string; priceCents?: number; store: string } }[] = [
  { match: /amazon\./i, meta: { title: 'Altavoz inteligente compacto', priceCents: 5499, store: 'Amazon' } },
  { match: /./, meta: { title: 'Producto de ejemplo', priceCents: 2500, store: 'Tienda de ejemplo' } },
];
