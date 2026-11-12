import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esDuplicado, fotoSegura, limpiaTitulo, listaId, parseListaHtml, parseListaPegada, parseListaTexto, soloEnlace } from '../../src/core/amazonLista';
import { DEMO_AMAZON_HTML, DEMO_AMAZON_LISTA } from '../../src/api/seed';
import { hostilAnidadas, hostilAsin, hostilEnlaces } from '../fixtures/amazon-lista/grande';

// Fixtures escritas a mano (ficticias): test/fixtures/amazon-lista/*.
const fx = (name: string) => readFileSync(`test/fixtures/amazon-lista/${name}`, 'utf8');
const URL_OK = /^https:\/\/www\.amazon\.es\/dp\/[A-Z0-9]{10}$/;

describe('enlace de lista', () => {
  it('reconoce las listas de amazon.es, con o sin www, con parámetros y dentro del texto de compartir', () => {
    expect(listaId('https://www.amazon.es/hz/wishlist/ls/LAZOPRUEBA01?ref_=wl_share')).toBe('LAZOPRUEBA01');
    expect(listaId('amazon.es/hz/wishlist/ls/LAZOPRUEBA01')).toBeNull(); // sin esquema no es un enlace
    expect(listaId('https://amazon.es/hz/wishlist/ls/lazoprueba01/')).toBe('LAZOPRUEBA01');
    expect(listaId('https://www.amazon.es/registry/wishlist/1A2B3C4D5E6F')).toBe('1A2B3C4D5E6F');
    expect(listaId('¡Mira mi lista de Amazon! https://www.amazon.es/hz/wishlist/ls/LAZOPRUEBA01?ref_=wl_share.')).toBe('LAZOPRUEBA01');
  });

  it('no se deja engañar por otros hosts ni otras rutas', () => {
    for (const u of [
      'https://www.amazon.es@evil.example/hz/wishlist/ls/LAZOPRUEBA01',
      'https://www.amazon.es.evil.example/hz/wishlist/ls/LAZOPRUEBA01',
      'https://evil.example/www.amazon.es/hz/wishlist/ls/LAZOPRUEBA01',
      'https://www.amazon.es:8443/hz/wishlist/ls/LAZOPRUEBA01',
      'https://www.amazon.com/hz/wishlist/ls/LAZOPRUEBA01',
      'https://smile.amazon.es/hz/wishlist/ls/LAZOPRUEBA01',
      'https://www.amazon.es/dp/B000000000',
      'https://www.amazon.es/hz/wishlist/ls/..%2F..%2Fx',
      'https://amzn.eu/d/abc123', // corto: no sabemos qué es, y no lo seguimos
    ])
      expect(listaId(u), u).toBeNull();
  });

  it('distingue «solo el enlace» de la página copiada', () => {
    expect(soloEnlace('Echa un vistazo a mi lista https://www.amazon.es/hz/wishlist/ls/LAZOPRUEBA01?ref_=wl_share')).toBe(true);
    expect(soloEnlace(fx('escritorio.txt'))).toBe(false);
  });
});

describe('texto plano copiado', () => {
  it('escritorio (vista de la dueña): título, precio, prioridad y cantidad; sin precio si no está disponible', () => {
    expect(parseListaTexto(fx('escritorio.txt'))).toEqual([
      { title: 'Lámpara de escritorio con brazo articulado y luz cálida', priceCents: 3499, priority: 1, quantity: 2 },
      { title: 'Juego de mesa cooperativo «La isla perdida»', priceCents: 129900, priority: 3, quantity: 1 },
      { title: 'Libro de recetas de cocina de cuchara', priceCents: 1990, priority: 2 },
      { title: 'Calcetines térmicos de lana (pack de 3)', priceCents: 1250, priority: 1 },
    ]);
  });

  it('escritorio (lista compartida, sin «Añadido el»): cada precio cierra una ficha', () => {
    expect(parseListaTexto(fx('escritorio-compartida.txt'))).toEqual([
      { title: 'Taza de cerámica esmaltada hecha a mano', priceCents: 1495 },
      { title: 'Auriculares de diadema plegables', priceCents: 5900 },
      { title: 'Puzle de 1000 piezas: mapa antiguo', priceCents: 2249 },
    ]);
  });

  it('Chrome en Android: precio pegado al «€» y prioridad y cantidad en la misma línea', () => {
    expect(parseListaTexto(fx('android-chrome.txt'))).toEqual([
      { title: 'Lámpara de escritorio con brazo articulado y luz cálida', priceCents: 3499, priority: 1, quantity: 2 },
      { title: 'Juego de mesa cooperativo «La isla perdida»', priceCents: 129900, priority: 3 },
      { title: 'Calcetines térmicos de lana (pack de 3)' },
    ]);
  });

  it('Safari en iOS: espacios duros, tabuladores y espacios sobrantes', () => {
    expect(parseListaTexto(fx('ios-safari.txt'))).toEqual([
      { title: 'Taza de cerámica esmaltada hecha a mano', priceCents: 1495 },
      { title: 'Auriculares de diadema plegables', priceCents: 5900 },
    ]);
  });
});

