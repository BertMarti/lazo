import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { checkUrl, isBlockedIp } from '../guard.mjs';
import { safeFetch, safeLookup } from '../fetch.mjs';

test('IP bloqueadas y permitidas', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '224.0.0.1', 'no-es-ip'])
    assert.equal(isBlockedIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '151.101.1.69', '2a00:1450:4003:80b::200e']) assert.equal(isBlockedIp(ip), false, ip);
});

test('URL rechazadas antes de resolver', () => {
  for (const u of ['ftp://x.example/', 'file:///etc/passwd', 'http://user:pw@x.example/', 'http://x.example:8080/', 'http://127.0.0.1/', 'http://[::1]/', 'http://localhost/', 'http://router.lan/', 'http://nas.local/', 'javascript:alert(1)', 'x'.repeat(3000)])
    assert.throws(() => checkUrl(u), u);
  assert.equal(checkUrl('https://www.amazon.es/dp/B0ABCDEF12').hostname, 'www.amazon.es');
});

test('el lookup rechaza un dominio que resuelve a una IP interna (DNS rebinding)', async () => {
  const fake = (_h, _o, cb) => cb(null, [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.5', family: 4 }]);
  await new Promise((done) => safeLookup(fake)('evil.example', { all: true }, (err) => { assert.equal(err?.code, 'blocked'); done(); }));
  const ok = (_h, _o, cb) => cb(null, [{ address: '93.184.216.34', family: 4 }]);
  await new Promise((done) => safeLookup(ok)('ok.example', {}, (err, addr) => { assert.equal(err, null); assert.equal(addr, '93.184.216.34'); done(); }));
});

/** Servidor local de pruebas. allowPrivate solo existe para poder hablar con él. */
function serve(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler).listen(0, '127.0.0.1', () => resolve({ s, base: `http://127.0.0.1:${s.address().port}` }));
  });
}

test('una redirección a la red interna se rechaza aunque la primera URL sea pública', async () => {
  const { s, base } = await serve((_req, res) => { res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }); res.end(); });
  await assert.rejects(() => safeFetch(base, { allowPrivate: true }), { code: 'blocked' });
  s.close();
});

test('corta las páginas enormes y rechaza lo que no es HTML', async () => {
  const big = 'a'.repeat(3_000_000);
  const { s, base } = await serve((req, res) => {
    if (req.url === '/pdf') { res.writeHead(200, { 'Content-Type': 'application/pdf' }); return res.end('%PDF'); }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<meta property="og:title" content="Hola">${big}`);
  });
  const page = await safeFetch(base + '/', { allowPrivate: true });
  assert.ok(page.html.length <= 1_500_000);
  assert.match(page.html, /og:title/);
  await assert.rejects(() => safeFetch(base + '/pdf', { allowPrivate: true }), { code: 'not_html' });
  s.close();
});

test('tiempo límite', async () => {
  const { s, base } = await serve(() => {});
  await assert.rejects(() => safeFetch(base, { allowPrivate: true, timeoutMs: 300 }), { code: 'timeout' });
  s.closeAllConnections();
  s.close();
});

