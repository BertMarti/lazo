import type { Api, ItemInput } from '../api/types';
import { normName } from './plazas';
import { LIMITS, type BuyMode, type Cents, type Id, type Item, type Occasion, type Priority } from './types';
import { canSeeStatus } from './visibility';

/**
 * Copia del grupo (no es la copia del servidor, que está en server/backup/). Se hace en el cliente SOLO con lo que
 * el servidor ya entrega a quien la descarga, y además se recorta a mano su propia plaza: de ella van solo los
 * regalos que pidió, sin sorpresas, sin retirados, sin estados ni presupuesto. Al restaurar solo se usan grupo,
 * plazas y regalos pedidos: nunca reservas, compras ni aportaciones.
 */

export const COPIA_VERSION = 1;
export const COPIA_MAX = { bytes: 1_000_000, lists: 80, itemsPerList: LIMITS.importRows, items: 2000 } as const;

/** Un regalo tal como lo pidió su dueño. */
export interface GiftCopy {
  title: string;
  url?: string;
  image?: string;
  priceCents?: Cents;
  store?: string;
  size?: string;
  color?: string;
  priority: Priority;
  notes?: string;
  quantity: number;
}

/** Lo que ve de un regalo quien exporta, solo en listas ajenas. */
export interface GiftSeen extends GiftCopy {
  reservas?: { quien: string; tipo: 'self' | 'pot'; estado: 'reserved' | 'bought'; unidades: number; pagadoCents?: Cents }[];
  aportaciones?: { quien: string; cents: Cents; pagada: boolean }[];
}

export interface ListCopy {
  name: string;
  kind: 'person' | 'child';
  birthYear?: number;
  /** La plaza de quien exporta: solo `regalos`, sin nada más. */
  propia: boolean;
  regalos: GiftSeen[];
  sorpresas?: GiftSeen[];
  retirados?: GiftSeen[];
  presupuestoCents?: Cents;
}

export interface Copia {
  lazo: 'copia-grupo';
  version: typeof COPIA_VERSION;
  fecha: string;
  grupo: { name: string; occasion: Occasion; date?: string; currency: string; buyMode: BuyMode; allowNewNames: boolean };
  listas: ListCopy[];
}

const strip = (i: Item): GiftCopy => {
  const g: GiftCopy = { title: i.title, priority: i.priority, quantity: i.quantity };
  for (const k of ['url', 'image', 'priceCents', 'store', 'size', 'color', 'notes'] as const) if (i[k] !== undefined && i[k] !== '') (g as unknown as Record<string, unknown>)[k] = i[k];
  return g;
};

export async function exportGroup(api: Api, groupId: Id, now = new Date()): Promise<Copia> {
  const me = api.me();
  if (!me) throw new Error('Sin sesión');
  const d = await api.groupDetail(groupId);
  const nameOf = (id?: Id) => d.members.find((m) => m.id === id)?.name ?? 'Alguien';
  const listas: ListCopy[] = [];
  for (const l of d.lists) {
    const base = { name: l.name, kind: l.kind ?? (l.user ? 'person' : 'child'), ...(l.birthYear ? { birthYear: l.birthYear } : {}) } as const;
    // Mi plaza: ni se piden sus estados; y aunque llegaran, solo se copian los regalos que pedí.
    if (!canSeeStatus(me.id, l)) {
      const own = await api.listDetail(l.id);
      listas.push({ ...base, propia: true, regalos: own.items.filter((i) => !i.secret && !i.removed).map(strip) });
      continue;
    }
    const x = await api.listDetail(l.id);
    const seen = (i: Item): GiftSeen => {
      const g: GiftSeen = strip(i);
      const cs = x.claims.filter((c) => c.item === i.id);
      const ps = x.contributions.filter((c) => c.item === i.id);
      if (cs.length) g.reservas = cs.map((c) => ({ quien: nameOf(c.user), tipo: c.kind ?? 'self', estado: c.status, unidades: c.units, ...(c.paidCents !== undefined ? { pagadoCents: c.paidCents } : {}) }));
      if (ps.length) g.aportaciones = ps.map((c) => ({ quien: nameOf(c.user), cents: c.amountCents, pagada: c.paid }));
      return g;
    };
    listas.push({
      ...base,
      propia: false,
      regalos: x.items.filter((i) => !i.secret && !i.removed).map(seen),
      sorpresas: x.items.filter((i) => i.secret).map(seen),
      retirados: x.items.filter((i) => i.removed && !i.secret).map(seen),
      ...(x.budget ? { presupuestoCents: x.budget.amountCents } : {}),
    });
  }
  const g = d.group;
  return {
    lazo: 'copia-grupo',
    version: COPIA_VERSION,
    fecha: now.toISOString(),
    grupo: { name: g.name, occasion: g.occasion, ...(g.date ? { date: g.date } : {}), currency: g.currency, buyMode: g.buyMode, allowNewNames: !!g.allowNewNames },
    listas,
  };
}

