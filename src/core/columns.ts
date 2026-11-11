import { parseAmount } from './money';
import { LIMITS, type Cents, type Priority } from './types';

export type Field = 'title' | 'price' | 'url' | 'size' | 'color' | 'notes' | 'priority' | 'quantity';
export type ColumnMap = Partial<Record<Field, number>>;

export const FIELD_LABEL: Record<Field, string> = {
  title: 'Regalo', price: 'Precio', url: 'Enlace', size: 'Talla', color: 'Color', notes: 'Notas',
  priority: 'Prioridad', quantity: 'Cantidad',
};

/** Sinónimos (sin tildes, en minúscula). El orden importa: el primero que encaja gana. */
const SYNONYMS: [Field, RegExp][] = [
  ['url', /^(url|enlace|link|web|direccion|pagina)/],
  ['price', /^(precio|price|importe|coste|costo|pvp|euros?|€)/],
  ['size', /^(talla|size|tamano|medida|numero)$/],
  ['color', /^(colou?r|tono)/],
  ['priority', /^(prioridad|priority|importancia|ganas)/],
  ['quantity', /^(cantidad|unidades|uds?|qty|quantity|cuantos)/],
  ['notes', /^(notas?|comentarios?|observaciones|detalles?|notes?|comments?)/],
  ['title', /^(regalo|titulo|nombre|producto|articulo|item|title|name|product|descripcion|que)/],
];

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

export function guessColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((h, i) => {
    const n = norm(String(h ?? ''));
    const hit = SYNONYMS.find(([f, re]) => map[f] === undefined && re.test(n));
    if (hit) map[hit[0]] = i;
  });
  return map;
}

export interface ItemDraft {
  title: string;
  priceCents?: Cents;
  url?: string;
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
      size: cell(row, map.size) || undefined,
      color: cell(row, map.color) || undefined,
      notes: cell(row, map.notes).slice(0, LIMITS.notes) || undefined,
      priority: pr ? toPriority(pr) : 2,
      quantity: Number.isFinite(qty) ? Math.min(Math.max(qty, 1), LIMITS.quantity) : 1,
    });
  }
  return out;
}
