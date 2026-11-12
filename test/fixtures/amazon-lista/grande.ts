// V11-1: HTML grande y preparado (ficticio) para medir parseListaHtml. Lo usan Vitest y Playwright.
export const hostilAsin = (i: number) => `B0${i.toString(36).toUpperCase().padStart(8, '0')}`;

/** 2 MB de enlaces a /gp/product/ con ASIN distintos, sin fichas marcadas. */
export const hostilEnlaces = () =>
  Array.from({ length: 40_000 }, (_, i) => `<a href="/gp/product/${hostilAsin(i)}">Producto de prueba ${i}</a>`).join('').slice(0, 2_000_000);

/** 2 MB de fichas `data-itemid` anidadas, en bloques de 200 (Chrome no anida más de 512 niveles al analizar). */
export const hostilAnidadas = () =>
  Array.from({ length: 200 }, (_, b) =>
    Array.from({ length: 200 }, (_, i) => `<div data-itemid="${i}"><a id="itemName_${i}" href="/dp/${hostilAsin(b * 200 + i)}">Producto anidado ${i}</a>`).join('') + '</div>'.repeat(200),
  )
    .join('')
    .slice(0, 2_000_000);