describe('HTML pegado', () => {
  it('escritorio: fichas con data-itemid, ASIN, enlace construido y fotos solo de Amazon', () => {
    expect(parseListaHtml(fx('escritorio.html'))).toEqual([
      {
        title: 'Lámpara de escritorio con brazo articulado & luz cálida', priceCents: 3499, asin: 'B0ESCLAMP1', url: 'https://www.amazon.es/dp/B0ESCLAMP1',
        image: 'https://m.media-amazon.com/images/I/lampara-ficticia._SS135_.jpg', priority: 1, quantity: 2,
      },
      { title: 'Juego de mesa cooperativo «La isla perdida»', priceCents: 129900, asin: 'B0ESCJUEG2', url: 'https://www.amazon.es/dp/B0ESCJUEG2' },
      { title: 'Calcetines térmicos de lana (pack de 3)', asin: 'B0ESCCALC3', url: 'https://www.amazon.es/dp/B0ESCCALC3', image: 'https://images-na.ssl-images-amazon.com/images/I/calcetines._SS135_.jpg' },
    ]);
  });

  it('Safari en iOS: sin fichas marcadas, por enlaces a /dp/ y su contenedor; el tag de afiliado no pasa', () => {
    expect(parseListaHtml(fx('ios-safari.html'))).toEqual([
      { title: 'Taza de cerámica esmaltada hecha a mano', priceCents: 1495, asin: 'B0IOSTAZA1', url: 'https://www.amazon.es/dp/B0IOSTAZA1', image: 'https://m.media-amazon.com/images/I/taza-ficticia.jpg' },
      { title: 'Auriculares de diadema plegables', priceCents: 5900, asin: 'B0IOSAURI2', url: 'https://www.amazon.es/dp/B0IOSAURI2', image: 'https://images-eu.ssl-images-amazon.com/images/I/auris-ficticio.jpg', priority: 1 },
    ]);
  });

  it('el HTML manda; sin productos en el HTML, vale el texto', () => {
    expect(parseListaPegada(fx('escritorio.txt'), fx('escritorio.html'))[0]?.asin).toBe('B0ESCLAMP1');
    expect(parseListaPegada(fx('escritorio.txt'), '<p>nada</p>')).toHaveLength(4);
  });

  it('AMZ-9 y AMZ-10: títulos en texto plano, enlaces construidos y fotos de la lista cerrada', () => {
    const out = parseListaHtml(fx('hostil.html'));
    expect(out.map((p) => p.asin)).toEqual(['B0HOSTIL01', 'B0HOSTIL06', 'B0HOSTIL07']); // javascript:, data:, //evil, ASIN corto: fuera
    expect(out[0]!.title).toBe('<img src=x onerror=alert(1)> Taza'); // texto, se pinta como texto
    expect(out[1]!.title).toBe('Dirección lanigiro');
    expect(out[2]!.title).not.toMatch(/[\u0000-\u001f]/); // eslint-disable-line no-control-regex
    for (const p of out) {
      expect(p.url).toMatch(URL_OK);
      expect(p.image).toBeUndefined();
    }
    expect(parseListaHtml('<li data-itemid="1"><a id="itemName_1" title="&amp;lt;b&amp;gt;" href="/dp/B0ENTIDAD1"></a></li>')[0]?.title).toBe('&lt;b&gt;'); // una sola vez
  });

  it('fotoSegura solo deja https de los hosts de imágenes de Amazon', () => {
    expect(fotoSegura('https://m.media-amazon.com/images/I/a.jpg')).toBe('https://m.media-amazon.com/images/I/a.jpg');
    for (const u of ['http://m.media-amazon.com/a.jpg', 'https://m.media-amazon.com.evil.example/a.jpg', 'https://evil.example/a.jpg', 'https://m.media-amazon.com:8443/a.jpg', 'https://u:p@m.media-amazon.com/a.jpg', 'javascript:alert(1)', 'x'])
      expect(fotoSegura(u), u).toBeUndefined();
  });

  it('limpiaTitulo corta a 200 y quita controles', () => {
    expect(limpiaTitulo('a'.repeat(5000))).toHaveLength(200);
    expect(limpiaTitulo(' uno\n\tdos‮ ')).toBe('uno dos');
  });
});

