import { normName } from './plazas';
import { priceToCents } from './meta';
import { amazonInfo } from './amazon';
import { LIMITS, type Cents, type Priority } from './types';

/**
 * Importar una lista de Amazon copiando y pegando (camino b, docs/legal/AMAZON.md y AMZ-9, 10, 11, 15 y 16 de
 * docs/security/AUDIT.md). Lazo no hace ninguna petición a Amazon: todo sale de lo que pega la persona, que se
 * analiza aquí, en el dispositivo, como texto o con `DOMParser` (documento inerte: ni scripts ni imágenes).
 */
export interface AmazonProducto {
  title: string;
  priceCents?: Cents;
  /** Solo `https://` de los hosts de imágenes de Amazon (lista cerrada). */
  image?: string;
  asin?: string;
  /** Siempre construido: `https://www.amazon.es/dp/<ASIN>`. Nunca se copia un `href`. */
  url?: string;
  priority?: Priority;
  quantity?: number;
}

export const MAX_PRODUCTOS = 100;
export const MAX_PEGADO = 2_000_000;
const ASIN = /^[A-Z0-9]{10}$/;
const IMG_HOSTS = new Set(['m.media-amazon.com', 'images-eu.ssl-images-amazon.com', 'images-na.ssl-images-amazon.com']);

/** ¿Trae el texto (o el de «Compartir») un enlace a una lista de amazon.es? Devuelve su identificador. No se visita. */
export function listaId(text: string): string | null {
  for (const raw of text.slice(0, 10_000).match(/https?:\/\/[^\s<>"']{1,500}/gi) ?? []) {
    let u: URL;
    try {
      u = new URL(raw.replace(/[),.;]+$/, ''));
    } catch {
      continue;
    }
    if (u.username || u.password || u.port || !/^(www\.)?amazon\.es$/i.test(u.hostname)) continue;
    const id = u.pathname.match(/^\/(?:hz\/wishlist\/(?:ls|genericItemsPage)|(?:gp\/)?registry\/wishlist)\/([A-Za-z0-9]{10,16})(?:\/|$)/)?.[1];
    if (id) return id.toUpperCase();
  }
  return null;
}

/** AMZ-9: texto plano y acotado. Sin controles ni caracteres de dirección; espacios colapsados; 200 como mucho. */
export function limpiaTitulo(s: string): string {
  return (
    s
      // eslint-disable-next-line no-control-regex -- justo los caracteres de control
      .replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, LIMITS.title)
      .trim()
  );
}

/** AMZ-10: foto solo `https:` de la lista cerrada de hosts de Amazon, sin puerto ni credenciales. */
export function fotoSegura(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(src.trim());
    return u.protocol === 'https:' && IMG_HOSTS.has(u.hostname) && !u.port && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}

const conAsin = (asin: string | undefined) => (asin && ASIN.test(asin) ? { asin, url: `https://www.amazon.es/dp/${asin}` } : null);

