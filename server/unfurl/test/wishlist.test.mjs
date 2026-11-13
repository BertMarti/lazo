// Lectura de listas de Amazon (camino a) sin red: `get` falso que hace de amazon.es con las fixtures ficticias.
// Necesita `npm run build:server` (amazon.mjs). La ruta HTTP y AMAZON_IMPORT: server/test/amazon.test.mjs.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import http from 'node:http';
import { AMZ, BLOQUEA, _reset, leeLista, resuelveCorto } from '../wishlist.mjs';
import { once } from '../fetch.mjs';

const fx = (n) => readFileSync(new URL(`../../../test/fixtures/amazon-lista-servidor/${n}`, import.meta.url), 'utf8');
const LID = 'LAZOTEST00001';
const P1 = fx('pagina-1.html');
const P2 = fx('pagina-2.html');
const noSleep = { sleep: async () => {} };

/** Un Amazon de mentira: responde por orden y apunta cada URL pedida. */
function fake(...answers) {
  const urls = [];
  const get = async (u) => {
    urls.push(u.href);
    const a = answers.length > 1 ? answers.shift() : answers[0];
    if (a instanceof Error) throw a;
    return typeof a === 'function' ? a(u) : a;
  };
  return { urls, get };
}
const err = (code) => Object.assign(new Error(code), { code });

beforeEach(() => _reset());

test('solo un identificador válido: sin red para lo demás', async () => {
  for (const id of ['', 'corto', 'https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001', 'lazotest00001', '../../x/LAZOTEST', 'LAZOTEST00001?x=1', 'A'.repeat(17), 42, null]) {
    const f = fake({ body: P1 });
    await assert.rejects(() => leeLista(id, { get: f.get, ...noSleep }), { code: 'not_a_list' }, String(id));
    assert.equal(f.urls.length, 0);
  }
});

test('construye la URL de «No comprados» y la de «ver más» con el testigo y su propia lista', async () => {
  const f = fake({ body: P1 }, { body: P2 });
  let pausas = 0;
  const r = await leeLista(LID, { get: f.get, sleep: async (ms) => { assert.ok(ms >= 1000 && ms <= 2000); pausas++; } });
  assert.equal(r.productos.length, 13);
  assert.equal(r.partial, undefined);
  assert.equal(pausas, 1);
  assert.deepEqual(f.urls, [
    'https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001?filter=unpurchased',
    'https://www.amazon.es/hz/wishlist/slv/items?filter=unpurchased&paginationToken=ESHV2_LAZOFICTICIO2AAAAAAAAAQDwfalsoTESTIGOdePAGINA2-_x&itemsLayout=LIST&sort=date-added&type=wishlist&lid=LAZOTEST00001',
  ]);
  assert.ok(r.productos.every((p) => /^https:\/\/www\.amazon\.es\/dp\/[A-Z0-9]{10}$/.test(p.url)));
  // Solo lo de AMZ-11 (y prioridad/cantidad): ni HTML, ni la URL de la lista, ni lo comprado.
  assert.ok(!JSON.stringify(r).includes(LID));
  assert.ok(!JSON.stringify(r).includes('<'));
});

test('como mucho 10 páginas y 200 productos', async () => {
  // Cada página trae 30 productos nuevos y otro testigo: se corta en 200 (7 páginas).
  let n = 0;
  const pagina = () => {
    n++;
    const items = Array.from({ length: 30 }, (_, i) => `<li data-itemId="I${n}x${i}" data-price="1.00"><a id="itemName_I${n}x${i}" title="Producto ${n}-${i}" href="/dp/B0${String(n * 100 + i).padStart(8, '0')}/">x</a></li>`).join('');
    return { body: `${items}<input type="hidden" name="showMoreUrl" value="/hz/wishlist/slv/items?paginationToken=T${n}&amp;lid=${LID}"/>` };
  };
  const f = fake(pagina);
  const r = await leeLista(LID, { get: f.get, ...noSleep });
  assert.equal(r.productos.length, AMZ.productos);
  assert.equal(r.partial, true);
  assert.equal(f.urls.length, 7);

  // Páginas de 1 producto: se corta en 10 peticiones.
  _reset();
  n = 0;
  const una = () => {
    n++;
    return { body: `<li data-itemId="I${n}"><a id="itemName_I${n}" title="P ${n}" href="/dp/B0${String(n).padStart(8, '0')}/">x</a></li><input type="hidden" name="showMoreUrl" value="/hz/wishlist/slv/items?paginationToken=T${n}&amp;lid=${LID}"/>` };
  };
  const g = fake(una);
  const r2 = await leeLista(LID, { get: g.get, ...noSleep });
  assert.equal(g.urls.length, AMZ.paginas);
  assert.equal(r2.productos.length, 10);
  assert.equal(r2.partial, true);
});

test('captcha (200, 503 o redirección): AMAZON_BLOQUEA tras una petición, y una hora sin tocar Amazon', async () => {
  for (const answer of [{ body: fx('captcha.html') }, err('http_503'), err('http_429'), { redirect: '/errors/validateCaptcha?amzn=x' }]) {
    _reset();
    const f = fake(answer);
    await assert.rejects(() => leeLista(LID, { get: f.get, ...noSleep }), { code: BLOQUEA });
    assert.equal(f.urls.length, 1);
    const g = fake({ body: P1 });
    await assert.rejects(() => leeLista(LID, { get: g.get, ...noSleep }), { code: BLOQUEA });
    assert.equal(g.urls.length, 0, 'cortacircuitos: ninguna conexión');
    const later = fake({ body: P2 });
    const r = await leeLista(LID, { get: later.get, now: () => Date.now() + AMZ.bloqueoMs + 1, ...noSleep });
    assert.equal(r.productos.length, 3);
  }
});

