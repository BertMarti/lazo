import { parseAmount } from './money';
import { LIMITS, type Cents, type Priority } from './types';

export type Field = 'title' | 'price' | 'url' | 'store' | 'size' | 'color' | 'notes' | 'priority' | 'quantity';
export type ColumnMap = Partial<Record<Field, number>>;

export const FIELD_LABEL: Record<Field, string> = {
  title: 'Regalo', price: 'Precio', url: 'Enlace', store: 'Tienda', size: 'Talla', color: 'Color', notes: 'Notas',
  priority: 'Prioridad', quantity: 'Cantidad',
};

/**
 * Sinónimos en español e inglés (sin tildes, en minúscula), palabra a palabra. El orden importa cuando una cabecera
 * nombra dos cosas: «Nombre de la tienda» es tienda, «Enlace del producto» es enlace y «Precio por unidad», precio.
 * Por eso el regalo, que es lo más genérico, va el último.
 */
const SYNONYMS: [Field, string[]][] = [
  ['url', ['url', 'enlace', 'link', 'web', 'direccion', 'pagina', 'href']],
  ['store', ['tienda', 'store', 'shop', 'comercio', 'vendedor', 'seller', 'donde']],
  ['price', ['precio', 'price', 'importe', 'coste', 'costo', 'cost', 'pvp', 'euro', 'eur', '€', 'cuesta', 'valor']],
  ['quantity', ['cantidad', 'unidades', 'unidad', 'uds', 'ud', 'qty', 'quantity', 'cuantos', 'cuantas']],
  ['size', ['talla', 'size', 'tamano', 'medida', 'numero']],
  ['color', ['color', 'colour', 'tono']],
  ['priority', ['prioridad', 'priority', 'importancia', 'ganas', 'urgencia']],
  ['notes', ['notas', 'nota', 'comentario', 'observaciones', 'observacion', 'detalle', 'notes', 'note', 'comment', 'comments', 'info']],
  ['title', ['regalo', 'titulo', 'nombre', 'producto', 'articulo', 'item', 'title', 'name', 'product', 'descripcion', 'deseo', 'quiero', 'que', 'cosa']],
];

/** «¿Cuánto CUESTA? (€)» → ['cuanto', 'cuesta', '€']: sin tildes, en minúscula y sin signos. */
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
const words = (s: string) => norm(s).replace(/€/g, ' € ').split(/[^a-z0-9€]+/).filter(Boolean);
const plural = (w: string, syn: string) => w === syn || w === `${syn}s` || w === `${syn}es`;

/** Qué campo parece una cabecera (o `undefined`), saltándose los que ya están cogidos. */
function fieldOf(header: string, taken: ColumnMap): Field | undefined {
  const ws = words(header);
  return SYNONYMS.find(([f, syns]) => taken[f] === undefined && ws.some((w) => syns.some((s) => plural(w, s))))?.[0];
}

/**
 * Adivina qué es cada columna por su cabecera y, si no hay pistas, por el contenido de unas filas de muestra
 * (una columna llena de https:// es el enlace; una con «€», el precio). Sin IA.
 */
export function guessColumns(headers: string[], sample: unknown[][] = []): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((h, i) => {
    const f = fieldOf(String(h ?? ''), map);
    if (f) map[f] = i;
  });
  const free = (i: number) => !Object.values(map).includes(i);
  const looks = (i: number, re: RegExp) => {
    const vals = sample.map((r) => String(r[i] ?? '').trim()).filter(Boolean);
    return vals.length > 0 && vals.every((v) => re.test(v));
  };
  for (const [f, re] of [['url', /^https?:\/\//i], ['price', /^\s*€?\s*\d[\d.,]*\s*€\s*$|^€\s*\d/]] as const) {
    if (map[f] !== undefined) continue;
    const i = headers.findIndex((_, i) => free(i) && looks(i, re));
    if (i !== -1) map[f] = i;
  }
  return map;
}

/** El campo al que va la columna `col`, o `undefined` si no se importa. */
export const fieldForColumn = (map: ColumnMap, col: number): Field | undefined =>
  (Object.keys(map) as Field[]).find((f) => map[f] === col);

/** Asigna la columna `col` a `field` (o a nada). Cada campo sale de una sola columna: si otra lo tenía, lo suelta. */
export function assignColumn(map: ColumnMap, col: number, field: Field | undefined): ColumnMap {
  const next: ColumnMap = {};
  for (const f of Object.keys(map) as Field[]) if (map[f] !== col && f !== field) next[f] = map[f];
  if (field) next[field] = col;
  return next;
}

export interface ItemDraft {
  title: string;
  priceCents?: Cents;
  url?: string;
  store?: string;
  size?: string;
  color?: string;
  notes?: string;
  priority: Priority;
  quantity: number;
}

const cell = (row: unknown[], i: number | undefined): string =>
  i === undefined || row[i] === undefined || row[i] === null ? '' : String(row[i]).trim();

function toPriority(v: string): Priority {
  const n = norm(v);
  if (/^(1|alta|mucha|high|\*\*\*)/.test(n)) return 1;
  if (/^(3|baja|poca|low|\*$)/.test(n)) return 3;
  return 2;
}

const safeUrl = (v: string): string | undefined => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
};

/** Filas de la hoja (sin la cabecera) → borradores de regalo. Ignora filas sin título; como mucho 300. */
export function rowsToDrafts(rows: unknown[][], map: ColumnMap): ItemDraft[] {
  const out: ItemDraft[] = [];
  for (const row of rows) {
    if (out.length >= LIMITS.importRows) break;
    const title = cell(row, map.title).slice(0, LIMITS.title);
    if (!title) continue;
    const rawPrice = map.price === undefined ? undefined : row[map.price];
    const priceCents =
      typeof rawPrice === 'number' ? parseAmount(rawPrice) : rawPrice ? parseAmount(String(rawPrice)) : null;
    const qty = Number.parseInt(cell(row, map.quantity), 10);
    const pr = cell(row, map.priority);
    out.push({
      title,
      priceCents: priceCents ?? undefined,
      url: safeUrl(cell(row, map.url)),
      store: cell(row, map.store).slice(0, 80) || undefined,
      size: cell(row, map.size) || undefined,
      color: cell(row, map.color) || undefined,
      notes: cell(row, map.notes).slice(0, LIMITS.notes) || undefined,
      priority: pr ? toPriority(pr) : 2,
      quantity: Number.isFinite(qty) ? Math.min(Math.max(qty, 1), LIMITS.quantity) : 1,
    });
  }
  return out;
}