describe('AMZ-15: entradas hostiles y topes', () => {
  it.each([
    ['<', '<'.repeat(3_000_000)],
    ['li sin cerrar', '<li data-itemid="'.repeat(200_000)],
    ['espacios', ' '.repeat(3_000_000)],
    ['basura', Array.from({ length: 300_000 }, (_, i) => String.fromCharCode((i * 7919) % 65_000)).join('')],
  ])('%s: termina rápido y con ≤ 100 filas', (_n, s) => {
    const t = performance.now();
    expect(parseListaPegada(s, s).length).toBeLessThanOrEqual(100);
    expect(performance.now() - t).toBeLessThan(500);
  });

  // V11-1: antes era cuadrático (4 000 enlaces tardaban 30 s). Los 500 ms con 2 MB se miden en Chromium
  // (e2e/amazon-lista.spec.ts): aquí happy-dom tarda ~500 ms solo en construir el documento.
  const enlaces = (n: number) => Array.from({ length: n }, (_, i) => `<a href="/gp/product/${hostilAsin(i)}">Producto de prueba ${i}</a>`).join('');
  it.each([
    ['4 000 enlaces a /gp/product/ sueltos', enlaces(4000), 500],
    ['4 000 enlaces a /gp/product/ en un mismo contenedor', `<div><section>${enlaces(4000)}</section></div>`, 500],
    ['2 MB de enlaces a /gp/product/', hostilEnlaces(), 1500],
    ['2 MB de fichas anidadas', hostilAnidadas(), 1500],
  ])('%s: rápido y como mucho 100 filas', (_n, html, ms) => {
    const t = performance.now();
    expect(parseListaHtml(html).length).toBeLessThanOrEqual(100);
    expect(performance.now() - t).toBeLessThan(ms);
  });

  it('como mucho 100 productos', () => {
    const many = Array.from({ length: 150 }, (_, i) => `<li data-itemid="${i}"><a id="itemName_${i}" title="Producto número ${i}" href="/dp/B0${String(i).padStart(8, '0')}"></a></li>`).join('');
    expect(parseListaHtml(many)).toHaveLength(100);
    const text = Array.from({ length: 150 }, (_, i) => `Producto de texto ${i}\n${i + 1},00 €`).join('\n');
    expect(parseListaTexto(text)).toHaveLength(100);
  });
});

describe('enmienda a AMZ-10: prioridad y cantidad sí, «Tiene» y «Comprado» nunca', () => {
  it('«Necesita 2 · Tiene 1» da quantity 2 y ningún otro campo', () => {
    expect(parseListaTexto('Lámpara de escritorio articulada\nAñadido el 3 de noviembre de 2026\nNecesita 2 · Tiene 1')).toEqual([{ title: 'Lámpara de escritorio articulada', quantity: 2 }]);
    expect(parseListaTexto('Lámpara de escritorio articulada\nAñadido el 3 de noviembre de 2026\nTiene 3\nComprado 2')).toEqual([{ title: 'Lámpara de escritorio articulada' }]);
    const html = '<li data-itemid="1"><a id="itemName_1" title="Lámpara de escritorio articulada" href="/dp/B0LAZOLAMP"></a><span>Tiene 4</span><span>Comprado: 3</span></li>';
    expect(parseListaHtml(html)).toEqual([{ title: 'Lámpara de escritorio articulada', asin: 'B0LAZOLAMP', url: 'https://www.amazon.es/dp/B0LAZOLAMP' }]);
  });
});

describe('AMZ-11: duplicados en el cliente, contra lo que se ve', () => {
  it('mismo ASIN o mismo título normalizado', () => {
    const visibles = [{ title: 'TECLADO  mecánico compacto' }, { title: 'Otra cosa', url: 'https://www.amazon.es/Algo/dp/B0ESCJUEG2?tag=x' }];
    expect(esDuplicado({ title: 'Teclado mecanico compacto' }, visibles)).toBe(true);
    expect(esDuplicado({ title: 'Juego distinto', asin: 'B0ESCJUEG2' }, visibles)).toBe(true);
    expect(esDuplicado({ title: 'Nuevo', asin: 'B0ESCLAMP1' }, visibles)).toBe(false);
  });
});

it('la lista de ejemplo de la demo da 8 productos con enlace limpio', () => {
  expect(listaId(DEMO_AMAZON_LISTA)).toBe('LAZODEMO2026X');
  const out = parseListaHtml(DEMO_AMAZON_HTML);
  expect(out).toHaveLength(8);
  expect(out.every((p) => URL_OK.test(p.url!) && p.priceCents)).toBe(true);
});
