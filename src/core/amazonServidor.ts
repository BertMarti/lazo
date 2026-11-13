import { fotoSegura, limpiaTitulo, type AmazonProducto } from './amazonLista';
import { decode, priceToCents } from './meta';
import { LIMITS, type Priority } from './types';

/**
 * Lectura automática de una lista de Amazon desde el servidor (camino a, apagado por defecto: `AMAZON_IMPORT=on`).
 * Funciones puras, sin red: el servicio `server/unfurl` las usa ya empaquetadas (`amazon.mjs`). Solo expresiones con
 * cuantificadores acotados (AMZ-15) y los mismos saneados del camino b (AMZ-9 y AMZ-10).
 */
export const AMZ_SERVIDOR = { paginas: 10, productos: 200, bytesPagina: 3_000_000 } as const;

/** Identificador de una lista de deseos. Lo único que el servidor acepta del cliente. */
export const ID_LISTA = /^[A-Z0-9]{10,16}$/;
/** Código de un enlace corto `https://amzn.eu/d/<código>`. */
export const CODIGO_CORTO = /^[A-Za-z0-9]{4,20}$/;
const TOKEN = /^[A-Za-z0-9_=%-]{1,3000}$/;

/** La URL de la lista la construye el servidor (AMZ-2): solo «No comprados», sin nada del enlace pegado. */
export const listaUrl = (id: string) => `https://www.amazon.es/hz/wishlist/ls/${id}?filter=unpurchased`;

/** «Ver más»: el mismo endpoint que usa la página, construido con el testigo y el identificador ya validados. */
export function paginaUrl(id: string, token: string) {
  const q = new URLSearchParams({ filter: 'unpurchased', paginationToken: token, itemsLayout: 'LIST', sort: 'date-added', type: 'wishlist', lid: id });
  return `https://www.amazon.es/hz/wishlist/slv/items?${q}`;
}

/** Identificador de lista en una URL de amazon.es (la final de un enlace corto). Host exacto, sin puerto ni credenciales. */
export function idDeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, 'https://www.amazon.es');
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !/^(www\.)?amazon\.es$/.test(u.hostname)) return null;
  const id = u.pathname.match(/^\/hz\/wishlist\/(?:ls|genericItemsPage)\/([A-Z0-9]{10,16})(?:\/|$)/)?.[1];
  return id ?? null;
}

