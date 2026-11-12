import { amazonInfo } from './amazon';
import { parseAmount } from './money';
import type { Cents } from './types';

export interface PageMeta {
  title?: string;
  image?: string;
  priceCents?: Cents;
  currency?: string;
  store?: string;
  url?: string;
}

/** Nombre bonito de las tiendas más comunes, por dominio (solo la etiqueta: nada de selectores propios). */
const STORES: [RegExp, string][] = [
  [/(^|\.)amazon\.[a-z.]+$/, 'Amazon'],
  [/(^|\.)elcorteingles\.es$/, 'El Corte Inglés'],
  [/(^|\.)pccomponentes\.(com|pt|fr|it)$/, 'PcComponentes'],
  [/(^|\.)zara\.(com|net)$/, 'Zara'],
  [/(^|\.)decathlon\.[a-z.]+$/, 'Decathlon'],
];

/** Páginas que no son el producto (bloqueo de robots, avisos de cookies…): mejor el formulario a mano. */
const NOT_A_PRODUCT = /^(amazon\.[a-z.]+|robot check|access denied|acceso denegado|just a moment|attention required|página no encontrada|page not found|404)\b/i;

/**
 * Lee SOLO metadatos públicos: JSON-LD de schema.org (Product, ProductGroup, Offer, AggregateOffer), Open Graph,
 * product:*, `itemprop` (meta y microdatos) y, en último caso, <title>. Nada de selectores propios de cada tienda.
 * Sin DOM: funciona igual en el navegador y en Node (unfurl, que ya corta la página a 1,5 MB).
 */
export function parseMeta(html: string, pageUrl: string): PageMeta {
  const page = html.slice(0, 2_000_000);
  const metas = new Map<string, string>();
  for (const tag of page.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attr(tag, 'property') ?? attr(tag, 'name');
    const content = attr(tag, 'content');
    if (key && content && !metas.has(key.toLowerCase())) metas.set(key.toLowerCase(), decode(content));
  }
  const micro = microdata(page);
  const ld = jsonLdProduct(page);
  const titleTag = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  let url = absHttps(metas.get('og:url'), pageUrl) ?? pageUrl;
  const amazon = amazonInfo(pageUrl) ?? amazonInfo(url);
  if (amazon) url = amazon.canonical;
  const store = clean(metas.get('og:site_name')) ?? knownStore(pageUrl) ?? clean(ld?.seller) ?? hostLabel(pageUrl);

  const title = productTitle(
    ld?.name ?? metas.get('og:title') ?? metas.get('twitter:title') ?? micro.name ?? metas.get('title') ?? (titleTag && decode(titleTag)),
    store,
  );
  const image = absHttps(
    ld?.image ?? metas.get('og:image:secure_url') ?? metas.get('og:image') ?? metas.get('og:image:url') ?? metas.get('twitter:image') ?? micro.image,
    pageUrl,
  );
  // El primer precio que se entienda (un «0» o un texto raro no tapa al siguiente).
  const rawPrice = [metas.get('product:price:amount'), metas.get('og:price:amount'), ld?.price, micro.price].find(
    (p) => p !== undefined && priceToCents(p) !== null,
  );
  const priceCents = rawPrice === undefined ? undefined : (priceToCents(rawPrice) ?? undefined);
  const currency = (
    metas.get('product:price:currency') ?? metas.get('og:price:currency') ?? ld?.currency ?? micro.priceCurrency ?? symbolCurrency(rawPrice)
  )
    ?.trim()
    .toUpperCase();
  return { title, image, priceCents, currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined, store, url };
}

/**
 * Precio de una página → céntimos. Acepta números de JSON-LD (1299.95) y textos con formato español o inglés
 * («1.299,95 €», «Desde 19,99€», «EUR 34.95»): toma la primera cifra que aparece.
 */
export function priceToCents(raw: string | number): Cents | null {
  if (typeof raw === 'number') return parseAmount(raw);
  const n = decode(raw).match(/\d(?:[\d.,\s]*\d)?/)?.[0];
  return n ? parseAmount(n) : null;
}

const symbolCurrency = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  if (/€|eur/i.test(raw)) return 'EUR';
  if (/£|gbp/i.test(raw)) return 'GBP';
  if (/\$|usd/i.test(raw)) return 'USD';
  return undefined;
};

