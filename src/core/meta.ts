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

/**
 * Lee SOLO metadatos públicos (Open Graph, product:*, JSON-LD de schema.org y, en último caso, <title>).
 * Nada de selectores propios de cada tienda. Sin DOM: funciona igual en el navegador y en Node (unfurl).
 */
export function parseMeta(html: string, pageUrl: string): PageMeta {
  const head = html.slice(0, 600_000);
  const metas = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop');
    const content = attr(tag, 'content');
    if (key && content && !metas.has(key.toLowerCase())) metas.set(key.toLowerCase(), decode(content));
  }
  const ld = jsonLdProduct(head);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const title = clean(metas.get('og:title') ?? metas.get('twitter:title') ?? ld?.name ?? (titleTag && decode(titleTag)));
  const image = absHttps(metas.get('og:image') ?? metas.get('og:image:url') ?? metas.get('twitter:image') ?? ld?.image, pageUrl);
  const rawPrice = metas.get('product:price:amount') ?? metas.get('og:price:amount') ?? metas.get('price') ?? ld?.price;
  const priceCents = rawPrice !== undefined ? (parseAmount(String(rawPrice)) ?? undefined) : undefined;
  const currency = (metas.get('product:price:currency') ?? metas.get('og:price:currency') ?? ld?.currency)?.toUpperCase();
  let store = clean(metas.get('og:site_name'));
  let url = absHttps(metas.get('og:url'), pageUrl) ?? pageUrl;
  const amazon = amazonInfo(pageUrl) ?? amazonInfo(url);
  if (amazon) {
    url = amazon.canonical;
    store ??= 'Amazon';
  }
  store ??= hostLabel(pageUrl);
  return { title, image, priceCents, currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined, store, url };
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
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
    const u = new URL(decode(src), base);
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

interface LdProduct {
  name?: string;
  image?: string;
  price?: string | number;
  currency?: string;
}

function jsonLdProduct(html: string): LdProduct | undefined {
  const blocks = html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
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

function findProduct(node: unknown, depth: number): LdProduct | undefined {
  if (depth > 5) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n, depth + 1);
      if (p) return p;
    }
    return undefined;
  }
  if (!isObj(node)) return undefined;
  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('Product')) {
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const offer = isObj(offers) ? offers : undefined;
    const price = offer?.price ?? offer?.lowPrice;
    const img = Array.isArray(node.image) ? node.image[0] : node.image;
    return {
      name: typeof node.name === 'string' ? node.name : undefined,
      image: typeof img === 'string' ? img : isObj(img) && typeof img.url === 'string' ? img.url : undefined,
      price: typeof price === 'string' || typeof price === 'number' ? price : undefined,
      currency: typeof offer?.priceCurrency === 'string' ? offer.priceCurrency : undefined,
    };
  }
  return findProduct(node['@graph'], depth + 1);
}