/** Código de un enlace corto de Amazon en un texto (`https://amzn.eu/d/abc123`). No se visita aquí. */
export function codigoCorto(text: string): string | null {
  const m = text.slice(0, 10_000).match(/https:\/\/amzn\.eu\/d\/([A-Za-z0-9]{4,20})(?=[\s/?#),.;]|$)/);
  return m?.[1] ?? null;
}

/** ¿Es la página de captcha o de bloqueo de Amazon («Robot Check», `validateCaptcha`)? */
export const esBloqueo = (html: string) => /\/errors\/validateCaptcha|<title[^>]{0,100}>\s{0,20}Robot Check|api-services-support@amazon\.com/i.test(html.slice(0, AMZ_SERVIDOR.bytesPagina));

const PRIORIDAD: Record<string, Priority> = { highest: 1, high: 1, medium: 2, low: 3, lowest: 3 };
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]{0,3000})"`, 'i'))?.[1];
const VENTANA = 3000;

/**
 * La etiqueta `<tag …>` que contiene la posición `at`, buscando como mucho 3 000 caracteres a cada lado: así cada
 * búsqueda es acotada y 3 MB hostiles no se vuelven cuadráticos (AMZ-15).
 */
function etiqueta(s: string, at: number, tag: string): { text: string; end: number } | null {
  if (at < 0) return null;
  const from = Math.max(0, at - VENTANA);
  const a = s.slice(from, at).lastIndexOf(`<${tag}`);
  const b = s.slice(at, at + VENTANA).indexOf('>');
  if (a < 0 || b < 0) return null;
  return { text: s.slice(from + a, at + b + 1), end: at + b + 1 };
}

/** Un producto de la ficha `<li data-itemId>`. «Tiene» y «Comprado» no se leen nunca (LA REGLA). */
function ficha(tag: string, body: string): AmazonProducto | null {
  const asin = (attr(tag, 'data-reposition-action-params') ?? '').match(/ASIN:([A-Z0-9]{10})\b/)?.[1] ?? body.match(/\shref="\/dp\/([A-Z0-9]{10})[/?"]/)?.[1];
  if (!asin) return null; // AMZ-10: sin ASIN, la fila no existe
  const name = etiqueta(body, body.indexOf('id="itemName_'), 'a');
  const inner = name ? body.slice(name.end, name.end + 1001).match(/^([^<]{0,1000})<\/a>/)?.[1] : undefined;
  const title = limpiaTitulo(decode((name && attr(name.text, 'title')) || inner || ''));
  if (!title) return null;
  const p: AmazonProducto = { title, asin, url: `https://www.amazon.es/dp/${asin}` };

  const n = Number.parseFloat(attr(tag, 'data-price') ?? '');
  const cents = Number.isFinite(n) && n > 0 ? priceToCents(n) : priceToCents(body.match(/class="a-offscreen">([^<]{0,40}€)</)?.[1] ?? '');
  if (cents) p.priceCents = cents;

  const imgAt = body.indexOf('id="itemImage_');
  const img = imgAt >= 0 ? body.slice(imgAt, imgAt + 2 * VENTANA).indexOf('<img') : -1;
  const imgTag = img >= 0 ? etiqueta(body, imgAt + img + 4, 'img')?.text : undefined;
  const foto = fotoSegura(decode((imgTag && attr(imgTag, 'src')) ?? ''));
  if (foto) p.image = foto;

  const prio = body.match(/item-priority-(highest|high|medium|low|lowest)\b/)?.[1];
  if (prio) p.priority = PRIORIDAD[prio];
  const qty = Number(body.match(/id="itemRequested_[^"]{0,40}">\s{0,200}(\d{1,3})\s{0,200}</)?.[1]);
  if (qty >= 1 && qty <= LIMITS.quantity) p.quantity = qty;
  return p;
}

export interface PaginaLista {
  productos: AmazonProducto[];
  /** Testigo de «ver más», solo si el enlace es de esta misma lista (`lid`). */
  token?: string;
}

/** Productos de una página de la lista (la primera o un tramo de «ver más») y el testigo de la siguiente. */
export function parsePaginaLista(html: string, id: string): PaginaLista {
  const src = html.slice(0, AMZ_SERVIDOR.bytesPagina);
  const productos: AmazonProducto[] = [];
  const seen = new Set<string>();
  const starts: { text: string; at: number; end: number }[] = [];
  for (const m of src.matchAll(/data-itemid="[A-Za-z0-9]{1,40}"/gi)) {
    const li = etiqueta(src, m.index, 'li');
    if (li) starts.push({ ...li, at: m.index });
    if (starts.length >= AMZ_SERVIDOR.productos * 2) break;
  }
  for (let i = 0; i < starts.length && productos.length < AMZ_SERVIDOR.productos; i++) {
    const { text, end } = starts[i]!;
    const body = src.slice(end, Math.min(starts[i + 1]?.at ?? src.length, end + 60_000));
    const p = ficha(text, body);
    if (p && !seen.has(p.asin!)) {
      seen.add(p.asin!);
      productos.push(p);
    }
  }
  const at = src.indexOf('name="showMoreUrl"');
  const json = src.indexOf('"showMoreUrl":"');
  const more =
    (at >= 0 ? src.slice(at, at + 4300).match(/^name="showMoreUrl"[^>]{0,200}?value="([^"]{1,4000})"/)?.[1] : undefined) ??
    (json >= 0 ? src.slice(json, json + 4100).match(/^"showMoreUrl":"([^"]{1,4000})"/)?.[1] : undefined);
  let token: string | undefined;
  if (more) {
    try {
      const u = new URL(decode(more), 'https://www.amazon.es');
      const t = u.searchParams.get('paginationToken') ?? '';
      if (u.hostname === 'www.amazon.es' && u.pathname.startsWith('/hz/wishlist/') && u.searchParams.get('lid') === id && TOKEN.test(t)) token = t;
    } catch {
      /* enlace roto: fin de la lista */
    }
  }
  return { productos, token };
}
