import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { codigoCorto, esBloqueo, idDeUrl, listaUrl, paginaUrl, parsePaginaLista } from '../../src/core/amazonServidor';

// Fixtures con la estructura de la página real de amazon.es (leída el 13-11-2026 con LazoBot) y datos ficticios:
// títulos, fotos, ASIN e identificadores inventados. La página real no se guarda (tiene datos de su dueña).
const fx = (name: string) => readFileSync(`test/fixtures/amazon-lista-servidor/${name}`, 'utf8');
const LID = 'LAZOTEST00001';
const URL_OK = /^https:\/\/www\.amazon\.es\/dp\/[A-Z0-9]{10}$/;

describe('lista de Amazon desde el servidor: extractor', () => {
  it('lee la primera página: título, ASIN, enlace limpio, foto, prioridad, cantidad y el testigo de «ver más»', () => {
    const { productos, token } = parsePaginaLista(fx('pagina-1.html'), LID);
    expect(productos).toHaveLength(10);
    expect(productos[0]).toEqual({
      title: 'Cuaderno de bocetos de tapa dura, 120 hojas',
      asin: 'B0LAZOSV01',
      url: 'https://www.amazon.es/dp/B0LAZOSV01',
      image: 'https://m.media-amazon.com/images/I/lazo-ficticia-1._SS135_.jpg',
      priority: 2,
      quantity: 1,
    });
    expect(productos.map((p) => p.priority)).toEqual([2, 1, 1, 3, 3, 2, 1, 1, 3, 3]);
    expect(productos[3]!.priceCents).toBe(1299);
    expect(productos[0]!.priceCents).toBeUndefined(); // data-price="-Infinity": sin precio
    expect(productos[4]!.quantity).toBe(3);
    expect(productos.every((p) => URL_OK.test(p.url!))).toBe(true);
    expect(token).toBe('ESHV2_LAZOFICTICIO2AAAAAAAAAQDwfalsoTESTIGOdePAGINA2-_x');
  });

  it('«Tiene» (lo ya comprado) no se lee nunca', () => {
    const { productos } = parsePaginaLista(fx('pagina-1.html'), LID);
    expect(productos.every((p) => Object.keys(p).every((k) => ['title', 'asin', 'url', 'image', 'priority', 'quantity', 'priceCents'].includes(k)))).toBe(true);
    expect(productos.some((p) => p.quantity === 7)).toBe(false); // «Tiene: 7» en la ficha
  });

  it('el último tramo de «ver más» no trae testigo: fin de la lista', () => {
    const { productos, token } = parsePaginaLista(fx('pagina-2.html'), LID);
    expect(productos.map((p) => p.asin)).toEqual(['B0LAZOSV11', 'B0LAZOSV12', 'B0LAZOSV13']);
    expect(token).toBeUndefined();
  });

  it('títulos, fotos y paginación hostiles salen saneados (AMZ-9 y AMZ-10)', () => {
    const { productos, token } = parsePaginaLista(fx('hostil.html'), LID);
    expect(productos.map((p) => p.title)[0]).toBe('<img src=x onerror=alert(1)> Taza'); // texto literal, React lo pinta como texto
    expect(productos[1]!.title).toBe('&lt;b&gt;negrita&lt;/b&gt;'); // se descodifica una sola vez
    // eslint-disable-next-line no-control-regex -- justo los caracteres de control
    expect(productos[2]!.title).not.toMatch(/[\u0000-\u001f‮]/);
    expect(productos[2]!.title.length).toBeLessThanOrEqual(200);
    expect(productos.every((p) => p.image === undefined)).toBe(true); // http, host parecido y host ajeno: sin foto
    expect(token).toBeUndefined(); // «ver más» de otra lista: no se sigue
  });

  it('3 MB hostiles terminan pronto y dan como mucho 200 filas (AMZ-15)', () => {
    for (const html of [
      '<li '.repeat(750_000),
      '<li data-itemid="X1" '.repeat(150_000),
      'data-itemid="X1"'.repeat(190_000),
      `<li data-itemid="X">${'<a id="itemName_X" '.repeat(100_000)}`,
      `<li data-itemid="X">${'id="itemImage_X"'.repeat(150_000)}`,
      'name="showMoreUrl"'.repeat(160_000),
      Array.from({ length: 5000 }, (_, i) => `<li data-itemId="I${i}" data-price="1"><a id="itemName_I${i}" title="P ${i}" href="/dp/B0${String(i).padStart(8, '0')}/">x</a></li>`).join(''),
    ]) {
      const t = performance.now();
      const { productos } = parsePaginaLista(html, LID);
      expect(performance.now() - t).toBeLessThan(2000) // un retroceso catastrófico tardaría minutos; 500 ms falla en CI lento;
      expect(productos.length).toBeLessThanOrEqual(200);
    }
  });

  it('detecta el captcha de Amazon', () => {
    expect(esBloqueo(fx('captcha.html'))).toBe(true);
    expect(esBloqueo(fx('pagina-1.html'))).toBe(false);
  });
});

describe('lista de Amazon desde el servidor: URL construidas', () => {
  it('la URL de la lista y la de «ver más» las construye el servidor', () => {
    expect(listaUrl(LID)).toBe('https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001?filter=unpurchased');
    const u = new URL(paginaUrl(LID, 'abc_-=%3D'));
    expect(u.origin + u.pathname).toBe('https://www.amazon.es/hz/wishlist/slv/items');
    expect(u.searchParams.get('lid')).toBe(LID);
    expect(u.searchParams.get('filter')).toBe('unpurchased');
    expect(u.searchParams.get('paginationToken')).toBe('abc_-=%3D');
  });

  it('el identificador de la URL final de un enlace corto, solo de amazon.es', () => {
    expect(idDeUrl('https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001?ref_=cm_sw_r_cp_ud')).toBe(LID);
    expect(idDeUrl('/hz/wishlist/ls/LAZOTEST00001')).toBe(LID);
    for (const u of ['https://www.amazon.es.evil.example/hz/wishlist/ls/LAZOTEST00001', 'http://www.amazon.es/hz/wishlist/ls/LAZOTEST00001', 'https://www.amazon.es:444/hz/wishlist/ls/LAZOTEST00001', 'https://www.amazon.com/hz/wishlist/ls/LAZOTEST00001', 'https://www.amazon.es/dp/B000000000'])
      expect(idDeUrl(u)).toBeNull();
  });

  it('el código de un amzn.eu/d/… dentro del texto de compartir', () => {
    expect(codigoCorto('Mira mi lista https://amzn.eu/d/aB3dE5f')).toBe('aB3dE5f');
    expect(codigoCorto('https://amzn.eu/d/aB3dE5f?x=1')).toBe('aB3dE5f');
    expect(codigoCorto('https://amzn.eu.evil.example/d/aB3dE5f')).toBeNull();
    expect(codigoCorto('http://amzn.eu/d/aB3dE5f')).toBeNull();
    expect(codigoCorto('https://amzn.eu/d/../x')).toBeNull();
  });
});
