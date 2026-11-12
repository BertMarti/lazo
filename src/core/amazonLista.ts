import { amazonInfo } from './amazon';
import { decode, priceToCents } from './meta';
import { normName } from './plazas';
import type { Cents, Priority } from './types';

/** Un producto de una lista de Amazon, sacado del texto copiado o de la página. */
export interface AmazonProducto {
  title: string;
  priceCents?: Cents;
  image?: string;
  asin?: string;
  /** Siempre `https://www.amazon.es/dp/<ASIN>`, sin seguimiento. */
  url?: string;
  priority?: Priority;
  quantity?: number;
}

/** Lo que dice el servidor de una lista: los productos o por qué no ha podido. */
export type AmazonListaRespuesta =
  | { items: AmazonProducto[] }
  | { error: 'desactivado' | 'AMAZON_BLOQUEA' | 'lista_privada' | 'no_es_lista' | 'vacia' };

export type ListaRef = { id: string } | { short: string };

export const LISTA_ID = /^[A-Z0-9]{10,16}$/;
export const CORTO_ID = /^[A-Za-z0-9]{5,16}$/;
export const MAX_PRODUCTOS = 100;

/**
 * ¿Es (o trae dentro, como el texto de «Compartir») un enlace a una lista de Amazon?
 * `amazon.es/hz/wishlist/ls/<ID>` o `/registry/wishlist/<ID>`, con o sin `www.` y con parámetros → `{ id }`.
 * `amzn.eu/d/<x>` → `{ short }`: puede ser una lista o un producto; solo el servidor lo sabe siguiéndolo.
 */
export function listaRef(text: string): ListaRef | null {
  for (const raw of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    let u: URL;
    try {
      u = new URL(raw.replace(/[),.;]+$/, ''));
    } catch {
      continue;
    }
    if (/^(www\.)?amazon\.es$/i.test(u.hostname)) {
      const id = u.pathname.match(/^\/(?:hz\/wishlist\/ls|(?:gp\/)?registry\/wishlist)\/([A-Za-z0-9]{10,16})(?:[/?]|$)/)?.[1]?.toUpperCase();
      if (id && LISTA_ID.test(id)) return { id };
    }
    if (/^amzn\.eu$/i.test(u.hostname)) {
      const short = u.pathname.match(/^\/d\/([A-Za-z0-9]{5,16})\/?$/)?.[1];
      if (short) return { short };
    }
  }
  return null;
}

const PRECIO = /^(?:precio:?\s*)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?\s?€$/i;
const META = /^(prioridad|cantidad|necesita|quiere|tiene|comprado)\b|^(máxima|alta|media|baja|mínima|\d{1,2})$/i;
const PRECIO_AL_ANADIR = /^precio (?:cuando se añadió|al añadirlo):?\s*(\d[\d.]*,\d{2})\s?€/i;
const ANADIDO = /^(?:artículo )?añadido el\b/i;
/** Líneas que no son el título: marca, estrellas, recuentos, precios, botones y avisos de la ficha. */
const RUIDO =
  /^(de|por|by|marca:?)\s|estrellas|€|^\(?\d[\d.,]*\)?$|^(oferta|prime|envío|entrega|recíbelo|disponible|no disponible|en stock|quedan|solo queda|ver (opciones|todas|más)|añadir al carrito|añadir a la cesta|comprar|mover|eliminar|comentario|precio|cantidad|prioridad|necesita|tiene|comprado|compartir|más|ordenar|filtrar|buscar|tamaño|color|estilo|vendido)/i;

const PRIORIDADES: [RegExp, Priority][] = [
  [/máxima|alta|highest|high/i, 1],
  [/media|medium/i, 2],
  [/baja|mínima|low/i, 3],
];

/**
 * Productos del texto que se copia de la lista con Ctrl+A y Ctrl+C. Cada ficha termina en «Añadido el …»; si no hay
 * ninguna, cada precio marca una. El título es la línea con texto más cercana por encima del precio (salta la marca,
 * las estrellas y los recuentos). «Prioridad» y «Cantidad», si están, van después.
 */