const PRECIO = /^(?:precio:?\s*)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?\s?€$/i;
const PRECIO_EN = /(\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s?€/;
const PRECIO_AL_ANADIR = /^precio (?:cuando se añadió|al añadirlo):?\s*(\d[\d.]*,\d{2})\s?€/i;
const ANADIDO = /^(?:artículo )?añadido el\b/i;
const META = /^(prioridad|cantidad|necesita|quiere|tiene|comprado)\b|^(máxima|alta|media|baja|mínima|\d{1,2})$/i;
/** Líneas que no son el título: marca, estrellas, recuentos, precios, botones y avisos de la ficha. */
const RUIDO =
  /^(de|por|by|marca:?)\s|estrellas|€|^\(?\d[\d.,]*\)?$|^(oferta|prime|envío|entrega|recíbelo|disponible|no disponible|en stock|quedan|solo queda|ver (opciones|todas|más)|añadir al carrito|añadir a la cesta|comprar|mover|eliminar|comentario|precio|cantidad|prioridad|necesita|tiene|comprado|compartir|más|ordenar|filtrar|buscar|tamaño|color|estilo|vendido)/i;
const PRIORIDADES: [RegExp, Priority][] = [
  [/^(máxima|alta|highest|high)$/i, 1],
  [/^(media|medium)$/i, 2],
  [/^(baja|mínima|low|lowest)$/i, 3],
];

/** Prioridad y cantidad de una ficha («Prioridad: Alta», «Cantidad\n2»), si las hay. */
function prioCantidad(text: string): Pick<AmazonProducto, 'priority' | 'quantity'> {
  const out: Pick<AmazonProducto, 'priority' | 'quantity'> = {};
  const prio = text.match(/prioridad:?\s{0,5}(\p{L}{1,10})/iu)?.[1];
  const pr = prio && PRIORIDADES.find(([re]) => re.test(prio))?.[1];
  if (pr) out.priority = pr;
  const qty = Number(text.match(/(?:cantidad(?: deseada)?|necesita|quiere):?\s{0,5}(\d{1,2})\b/i)?.[1]);
  if (qty >= 1 && qty <= LIMITS.quantity) out.quantity = qty;
  return out;
}

/**
 * Productos del texto plano copiado (Ctrl+A o «Seleccionar todo» y «Copiar»). Cada ficha termina en «Añadido el …»
 * (vista de la dueña); si no hay ninguna (lista compartida), cada precio cierra una. El título es la línea con texto
 * más cercana por encima del precio: salta la marca, las estrellas y los recuentos. Sin ASIN ni enlace ni foto.
 */
export function parseListaTexto(text: string): AmazonProducto[] {
  const lines = text
    .slice(0, MAX_PEGADO)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim().slice(0, 500))
    .filter(Boolean);
  const porAnadido = lines.flatMap((l, i) => (ANADIDO.test(l) ? [i] : []));
  const anchors = porAnadido.length ? porAnadido : lines.flatMap((l, i) => (PRECIO.test(l) ? [i] : []));
  const out: AmazonProducto[] = [];
  let from = 0;
  for (let n = 0; n < anchors.length && out.length < MAX_PRODUCTOS; n++) {
    const anchor = anchors[n]!;
    const seg = lines.slice(from, porAnadido.length ? anchor : anchor + 1);
    const priceAt = seg.findIndex((l) => PRECIO.test(l));
    const price = priceAt >= 0 ? seg[priceAt] : seg.map((l) => l.match(PRECIO_AL_ANADIR)?.[1]).find(Boolean);
    let titleAt = -1;
    for (let i = (priceAt >= 0 ? priceAt : seg.length) - 1; i >= 0; i--)
      if (!RUIDO.test(seg[i]!) && seg[i]!.length >= 4 && /\p{L}/u.test(seg[i]!)) {
        titleAt = i;
        break;
      }
    // Lo que va justo detrás de «Añadido el …»: prioridad, cantidad y «Tiene». Nada más, para no comerse la siguiente.
    let end = anchor + 1;
    while (porAnadido.length && end < lines.length && end < (anchors[n + 1] ?? Infinity) && META.test(lines[end]!)) end++;
    const title = titleAt >= 0 ? limpiaTitulo(seg[titleAt]!) : '';
    if (title) {
      const p: AmazonProducto = { title, ...prioCantidad(lines.slice(anchor, end).join('\n')) };
      const cents = price ? priceToCents(price) : null;
      if (cents) p.priceCents = cents;
      out.push(p);
    }
    from = end;
  }
  return out;
}

/** ASIN de un enlace de producto de cualquier Amazon (relativo o absoluto). Solo se usa el ASIN, nunca el enlace. */
function asinDe(href: string | null): string | undefined {
  if (!href) return undefined;
  try {
    let u = new URL(href, 'https://www.amazon.es');
    // Chrome, al leer `text/html` con clipboard.read(), vuelve absolutos los enlaces relativos contra NUESTRA página.
    if (typeof location !== 'undefined' && u.origin === location.origin) u = new URL(u.pathname, 'https://www.amazon.es');
    return u.protocol === 'https:' ? amazonInfo(u.href)?.asin : undefined;
  } catch {
    return undefined;
  }
}

