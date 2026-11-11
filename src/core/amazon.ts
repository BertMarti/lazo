/** Reconoce un enlace de Amazon y lo deja limpio (sin parámetros de seguimiento). No hace peticiones. */
export function amazonInfo(raw: string): { asin: string; canonical: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const m = u.hostname.match(/(?:^|\.)amazon\.((?:com?\.)?[a-z]{2,3})$/i);
  if (!m) return null;
  const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  if (!asin) return null;
  return { asin: asin.toUpperCase(), canonical: `https://www.amazon.${m[1]!.toLowerCase()}/dp/${asin.toUpperCase()}` };
}

/** Enlaces cortos (amzn.eu, amzn.to, a.co): hay que seguir la redirección en el servidor. */
export const isAmazonShortLink = (raw: string): boolean => /^https?:\/\/(amzn\.(eu|to)|a\.co)\//i.test(raw);