export function parseListaTexto(text: string): AmazonProducto[] {
  const lines = text.slice(0, 500_000).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const porAnadido = lines.flatMap((l, i) => (ANADIDO.test(l) ? [i] : []));
  const anchors = porAnadido.length ? porAnadido : lines.flatMap((l, i) => (PRECIO.test(l) ? [i] : []));
  const out: AmazonProducto[] = [];
  let from = 0;
  anchors.forEach((anchor, n) => {
    const seg = lines.slice(from, porAnadido.length ? anchor : anchor + 1);
    const priceAt = seg.findIndex((l) => PRECIO.test(l));
    const price = priceAt >= 0 ? seg[priceAt]!.match(PRECIO)![0] : seg.map((l) => l.match(PRECIO_AL_ANADIR)?.[1]).find(Boolean);
    const start = priceAt >= 0 ? priceAt : seg.length;
    let titleAt = -1;
    for (let i = start - 1; i >= 0; i--)
      if (!RUIDO.test(seg[i]!) && seg[i]!.length >= 4 && /\p{L}/u.test(seg[i]!)) {
        titleAt = i;
        break;
      }
    // Lo que sigue justo a «Añadido el …»: prioridad, cantidad y «Tiene» (y nada más, para no comerse la siguiente).
    let end = anchor + 1;
    while (porAnadido.length && end < lines.length && end < (anchors[n + 1] ?? Infinity) && META.test(lines[end]!)) end++;
    const tail = lines.slice(anchor, end);
    if (titleAt >= 0) {
      const p: AmazonProducto = { title: seg[titleAt]!.slice(0, 200) };
      const cents = price ? priceToCents(price) : null;
      if (cents) p.priceCents = cents;
      const prio = tail.join('\n').match(/prioridad:?\s*\n?\s*(\p{L}+)/iu)?.[1];
      const pr = prio && PRIORIDADES.find(([re]) => re.test(prio))?.[1];
      if (pr) p.priority = pr;
      const qty = Number(tail.join('\n').match(/(?:cantidad(?: deseada)?|necesita|quiere):?\s*\n?\s*(\d{1,2})\b/i)?.[1]);
      if (qty >= 1 && qty <= 99) p.quantity = qty;
      out.push(p);
    }
    from = end;
  });
  return out.slice(0, MAX_PRODUCTOS);
}

/**
 * Productos del HTML de una lista: la página que lee el servidor o lo que se pega desde el navegador. Cada ficha es un
 * elemento con `data-itemid`; de ahí, el ASIN (`/dp/…` o `ASIN:…`), el título (`itemName_…`), `data-price` y la foto.
 * Sin fichas, valen los enlaces a `/dp/<ASIN>` con texto. Sin DOM: funciona en el navegador y en Node.
 */
export function parseListaHtml(html: string): AmazonProducto[] {
  const page = html.slice(0, 3_000_000);
  const out: AmazonProducto[] = [];
  const seen = new Set<string>();
  const push = (p: AmazonProducto) => {
    if (!p.title || (p.asin && seen.has(p.asin)) || out.length >= MAX_PRODUCTOS) return;
    if (p.asin) seen.add(p.asin);
    out.push(p);
  };
  const starts = [...page.matchAll(/<li\b[^>]{0,2000}\bdata-itemid\s*=/gi)].map((m) => m.index);
  starts.forEach((s, i) => {
    const block = page.slice(s, Math.min(starts[i + 1] ?? page.length, s + 60_000));
    const asin = (block.match(/\/dp\/([A-Z0-9]{10})(?=[/?"'&]|$)/) ?? block.match(/ASIN:([A-Z0-9]{10})\b/))?.[1];
    const nameTag = block.match(/<a\b[^>]{0,1500}\bid\s*=\s*["']itemName_[^>]{0,1500}>([^<]{0,500})/i);
    const title = clean((nameTag && (attr(nameTag[0], 'title') ?? nameTag[1])) ?? undefined);
    const price = attr(block.slice(0, block.indexOf('>') + 1), 'data-price') ?? block.match(/class\s*=\s*["']a-offscreen["'][^>]{0,200}>([^<]{1,40})/i)?.[1];
    const img = block.match(/<img\b[^>]{0,1500}>/i)?.[0];
    const p: AmazonProducto = { title: title ?? '' };
    const cents = price && Number.isFinite(Number.parseFloat(price.replace(',', '.'))) ? priceToCents(price) : null;
    if (cents) p.priceCents = cents;
    const src = img && attr(img, 'src');
    if (src && /^https:\/\//i.test(src)) p.image = src;
    if (asin) Object.assign(p, { asin, url: `https://www.amazon.es/dp/${asin}` });
    push(p);
  });
  if (out.length) return out;
  for (const m of page.matchAll(/<a\b[^>]{0,1500}\bhref\s*=\s*["']([^"']{0,1500})["'][^>]{0,1500}>([^<]{0,500})<\/a>/gi)) {
    let info: ReturnType<typeof amazonInfo> = null;
    try {
      info = amazonInfo(new URL(decode(m[1]!), 'https://www.amazon.es').href);
    } catch {
      continue;
    }
    const title = clean(m[2]);
    if (info && title && title.length >= 8 && !RUIDO.test(title)) push({ title, asin: info.asin, url: `https://www.amazon.es/dp/${info.asin}` });
  }
  return out;
}

/** Lo que se pega en el modo manual: el HTML (si el navegador lo da) trae ASIN y enlace; si no, el texto. */
export const parseListaPegada = (text: string, html?: string): AmazonProducto[] => {
  const fromHtml = html ? parseListaHtml(html) : [];
  return fromHtml.length ? fromHtml : parseListaTexto(text);
};

/** ¿Ya está en la lista? Mismo ASIN o mismo título sin mayúsculas, tildes ni espacios de más. */
export function esDuplicado(p: AmazonProducto, items: { title: string; url?: string }[]): boolean {
  const t = normName(p.title);
  return items.some((i) => (p.asin && i.url && amazonInfo(i.url)?.asin === p.asin) || normName(i.title) === t);
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? '') : undefined;
}

const clean = (s?: string) => {
  const t = s && decode(s).replace(/\s+/g, ' ').trim().slice(0, 200);
  return t || undefined;
};