/** Quita el nombre de la tienda que muchas ponen delante o detrás del título («Amazon.es: …», «… | Zara»). */
function productTitle(raw: string | undefined, store: string | undefined): string | undefined {
  let t = clean(raw && decode(raw));
  if (!t) return undefined;
  t = t.replace(/^amazon\.[a-z.]+\s*:\s*/i, '').replace(/\s*:\s*amazon\.[a-z.]+(\s*:.*)?$/i, '');
  if (store) {
    const s = store.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\s+[|·–—-]\\s+${s}(\\s*\\.[a-z]{2,3})?$`, 'i'), '').replace(new RegExp(`^${s}\\s*[|·–—:-]\\s+`, 'i'), '');
  }
  t = t.trim();
  if (!t || NOT_A_PRODUCT.test(t) || (store && t.toLowerCase() === store.toLowerCase())) return undefined;
  return t;
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€' };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

const clean = (s?: string) => {
  const t = s?.replace(/\s+/g, ' ').trim().slice(0, 200);
  return t || undefined;
};

function absHttps(src: unknown, base: string): string | undefined {
  if (typeof src !== 'string' || !src) return undefined;
  try {
    const u = new URL(decode(src.trim()), base);
    return u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function hostLabel(pageUrl: string): string | undefined {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function knownStore(pageUrl: string): string | undefined {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    return STORES.find(([re]) => re.test(host))?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Microdatos de schema.org: `itemprop="price|priceCurrency|name|image"` en cualquier etiqueta. El valor sale de
 * `content`, de `src`/`href` (imágenes) o, para el precio, del texto que sigue («<span itemprop="price">1.299,95 €</span>»).
 */
function microdata(html: string): Partial<Record<'price' | 'priceCurrency' | 'name' | 'image', string>> {
  const out: Partial<Record<'price' | 'priceCurrency' | 'name' | 'image', string>> = {};
  const re = /<([a-z][a-z0-9]*)\b[^>]*\bitemprop\s*=\s*["']?(pricecurrency|price|name|image)(?=["'\s>])[^>]*>([^<]{0,200})/gi;
  for (const m of html.matchAll(re)) {
    const tag = m[0].slice(0, m[0].indexOf('>') + 1);
    const prop = m[2]!.toLowerCase() === 'pricecurrency' ? 'priceCurrency' : (m[2]!.toLowerCase() as 'price' | 'name' | 'image');
    if (out[prop]) continue;
    const value = attr(tag, 'content') ?? (prop === 'image' ? (attr(tag, 'src') ?? attr(tag, 'href')) : undefined) ?? (prop === 'price' || prop === 'name' ? m[3] : undefined);
    if (value?.trim()) out[prop] = decode(value.trim());
  }
  return out;
}

interface LdProduct {
  name?: string;
  image?: string;
  price?: string | number;
  currency?: string;
  seller?: string;
}

function jsonLdProduct(html: string): LdProduct | undefined {
  const blocks = html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const body = block
      .replace(/^<script\b[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .replace(/^\s*(<!--|\/\/\s*<!\[CDATA\[)/, '')
      .replace(/(-->|\/\/\s*\]\]>)\s*$/, '')
      .trim()
      .replace(/;$/, '')
      // Saltos de línea sin escapar dentro de cadenas (pasa en tiendas reales): fuera de cadenas da igual.
      // eslint-disable-next-line no-control-regex -- queremos justo los caracteres de control
      .replace(/[\u0000-\u001f]+/g, ' ');
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    const product = findProduct(data, 0);
    if (product) return product;
  }
  return undefined;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

function imageOf(v: unknown): string | undefined {
  const img = first(v);
  return str(img) ?? (isObj(img) ? (str(img.url) ?? str(img.contentUrl)) : undefined);
}

/** La primera oferta con precio, aunque venga en lista, en AggregateOffer o en priceSpecification. */
function offerOf(v: unknown, depth = 0): Obj | undefined {
  if (depth > 3) return undefined;
  for (const o of Array.isArray(v) ? v : [v]) {
    if (!isObj(o)) continue;
    const spec = first(o.priceSpecification);
    const price = o.price ?? o.lowPrice ?? (isObj(spec) ? spec.price : undefined);
    if (typeof price === 'string' || typeof price === 'number')
      return { ...o, price, priceCurrency: o.priceCurrency ?? (isObj(spec) ? spec.priceCurrency : undefined) };
    const inner = offerOf(o.offers, depth + 1);
    if (inner) return inner;
  }
  return undefined;
}

function findProduct(node: unknown, depth: number): LdProduct | undefined {
  if (depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n, depth + 1);
      if (p) return p;
    }
    return undefined;
  }
  if (!isObj(node)) return undefined;
  const type = node['@type'];
  const types = (Array.isArray(type) ? type : [type]).map((t) => String(t).replace(/^.*[/#]/, ''));
  if (types.includes('Product') || types.includes('ProductGroup')) {
    const variant = first(node.hasVariant);
    const v = isObj(variant) ? variant : undefined;
    const offer = offerOf(node.offers) ?? offerOf(v?.offers);
    const price = offer?.price;
    const seller = first(offer?.seller);
    return {
      name: str(node.name) ?? str(v?.name),
      image: imageOf(node.image) ?? imageOf(v?.image),
      price: typeof price === 'string' || typeof price === 'number' ? price : undefined,
      currency: str(offer?.priceCurrency),
      seller: isObj(seller) ? str(seller.name) : undefined,
    };
  }
  return findProduct(node['@graph'] ?? node.mainEntity, depth + 1);
}