/** Descarga en el navegador: Blob + enlace con `download`. */
export function downloadCopia(c: Copia) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lazo-${normName(c.grupo.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grupo'}-${c.fecha.slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// — Validación: tipos estrictos y topes. Lo mismo corre en el servidor (lib/copia.cjs) —

export class CopiaError extends Error {}
const bad = (m = 'Este archivo no es una copia de Lazo válida.') => new CopiaError(m);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, required = false): string | undefined => {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad();
    return undefined;
  }
  if (typeof v !== 'string') throw bad();
  const s = v.trim();
  if (s.length > max || (required && !s)) throw bad();
  return s || undefined;
};
const int = (v: unknown, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad();
  return v;
};
const link = (v: unknown): string | undefined => {
  const s = str(v, 2000);
  // Sin `new URL`: este archivo también corre en el JSVM de PocketBase. El campo url del servidor valida el resto.
  // Lo que no es http(s) (javascript:, data:, rutas de la demo) se descarta: el regalo se queda sin enlace.
  return s !== undefined && /^https?:\/\/[^\s<>"'`]+$/i.test(s) ? s : undefined;
};
const pick = <T extends string>(v: unknown, values: readonly T[]): T => {
  if (!values.includes(v as T)) throw bad();
  return v as T;
};

/** Un regalo pedido, limpio. Solo los campos de un regalo: lo demás se descarta. */
export function cleanGift(v: unknown): ItemInput {
  if (!isObj(v)) throw bad();
  const out: ItemInput = {
    title: str(v.title, LIMITS.title, true)!,
    priority: int(v.priority ?? 2, 1, 3) as Priority,
    quantity: int(v.quantity ?? 1, 1, LIMITS.quantity),
  };
  const url = link(v.url);
  const image = link(v.image);
  const store = str(v.store, 80);
  const size = str(v.size, 20);
  const color = str(v.color, 40);
  const notes = str(v.notes, LIMITS.notes);
  if (url) out.url = url;
  if (image) out.image = image;
  if (v.priceCents !== undefined && v.priceCents !== null) out.priceCents = int(v.priceCents, 0, LIMITS.amount);
  if (store) out.store = store;
  if (size) out.size = size;
  if (color) out.color = color;
  if (notes) out.notes = notes;
  return out;
}

/** Lo que se restaura de una copia: grupo, plazas y regalos pedidos. Nada de estados. */
export interface Restorable {
  grupo: Copia['grupo'];
  listas: { name: string; kind: 'person' | 'child'; birthYear?: number; regalos: ItemInput[] }[];
}

/** Lee el texto de un archivo de copia. Sin eval: JSON.parse con tope de tamaño y de elementos. */
export function parseCopia(text: string): Restorable {
  if (typeof text !== 'string' || text.length > COPIA_MAX.bytes) throw bad('El archivo es demasiado grande para ser una copia de Lazo.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw bad();
  }
  if (!isObj(raw) || raw.lazo !== 'copia-grupo') throw bad();
  if (raw.version !== COPIA_VERSION) throw bad('Esta copia es de otra versión de Lazo.');
  const g = raw.grupo;
  if (!isObj(g)) throw bad();
  const date = str(g.date, 10);
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad();
  const currency = str(g.currency, 3) ?? 'EUR';
  if (!/^[A-Z]{3}$/.test(currency)) throw bad();
  const grupo: Copia['grupo'] = {
    name: str(g.name, 80, true)!,
    occasion: pick(g.occasion, ['navidad', 'cumpleanos', 'boda', 'bebe', 'otro'] as const),
    ...(date ? { date } : {}),
    currency,
    buyMode: pick(g.buyMode, ['hucha', 'individual', 'mixto'] as const),
    allowNewNames: g.allowNewNames === true,
  };
  if (!Array.isArray(raw.listas) || raw.listas.length > COPIA_MAX.lists) throw bad('La copia tiene demasiadas personas.');
  let total = 0;
  const seen = new Set<string>();
  const listas = raw.listas.map((l: unknown) => {
    if (!isObj(l)) throw bad();
    const name = str(l.name, 40, true)!;
    if (seen.has(normName(name))) throw bad();
    seen.add(normName(name));
    const kind = pick(l.kind, ['person', 'child'] as const);
    const birthYear = l.birthYear === undefined || l.birthYear === null ? undefined : int(l.birthYear, 2000, 2100);
    if (!Array.isArray(l.regalos) || l.regalos.length > COPIA_MAX.itemsPerList) throw bad('Una de las listas tiene demasiados regalos.');
    total += l.regalos.length;
    if (total > COPIA_MAX.items) throw bad('La copia tiene demasiados regalos.');
    return { name, kind, ...(kind === 'child' && birthYear ? { birthYear } : {}), regalos: l.regalos.map(cleanGift) };
  });
  return { grupo, listas };
}

/**
 * Crea un grupo NUEVO desde una copia: el grupo, las plazas (libres, para reenviar los enlaces), las listas de
 * niños y los regalos pedidos. La plaza con tu nombre es la tuya.
 */
export async function restoreCopia(api: Api, r: Restorable): Promise<Id> {
  const me = api.me();
  if (!me) throw new Error('Sin sesión');
  const people = r.listas.filter((l) => l.kind === 'person');
  const group = await api.createGroup({ ...r.grupo, plazas: people.map((l) => l.name) });
  for (const l of r.listas) if (l.kind === 'child') await api.addChildList(group.id, l.name, l.birthYear);
  const d = await api.groupDetail(group.id);
  const target = (l: Restorable['listas'][number]) =>
    l.kind === 'person' && normName(l.name) === normName(me.name)
      ? d.lists.find((x) => x.user === me.id)
      : d.lists.find((x) => x.kind === l.kind && !x.user && normName(x.name) === normName(l.name));
  const lists = r.listas.flatMap((l) => {
    const t = target(l);
    return t && l.regalos.length ? [{ list: t.id, items: l.regalos }] : [];
  });
  if (lists.length) await api.restoreItems(group.id, lists);
  return group.id;
}
