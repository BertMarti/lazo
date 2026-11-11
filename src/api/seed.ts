import type { Claim, Contribution, Draw, GiftList, Group, Item, Membership, User } from '../core/types';

/** Datos ficticios de la demo: la familia Robles. Cualquier parecido con una familia real es casualidad. */
export interface DemoData {
  users: User[];
  groups: Group[];
  memberships: Membership[];
  lists: GiftList[];
  items: Item[];
  claims: Claim[];
  contributions: Contribution[];
  draws: Draw[];
  assignments: { draw: string; giver: string; receiver: string }[];
}

const u = (id: string, name: string, color: string): User => ({ id, name, color });

export function seed(): DemoData {
  const users = [
    u('marta', 'Marta', 'fresa'),
    u('pablo', 'Pablo', 'menta'),
    u('lucia', 'Lucía', 'limon'),
    u('jorge', 'Jorge', 'cielo'),
    u('carmen', 'Abuela Carmen', 'violeta'),
  ];
  const groups: Group[] = [
    { id: 'navidad', name: 'Navidad en casa de la abuela', occasion: 'navidad', date: '2026-12-24', currency: 'EUR', owner: 'marta' },
    { id: 'cumple-carmen', name: 'Los 80 de la abuela', occasion: 'cumpleanos', date: '2027-02-03', currency: 'EUR', owner: 'lucia' },
  ];
  const memberships: Membership[] = [
    ...users.map((x, i) => ({ id: `m-n-${x.id}`, group: 'navidad', user: x.id, role: i === 0 ? ('admin' as const) : ('member' as const) })),
    ...users.map((x) => ({ id: `m-c-${x.id}`, group: 'cumple-carmen', user: x.id, role: x.id === 'lucia' ? ('admin' as const) : ('member' as const) })),
  ];
  const lists: GiftList[] = [
    ...users.map((x) => ({ id: `l-${x.id}`, group: 'navidad', name: x.name, user: x.id, managers: [] })),
    { id: 'l-vera', group: 'navidad', name: 'Vera', managers: ['marta', 'pablo'], birthYear: 2020, notes: 'Le encantan los animales y pintar.' },
    { id: 'l-carmen-80', group: 'cumple-carmen', name: 'Abuela Carmen', user: 'carmen', managers: [] },
  ];
  let n = 0;
  const it = (list: string, title: string, o: Partial<Item> = {}): Item => ({
    id: `i${++n}`, list, title, currency: 'EUR', priority: 2, quantity: 1, createdBy: list.slice(2), ...o,
  });
  const items: Item[] = [
    it('l-marta', 'Auriculares inalámbricos con cancelación de ruido', { priceCents: 8999, store: 'Amazon', url: 'https://www.amazon.es/s?k=auriculares+cancelacion+ruido', priority: 1, color: 'Negro' }),
    it('l-marta', 'Novela «La casa de los veranos»', { priceCents: 2190, store: 'Librería del Puerto', notes: 'En tapa dura si puede ser.' }),
    it('l-marta', 'Taller de cerámica para dos', { priceCents: 6500, store: 'Barro y Fuego', priority: 1 }),
    it('l-marta', 'Calcetines de lana gruesa', { priceCents: 1200, store: 'Lanas Norte', size: '38–40', quantity: 2, priority: 3 }),
    it('l-pablo', 'Bicicleta de montaña', { priceCents: 54900, store: 'Bici Norte', size: 'L', priority: 1, notes: 'La gris, no la roja.' }),
    it('l-pablo', 'Cafetera italiana de 6 tazas', { priceCents: 3495, store: 'Amazon', url: 'https://www.amazon.es/s?k=cafetera+italiana+6+tazas' }),
    it('l-pablo', 'Guantes de ciclismo de invierno', { priceCents: 2900, store: 'Bici Norte', size: 'M', priority: 2 }),
    it('l-lucia', 'Lámpara de lectura de pinza', { priceCents: 3990, store: 'Casa Clara', priority: 1 }),
    it('l-lucia', 'Plantas: monstera mediana', { priceCents: 2800, store: 'Vivero San Juan', priority: 2 }),
    it('l-lucia', 'Pijama de franela', { priceCents: 3500, store: 'Textil Robles', size: 'S', color: 'Verde', priority: 3 }),
    it('l-jorge', 'Juego de mesa cooperativo', { priceCents: 4495, store: 'Amazon', url: 'https://www.amazon.es/s?k=juego+de+mesa+cooperativo', priority: 1 }),
    it('l-jorge', 'Cuchillo de chef', { priceCents: 7900, store: 'Cuchillería Toledo', priority: 2 }),
    it('l-carmen', 'Marco digital de fotos', { priceCents: 12900, store: 'Amazon', url: 'https://www.amazon.es/s?k=marco+digital+fotos', priority: 1, notes: 'Para ver las fotos de los nietos.' }),
    it('l-carmen', 'Chal de lana merino', { priceCents: 4900, store: 'Lanas Norte', color: 'Burdeos', priority: 2 }),
    it('l-vera', 'Caja de acuarelas con 24 colores', { priceCents: 1890, store: 'Papelería Olga', priority: 1, createdBy: 'marta' }),
    it('l-vera', 'Peluche de zorro grande', { priceCents: 2500, store: 'Juguetes Pompa', priority: 1, createdBy: 'pablo' }),
    it('l-vera', 'Libro de pegatinas de animales', { priceCents: 990, store: 'Librería del Puerto', priority: 2, createdBy: 'marta' }),
    it('l-vera', 'Bicicleta sin pedales', { priceCents: 8900, store: 'Bici Norte', priority: 1, createdBy: 'marta', notes: 'Talla para 6 años.' }),
    it('l-carmen-80', 'Viaje a Lisboa con las hermanas', { priceCents: 60000, store: 'Agencia Brisa', priority: 1, notes: 'Lo que más ilusión le hace.' }),
    it('l-carmen-80', 'Álbum de fotos de familia', { priceCents: 3900, store: 'Papelería Olga', priority: 2 }),
  ];
  const claims: Claim[] = [
    { id: 'c1', item: 'i1', user: 'pablo', status: 'bought', units: 1 }, // auriculares de Marta: ¡no debe verlo!
    { id: 'c2', item: 'i4', user: 'carmen', status: 'reserved', units: 1 },
    { id: 'c3', item: 'i6', user: 'marta', status: 'reserved', units: 1 },
    { id: 'c4', item: 'i8', user: 'jorge', status: 'bought', units: 1 },
    { id: 'c5', item: 'i15', user: 'lucia', status: 'reserved', units: 1 },
    { id: 'c6', item: 'i13', user: 'marta', status: 'reserved', units: 1 },
  ];
  const contributions: Contribution[] = [
    { id: 'p1', item: 'i5', user: 'marta', amountCents: 20000, paid: false },
    { id: 'p2', item: 'i5', user: 'lucia', amountCents: 15000, paid: true },
    { id: 'p3', item: 'i19', user: 'marta', amountCents: 15000, paid: false },
    { id: 'p4', item: 'i19', user: 'jorge', amountCents: 15000, paid: false },
  ];
  const draws: Draw[] = [
    { id: 'd1', group: 'navidad', budgetCents: 3000, exclusions: [['marta', 'pablo'], ['lucia', 'jorge']], participants: users.map((x) => x.id), createdBy: 'marta' },
  ];
  const assignments = [
    { draw: 'd1', giver: 'marta', receiver: 'jorge' },
    { draw: 'd1', giver: 'pablo', receiver: 'carmen' },
    { draw: 'd1', giver: 'lucia', receiver: 'marta' },
    { draw: 'd1', giver: 'jorge', receiver: 'pablo' },
    { draw: 'd1', giver: 'carmen', receiver: 'lucia' },
  ];
  return { users, groups, memberships, lists, items, claims, contributions, draws, assignments };
}

/** Fichas preparadas para enlaces de ejemplo: la demo no tiene servidor que descargue páginas. */
export const DEMO_UNFURL: { match: RegExp; meta: { title: string; priceCents?: number; store: string } }[] = [
  { match: /amazon\./i, meta: { title: 'Altavoz inteligente compacto', priceCents: 5499, store: 'Amazon' } },
  { match: /./, meta: { title: 'Producto de ejemplo', priceCents: 2500, store: 'Tienda de ejemplo' } },
];
