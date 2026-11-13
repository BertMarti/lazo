// Servicio interno «unfurl»: solo lo llama PocketBase (red interna de Docker) con una clave compartida.
// POST /unfurl {"url": "..."} → {"title","image","priceCents","currency","store","url"}
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { safeFetch } from './fetch.mjs';
import { UnfurlError } from './guard.mjs';
import { parseMeta } from './meta.mjs';
import { leeLista, resuelveCorto } from './wishlist.mjs';

export async function unfurl(url, opts) {
  const page = await safeFetch(url, opts);
  return parseMeta(page.html, page.url);
}

/** El servidor HTTP sin arrancar: las pruebas lo crean con su clave y con la importación encendida o apagada. */
export function servidor({ key, amazon }) {
  const sameKey = (got) => {
    const a = Buffer.from(String(got ?? ''));
    const b = Buffer.from(key);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    // AMZ-1: sin AMAZON_IMPORT=on, /wishlist y /amzn no existen.
    const conAmazon = amazon && (req.url === '/wishlist' || req.url === '/amzn');
    if (req.method !== 'POST' || (req.url !== '/unfurl' && !conAmazon)) return send(404, { error: 'not_found' });
    if (!sameKey(req.headers['x-lazo-key'])) return send(401, { error: 'unauthorized' });
    let raw = '';
    for await (const c of req) {
      raw += c;
      if (raw.length > 4096) return send(413, { error: 'too_large' });
    }
    try {
      const body = JSON.parse(raw);
      if (req.url === '/wishlist') return send(200, await leeLista(body.id));
      if (req.url === '/amzn') return send(200, { id: await resuelveCorto(body.corto) });
      send(200, await unfurl(body.url));
    } catch (e) {
      send(e instanceof UnfurlError ? 422 : 400, { error: e instanceof UnfurlError ? e.code : 'bad_request' });
    }
  });
  server.requestTimeout = 90_000; // la lista puede tardar hasta 60 s (10 páginas con pausas)
  return server;
}

if (import.meta.main) {
  const KEY = process.env.UNFURL_KEY ?? '';
  if (KEY.length < 32) {
    console.error('Falta UNFURL_KEY (al menos 32 caracteres).');
    process.exit(1);
  }
  const PORT = Number(process.env.PORT ?? 8787);
  servidor({ key: KEY, amazon: process.env.AMAZON_IMPORT === 'on' }).listen(PORT, () => console.log(`unfurl escuchando en :${PORT}`));
}
