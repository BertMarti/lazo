import type { Cents, Item, Occasion } from './types';

/** Un regalo tal como sale del grupo (papel o enlace público): sin ids, sin estado y sin sorpresas. */
export interface SharedItem {
  title: string;
  image?: string;
  store?: string;
  priceCents?: Cents;
  currency: string;
  priority: 1 | 2 | 3;
  size?: string;
  color?: string;
  url?: string;
}

/** Lista de solo lectura: nombre de la persona, ocasión y sus regalos. Nada más. */
export interface SharedList {
  name: string;
  occasion: Occasion;
  items: SharedItem[];
}

/**
 * Lo que sale del grupo. Nunca las sorpresas ni lo retirado (un retirado que sigue existiendo es uno que estaba
 * cogido), y salen todos los demás, cogidos o no, en un orden que no depende del estado. El servidor hace lo
 * mismo en GET /api/lazo/shared/{token}.
 */
export function toShared(name: string, occasion: Occasion, items: Item[]): SharedList {
  return {
    name,
    occasion,
    items: items
      .filter((i) => !i.secret && !i.removed)
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'es'))
      .map((i) => ({ title: i.title, image: i.image, store: i.store, priceCents: i.priceCents, currency: i.currency, priority: i.priority, size: i.size, color: i.color, url: i.url })),
  };
}