const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * Productos del HTML pegado (`text/html` del portapapeles). Fichas con `data-itemid` si las hay; si no, cada grupo de
 * enlaces a `/dp/<ASIN>` y su contenedor más cercano. Sin ASIN válido, la fila no existe (AMZ-10).
 */
export function parseListaHtml(html: string): AmazonProducto[] {
  if (typeof DOMParser === 'undefined' || !html) return [];
  const doc = new DOMParser().parseFromString(html.slice(0, MAX_PEGADO), 'text/html');
  const out: AmazonProducto[] = [];
  const seen = new Set<string>();
  const push = (card: Element, asin: string | undefined, title: string, extra: Partial<AmazonProducto> = {}) => {
    const link = conAsin(asin);
    const t = limpiaTitulo(title);
    if (!link || !t || seen.has(link.asin) || out.length >= MAX_PRODUCTOS) return;
    seen.add(link.asin);
    const all = texto(card);
    const p: AmazonProducto = { title: t, ...link, ...prioCantidad(all) };
    const cents = extra.priceCents ?? priceToCents(texto(card.querySelector('.a-offscreen')).match(PRECIO_EN)?.[0] ?? all.match(PRECIO_EN)?.[0] ?? '');
    if (cents) p.priceCents = cents;
    const img = card.querySelector('img');
    const foto = fotoSegura(img?.getAttribute('src')) ?? fotoSegura(img?.getAttribute('data-src'));
    if (foto) p.image = foto;
    out.push(p);
  };

  const cards = [...doc.querySelectorAll('[data-itemid]')].slice(0, 500);
  for (const card of cards) {
    const name = card.querySelector('a[id^="itemName_"]');
    const asin =
      [...card.querySelectorAll('a[href]')].map((a) => asinDe(a.getAttribute('href'))).find(Boolean) ??
      (card.getAttribute('data-reposition-action-params') ?? '').match(/ASIN:([A-Z0-9]{10})\b/)?.[1];
    const raw = card.getAttribute('data-price');
    const n = raw ? Number.parseFloat(raw) : Number.NaN;
    push(card, asin, name?.getAttribute('title') || texto(name), Number.isFinite(n) && n > 0 ? { priceCents: priceToCents(n) ?? undefined } : {});
  }
  if (out.length || cards.length) return out;

  // Sin fichas marcadas (otro navegador, otra versión de la página): enlaces a productos con texto.
  for (const a of [...doc.querySelectorAll('a[href]')].slice(0, 5000)) {
    const asin = asinDe(a.getAttribute('href'));
    const title = texto(a);
    if (!asin || seen.has(asin) || title.length < 8 || RUIDO.test(title)) continue;
    // La ficha: el contenedor más alto que solo habla de este producto.
    let card: Element = a;
    for (let up = card.parentElement, i = 0; up && up !== doc.body && i < 6; up = up.parentElement, i++) {
      if ([...up.querySelectorAll('a[href]')].some((x) => asinDe(x.getAttribute('href')) !== asin && /\/dp\//.test(x.getAttribute('href') ?? ''))) break;
      card = up;
    }
    push(card, asin, title);
  }
  return out;
}

/** Lo pegado: primero el HTML (trae ASIN, enlace y foto) y, si no da nada, el texto plano. */
export function parseListaPegada(text: string, html?: string): AmazonProducto[] {
  const fromHtml = html ? parseListaHtml(html) : [];
  return fromHtml.length ? fromHtml : parseListaTexto(text);
}

/** ¿Solo han pegado el enlace de la lista (lo que da la app de Amazon al compartir)? */
export const soloEnlace = (text: string) => listaId(text) !== null && text.replace(/https?:\/\/\S+/g, '').trim().length < 200;

/**
 * AMZ-11: ¿ya está en la lista? Se mira SOLO en el cliente, contra los regalos que la dueña ve (sin sorpresas ni
 * retirados): mismo ASIN o mismo título sin mayúsculas, tildes ni espacios de más. El servidor nunca deduplica.
 */
export function esDuplicado(p: AmazonProducto, visibles: { title: string; url?: string }[]): boolean {
  const t = normName(p.title);
  return visibles.some((i) => (p.asin && i.url && amazonInfo(i.url)?.asin === p.asin) || normName(i.title) === t);
}