test('captcha en la segunda página: también se para y se bloquea', async () => {
  const f = fake({ body: P1 }, { body: fx('captcha.html') });
  await assert.rejects(() => leeLista(LID, { get: f.get, ...noSleep }), { code: BLOQUEA });
  assert.equal(f.urls.length, 2);
});

test('redirecciones: solo dentro de www.amazon.es/hz/wishlist; inicio de sesión = lista privada', async () => {
  for (const [to, code] of [
    ['https://evil.example/', 'error'],
    ['https://amazon.es/hz/wishlist/ls/LAZOTEST00001', 'error'],
    ['http://www.amazon.es/hz/wishlist/ls/LAZOTEST00001', 'error'],
    ['https://www.amazon.es:8443/hz/wishlist/ls/LAZOTEST00001', 'error'],
    ['https://www.amazon.es/gp/redirect.html?location=http://192.168.1.1/', 'error'],
    ['http://169.254.169.254/', 'error'],
    ['https://www.amazon.es/ap/signin?openid.return_to=x', 'private_list'],
  ]) {
    const f = fake({ redirect: to });
    await assert.rejects(() => leeLista(LID, { get: f.get, ...noSleep }), { code }, to);
    assert.equal(f.urls.length, 1, to);
  }
  const ok = fake({ redirect: '/hz/wishlist/ls/LAZOTEST00001?filter=unpurchased&x=1' }, { body: P2 });
  assert.equal((await leeLista(LID, { get: ok.get, ...noSleep })).productos.length, 3);
  const loop = fake({ redirect: '/hz/wishlist/ls/LAZOTEST00001' });
  await assert.rejects(() => leeLista(LID, { get: loop.get, ...noSleep }), { code: 'error' });
  assert.equal(loop.urls.length, AMZ.saltos + 1);
});

test('una página que no es una lista da `empty`; el fallo de una página posterior devuelve lo leído', async () => {
  await assert.rejects(() => leeLista(LID, { get: fake({ body: '<html>hola</html>' }).get, ...noSleep }), { code: 'empty' });
  _reset();
  const r = await leeLista(LID, { get: fake({ body: P1 }, err('timeout')).get, ...noSleep });
  assert.equal(r.productos.length, 10);
  assert.equal(r.partial, true);
});

test('un testigo repetido o de otra lista termina la lectura', async () => {
  const f = fake({ body: P1 }, { body: P1 });
  const r = await leeLista(LID, { get: f.get, ...noSleep });
  assert.equal(f.urls.length, 2); // la segunda no aporta nada nuevo
  assert.equal(r.productos.length, 10);
  _reset();
  const h = fake({ body: fx('hostil.html') });
  const r2 = await leeLista(LID, { get: h.get, ...noSleep });
  assert.equal(h.urls.length, 1);
  assert.ok(r2.productos.every((p) => p.image === undefined && p.title.length <= 200));
});

test('una lectura a la vez en todo el servidor', async () => {
  let release;
  const slow = { get: () => new Promise((r) => (release = () => r({ body: P2 }))), ...noSleep };
  const first = leeLista(LID, slow);
  await assert.rejects(() => leeLista(LID, { get: fake({ body: P2 }).get, ...noSleep }), { code: 'busy' });
  release();
  assert.equal((await first).productos.length, 3);
});

test('enlace corto: solo redirecciones dentro de amzn.eu, sin visitar la lista', async () => {
  const f = fake({ redirect: 'https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001?ref_=cm_sw_r_cp_ud_wl' });
  assert.equal(await resuelveCorto('aB3dE5f', { get: f.get }), LID);
  assert.deepEqual(f.urls, ['https://amzn.eu/d/aB3dE5f']);
  const hop = fake({ redirect: '/d/otro123' }, { redirect: 'https://www.amazon.es/hz/wishlist/ls/LAZOTEST00001' });
  assert.equal(await resuelveCorto('aB3dE5f', { get: hop.get }), LID);
  for (const answer of [{ redirect: 'https://www.amazon.es/dp/B0LAZOSV01' }, { redirect: 'https://evil.example/hz/wishlist/ls/LAZOTEST00001' }, { redirect: 'http://amzn.eu/d/x' }, { body: 'x' }, err('network')]) {
    const g = fake(answer);
    await assert.rejects(() => resuelveCorto('aB3dE5f', { get: g.get }), { code: 'not_a_list' });
    assert.equal(g.urls.length, 1);
  }
  for (const bad of ['', '../x', 'a/b', 'x'.repeat(21), 'https://amzn.eu/d/abc']) {
    const g = fake({ redirect: '/' });
    await assert.rejects(() => resuelveCorto(bad, { get: g.get }), { code: 'not_a_list' });
    assert.equal(g.urls.length, 0);
  }
});

test('ninguna cabecera de navegador ni cookie en el servicio', () => {
  for (const f of ['wishlist.mjs', 'fetch.mjs', 'index.mjs']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /Chrome|Safari|Gecko|sec-ch-ua|['"]Cookie['"]|cronAdd/, f);
  }
});

test('las páginas comprimidas se descomprimen con el tope sobre lo descomprimido', async () => {
  const big = Buffer.from('<p>' + 'a'.repeat(5_000_000));
  const s = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
    res.end(gzipSync(req.url === '/big' ? big : Buffer.from(P2)));
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  const small = await once(new URL(base + '/'), Date.now() + 3000, { allowPrivate: true });
  assert.equal(small.body, P2);
  const cut = await once(new URL(base + '/big'), Date.now() + 3000, { allowPrivate: true, maxBytes: AMZ.bytesPagina });
  assert.equal(cut.truncated, true);
  assert.ok(cut.body.length <= AMZ.bytesPagina);
  s.close();
});
