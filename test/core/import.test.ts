import { describe, expect, it } from 'vitest';
import { guessColumns, rowsToDrafts } from '../../src/core/columns';
import { parseMeta } from '../../src/core/meta';
import { amazonInfo, isAmazonShortLink } from '../../src/core/amazon';

describe('columnas de Excel', () => {
  it('reconoce cabeceras en español con tildes y en inglés', () => {
    expect(guessColumns(['Qué quiero', 'Precio (€)', 'Enlace', 'Talla', 'Notas'])).toEqual({
      title: 0, price: 1, url: 2, size: 3, notes: 4,
    });
    expect(guessColumns(['Product name', 'Price', 'Link', 'Qty', 'Priority'])).toEqual({
      title: 0, price: 1, url: 2, quantity: 3, priority: 4,
    });
  });
  it('convierte filas: precios con coma, filas vacías, enlaces raros y cantidades fuera de rango', () => {
    const map = { title: 0, price: 1, url: 2, quantity: 3, priority: 4 };
    const drafts = rowsToDrafts(
      [
        ['Auriculares', '59,90 €', 'https://tienda.example/a', '2', 'alta'],
        ['', '10', '', '', ''],
        [null, null],
        ['Libro', 19.5, 'javascript:alert(1)', '99', 'baja'],
        ['  Taza  ', 'gratis', undefined, 'x', ''],
      ],
      map,
    );
    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toMatchObject({ title: 'Auriculares', priceCents: 5990, url: 'https://tienda.example/a', quantity: 2, priority: 1 });
    expect(drafts[1]).toMatchObject({ title: 'Libro', priceCents: 1950, url: undefined, quantity: 20, priority: 3 });
    expect(drafts[2]).toMatchObject({ title: 'Taza', priceCents: undefined, quantity: 1, priority: 2 });
  });
  it('no importa más de 300 filas', () => {
    const rows = Array.from({ length: 500 }, (_, i) => [`Regalo ${i}`]);
    expect(rowsToDrafts(rows, { title: 0 })).toHaveLength(300);
  });
});

describe('metadatos de una página', () => {
  it('Open Graph y product:price', () => {
    const html = `<html><head><title>No esto</title>
      <meta property="og:title" content="Mochila &amp; botella">
      <meta content="/img/m.jpg" property="og:image">
      <meta property="product:price:amount" content="34.95"><meta property="product:price:currency" content="eur">
      <meta property="og:site_name" content="Montaña Shop"></head></html>`;
    expect(parseMeta(html, 'https://shop.example/p/1')).toEqual({
      title: 'Mochila & botella', image: 'https://shop.example/img/m.jpg', priceCents: 3495, currency: 'EUR',
      store: 'Montaña Shop', url: 'https://shop.example/p/1',
    });
  });
  it('JSON-LD dentro de @graph con offers en lista', () => {
    const ld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage' }, {
      '@type': ['Product'], name: 'Lámpara', image: [{ url: 'https://cdn.example/l.png' }],
      offers: [{ '@type': 'Offer', price: '1299.00', priceCurrency: 'EUR' }],
    }] };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    expect(parseMeta(html, 'https://www.tienda.example/x')).toMatchObject({
      title: 'Lámpara', image: 'https://cdn.example/l.png', priceCents: 129900, currency: 'EUR', store: 'tienda.example',
    });
  });
  it('sin metadatos usa <title>; ignora JSON roto e imágenes que no son https', () => {
    const html = `<title> Mi   tienda </title><script type="application/ld+json">{roto</script><meta property="og:image" content="http://x.example/a.jpg">`;
    expect(parseMeta(html, 'https://x.example/')).toEqual({ title: 'Mi tienda', image: undefined, priceCents: undefined,
      currency: undefined, store: 'x.example', url: 'https://x.example/' });
  });
  it('Amazon: tienda y enlace canónico', () => {
    const m = parseMeta('<meta name="title" content="Algo">', 'https://www.amazon.es/Algo/dp/B0ABCDEF12/ref=sr_1?tag=x');
    expect(m).toMatchObject({ store: 'Amazon', url: 'https://www.amazon.es/dp/B0ABCDEF12' });
  });
});

describe('Amazon', () => {
  it.each([
    ['https://www.amazon.es/dp/B0ABCDEF12', 'https://www.amazon.es/dp/B0ABCDEF12'],
    ['https://amazon.co.uk/gp/product/b0abcdef12?psc=1', 'https://www.amazon.co.uk/dp/B0ABCDEF12'],
    ['https://www.amazon.com.mx/Cosa/dp/B0ABCDEF12/', 'https://www.amazon.com.mx/dp/B0ABCDEF12'],
  ])('%s', (url, canonical) => expect(amazonInfo(url)?.canonical).toBe(canonical));
  it('no confunde dominios', () => {
    expect(amazonInfo('https://amazon.es.evil.example/dp/B0ABCDEF12')).toBeNull();
    expect(amazonInfo('https://notamazon.es/dp/B0ABCDEF12')).toBeNull();
    expect(isAmazonShortLink('https://amzn.eu/d/abc')).toBe(true);
  });
});
