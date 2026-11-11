// Servicio interno «unfurl»: solo lo llama PocketBase (red interna de Docker) con una clave compartida.
// POST /unfurl {"url": "..."} → {"title","image","priceCents","currency","store","url"}
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { safeFetch } from './fetch.mjs';
import { UnfurlError } from './guard.mjs';
import { parseMeta } from './meta.mjs';

const KEY = process.env.UNFURL_KEY ?? '';
const PORT = Number(process.env.PORT ?? 8787);
if (KEY.length < 32) {
  console.error('Falta UNFURL_KEY (al menos 32 caracteres).');
  process.exit(1);
}

const sameKey = (got) => {
  const a = Buffer.from(String(got ?? ''));
  const b = Buffer.from(KEY);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function unfurl(url, opts) {
  const page = await safeFetch(url, opts);
  return parseMeta(page.html, page.url);
}

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/unfurl') return send(404, { error: 'not_found' });
  if (!sameKey(req.headers['x-lazo-key'])) return send(401, { error: 'unauthorized' });
  let raw = '';
  for await (const c of req) {
    raw += c;
    if (raw.length > 4096) return send(413, { error: 'too_large' });
  }
  try {
    const { url } = JSON.parse(raw);
    send(200, await unfurl(url));
  } catch (e) {
    send(e instanceof UnfurlError ? 422 : 400, { error: e instanceof UnfurlError ? e.code : 'bad_request' });
  }
});
server.requestTimeout = 10_000;
server.listen(PORT, () => console.log(`unfurl escuchando en :${PORT}`));
