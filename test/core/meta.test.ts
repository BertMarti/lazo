import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMeta, priceToCents } from '../../src/core/meta';

const fixture = (name: string) => readFileSync(`test/fixtures/tiendas/${name}.html`, 'utf8');

describe('metadatos por tienda (fixtures sin red)', () => {
  it('Amazon.es: meta title sin «Amazon.es», microdatos con precio español y enlace canónico', () => {
    expect(parseMeta(fixture('amazon-es'), 'https://www.amazon.es/Portatil-Ligero/dp/B0CPORT14X/ref=sr_1_3?tag=algo-21')).toEqual({
      title: 'Portátil Ligero 14" 16 GB RAM, 512 GB SSD',
      image: 'https://m.media-amazon.example/images/I/71portatil._AC_SL1500_.jpg',
      priceCents: 129995,
      currency: 'EUR',
      store: 'Amazon',
      url: 'https://www.amazon.es/dp/B0CPORT14X',
    });
  });

  it('El Corte Inglés: JSON-LD Product (salta el BreadcrumbList) y og:site_name', () => {
    expect(parseMeta(fixture('elcorteingles'), 'https://www.elcorteingles.es/electrodomesticos/A12345678-cafetera-barista-pro/?utm_source=x')).toEqual({
      title: 'Cafetera superautomática Barista Pro',
      image: 'https://sgfm.elcorteingles.example/SGFM/dctm/MEDIA03/cafetera_barista_1.jpg',
      priceCents: 34900,
      currency: 'EUR',
      store: 'El Corte Inglés',
      url: 'https://www.elcorteingles.es/electrodomesticos/A12345678-cafetera-barista-pro/',
    });
  });

  it('PcComponentes: AggregateOffer con lowPrice numérico e imagen ImageObject', () => {
    expect(parseMeta(fixture('pccomponentes'), 'https://www.pccomponentes.com/monitor-gaming-27-qhd-165hz')).toEqual({
      title: 'Monitor Gaming 27" QHD 165Hz',
      image: 'https://img.pccomponentes.example/articles/1077/10771234/1-monitor.jpg',
      priceCents: 21990,
      currency: 'EUR',
      store: 'PcComponentes',
      url: 'https://www.pccomponentes.com/monitor-gaming-27-qhd-165hz',
    });
  });

  it('Zara: lista JSON-LD con una oferta por talla', () => {
    expect(parseMeta(fixture('zara'), 'https://www.zara.com/es/es/abrigo-lana-cruzado-p01234567.html?v1=1')).toEqual({
      title: 'ABRIGO LANA CRUZADO',
      image: 'https://static.zara.example/photos/1234567800_1_1_1.jpg',
      priceCents: 11900,
      currency: 'EUR',
      store: 'Zara',
      url: 'https://www.zara.com/es/es/abrigo-lana-cruzado-p01234567.html',
    });
  });

  it('Decathlon: ProductGroup con variantes y priceSpecification, JSON-LD envuelto en comentario', () => {
    expect(parseMeta(fixture('decathlon'), 'https://www.decathlon.es/es/p/mochila-montana-30-l/_/R-p-300001?mc=8888')).toEqual({
      title: 'Mochila de montaña 30 L',
      image: 'https://contents.mediadecathlon.example/p2000001/mochila-30-l.jpg',
      priceCents: 3499,
      currency: 'EUR',
      store: 'Decathlon',
      url: 'https://www.decathlon.es/es/p/mochila-montana-30-l/_/R-p-300001',
    });
  });

  it('una página sin metadatos (bloqueo de robots) no da título: la app pasa a escribirlo a mano', () => {
    expect(parseMeta(fixture('sin-metadatos'), 'https://tienda.example/p/1')).toEqual({
      title: undefined, image: undefined, priceCents: undefined, currency: undefined, store: 'tienda.example', url: 'https://tienda.example/p/1',
    });
  });
});

describe('precios', () => {
  it.each([
    ['1.299,95 €', 129995],
    ['1.299,95 €', 129995],
    ['Desde 19,99€', 1999],
    ['EUR 34.95', 3495],
    ['1,299.95', 129995],
    ['349', 34900],
    [219.9, 21990],
  ])('%s', (raw, cents) => expect(priceToCents(raw)).toBe(cents));
  it('lo que no es un precio', () => {
    expect(priceToCents('Agotado')).toBeNull();
    expect(priceToCents('0')).toBeNull();
  });
  it('microdatos con precio en formato español y moneda deducida del símbolo', () => {
    const html = '<h1 itemprop="name">Lámpara</h1><span class="p" itemprop="price">1.299,95 €</span>';
    expect(parseMeta(html, 'https://tienda.example/l')).toMatchObject({ title: 'Lámpara', priceCents: 129995, currency: 'EUR' });
  });
  it('un precio vacío en JSON-LD no tapa al de los microdatos', () => {
    const ld = { '@type': 'Product', name: 'Taza', offers: { '@type': 'Offer', price: '' } };
    const html = `<script type="application/ld+json">${JSON.stringify(ld)}</script><meta itemprop="price" content="9.90"><meta itemprop="priceCurrency" content="EUR">`;
    expect(parseMeta(html, 'https://tienda.example/t')).toMatchObject({ title: 'Taza', priceCents: 990, currency: 'EUR' });
  });
});
