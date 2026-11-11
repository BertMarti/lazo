// src/core/amazon.ts
function amazonInfo(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const m = u.hostname.match(/(?:^|\.)amazon\.((?:com?\.)?[a-z]{2,3})$/i);
  if (!m) return null;
  const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  if (!asin) return null;
  return { asin: asin.toUpperCase(), canonical: `https://www.amazon.${m[1].toLowerCase()}/dp/${asin.toUpperCase()}` };
}

// src/core/types.ts
var LIMITS = {
  amount: 1e8,
  // 1 millón de euros en céntimos
  quantity: 20,
  importRows: 300,
  title: 200,
  notes: 1e3
};

// src/core/money.ts
function parseAmount(input) {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    const c = Math.round(input * 100);
    return c > 0 && c <= LIMITS.amount ? c : null;
  }
  const raw = input.replace(/[\s\u00a0€$£]|EUR|USD|GBP/gi, "");
  if (!/^\d[\d.,]*$/.test(raw) || /[.,]{2}/.test(raw)) return null;
  const dec = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  const frac = dec === -1 ? "" : raw.slice(dec + 1);
  let normalized;
  if (dec !== -1 && frac.length >= 1 && frac.length <= 2) {
    normalized = raw.slice(0, dec).replace(/[.,]/g, "") + "." + frac;
  } else {
    if (dec !== -1 && frac.length !== 3) return null;
    normalized = raw.replace(/[.,]/g, "");
  }
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents > 0 && cents <= LIMITS.amount ? cents : null;
}

// src/core/meta.ts
function parseMeta(html, pageUrl) {
  const head = html.slice(0, 6e5);
  const metas = /* @__PURE__ */ new Map();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop");
    const content = attr(tag, "content");
    if (key && content && !metas.has(key.toLowerCase())) metas.set(key.toLowerCase(), decode(content));
  }
  const ld = jsonLdProduct(head);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = clean(metas.get("og:title") ?? metas.get("twitter:title") ?? ld?.name ?? (titleTag && decode(titleTag)));
  const image = absHttps(metas.get("og:image") ?? metas.get("og:image:url") ?? metas.get("twitter:image") ?? ld?.image, pageUrl);
  const rawPrice = metas.get("product:price:amount") ?? metas.get("og:price:amount") ?? metas.get("price") ?? ld?.price;
  const priceCents = rawPrice !== void 0 ? parseAmount(String(rawPrice)) ?? void 0 : void 0;
  const currency = (metas.get("product:price:currency") ?? metas.get("og:price:currency") ?? ld?.currency)?.toUpperCase();
  let store = clean(metas.get("og:site_name"));
  let url = absHttps(metas.get("og:url"), pageUrl) ?? pageUrl;
  const amazon = amazonInfo(pageUrl) ?? amazonInfo(url);
  if (amazon) {
    url = amazon.canonical;
    store ??= "Amazon";
  }
  store ??= hostLabel(pageUrl);
  return { title, image, priceCents, currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : void 0, store, url };
}
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? m[2] ?? m[3] ?? m[4] : void 0;
}
var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 1114112 ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}
var clean = (s) => {
  const t = s?.replace(/\s+/g, " ").trim().slice(0, 200);
  return t || void 0;
};
function absHttps(src, base) {
  if (typeof src !== "string" || !src) return void 0;
  try {
    const u = new URL(decode(src), base);
    return u.protocol === "https:" ? u.href : void 0;
  } catch {
    return void 0;
  }
}
function hostLabel(pageUrl) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return void 0;
  }
}
function jsonLdProduct(html) {
  const blocks = html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const body = block.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    const product = findProduct(data, 0);
    if (product) return product;
  }
  return void 0;
}
var isObj = (v) => typeof v === "object" && v !== null;
function findProduct(node, depth) {
  if (depth > 5) return void 0;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n, depth + 1);
      if (p) return p;
    }
    return void 0;
  }
  if (!isObj(node)) return void 0;
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Product")) {
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const offer = isObj(offers) ? offers : void 0;
    const price = offer?.price ?? offer?.lowPrice;
    const img = Array.isArray(node.image) ? node.image[0] : node.image;
    return {
      name: typeof node.name === "string" ? node.name : void 0,
      image: typeof img === "string" ? img : isObj(img) && typeof img.url === "string" ? img.url : void 0,
      price: typeof price === "string" || typeof price === "number" ? price : void 0,
      currency: typeof offer?.priceCurrency === "string" ? offer.priceCurrency : void 0
    };
  }
  return findProduct(node["@graph"], depth + 1);
}
export {
  parseMeta
};
