// Descarga segura de una página: resuelve el DNS una vez, comprueba la IP y conecta a ESA IP (sin segunda
// resolución que se pueda cambiar por detrás: DNS rebinding). Redirecciones a mano, revalidadas una a una.
import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import zlib from 'node:zlib';
import { checkUrl, isBlockedIp, UnfurlError } from './guard.mjs';

export const LIMITS = { timeoutMs: 6000, maxBytes: 1_500_000, maxRedirects: 3 };
const UA = 'LazoBot/1.0 (+https://github.com/BertMarti/lazo; vista previa de enlaces)';

/** `lookup` para http.request que nunca devuelve una IP bloqueada. */
export function safeLookup(resolve = dnsLookup) {
  return (hostname, options, cb) => {
    resolve(hostname, { ...options, all: true }, (err, addrs) => {
      if (err) return cb(err);
      const list = Array.isArray(addrs) ? addrs : [{ address: addrs, family: options?.family || 4 }];
      if (list.length === 0 || list.some((a) => isBlockedIp(a.address))) return cb(new UnfurlError('blocked'));
      if (options?.all) return cb(null, list);
      cb(null, list[0].address, list[0].family);
    });
  };
}

/** Descarga una página HTML con todos los límites. `opts.lookup` y `opts.allowPrivate` (solo la primera URL) existen para los tests. */
export async function safeFetch(rawUrl, opts = {}) {
  let url = opts.allowPrivate ? new URL(rawUrl) : checkUrl(rawUrl);
  const deadline = Date.now() + (opts.timeoutMs ?? LIMITS.timeoutMs);
  for (let hop = 0; ; hop++) {
    const res = await once(url, deadline, opts);
    if (res.redirect) {
      if (hop >= LIMITS.maxRedirects) throw new UnfurlError('too_many_redirects');
      // Las redirecciones SIEMPRE se revalidan con las reglas reales (también en los tests).
      url = checkUrl(new URL(res.redirect, url).href);
      opts = { ...opts, allowPrivate: false };
      continue;
    }
    return { url: url.href, html: res.body };
  }
}

/** Una sola petición GET, sin seguir redirecciones: `{redirect}` o `{body, truncated?}`. */
export function once(url, deadline, opts) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new UnfurlError('timeout'));
    const req = mod.request(
      url,
      {
        method: 'GET',
        lookup: opts.allowPrivate ? undefined : (opts.lookup ?? safeLookup(opts.dns)),
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'es-ES,es;q=0.9' },
        timeout: remaining,
        maxHeaderSize: 32 * 1024,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new UnfurlError(`http_${status}`));
        }
        const type = String(res.headers['content-type'] ?? '');
        if (!/^(text\/html|application\/xhtml\+xml)/i.test(type)) {
          res.resume();
          return reject(new UnfurlError('not_html'));
        }
        const max = opts.maxBytes ?? LIMITS.maxBytes;
        // Amazon comprime aunque no pidamos compresión: se descomprime en flujo y el tope cuenta los bytes YA
        // descomprimidos (sin bomba de descompresión).
        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const unzip = { gzip: zlib.createGunzip, 'x-gzip': zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress }[enc];
        if (enc && enc !== 'identity' && !unzip) {
          res.resume();
          return reject(new UnfurlError('not_html'));
        }
        const body = unzip ? res.pipe(unzip()) : res;
        let size = 0;
        const chunks = [];
        // Suficiente: los metadatos están en la cabecera. Cortamos y nos quedamos con lo leído.
        const corta = () => {
          res.destroy();
          if (body !== res) body.destroy();
          resolve({ body: Buffer.concat(chunks).toString('utf8'), truncated: true });
        };
        // V-43: lo recibido, aún comprimido, tiene el mismo tope: un gzip que no produce salida no espera al plazo.
        let crudo = 0;
        if (unzip) res.on('data', (c) => (crudo += c.length) > max && corta());
        body.on('data', (c) => {
          size += c.length;
          if (size > max) {
            chunks.push(c.subarray(0, c.length - (size - max)));
            return corta();
          }
          chunks.push(c);
        });
        body.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
        body.on('error', () => reject(new UnfurlError('network')));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new UnfurlError('timeout')));
    // Tiempo TOTAL (auditoría G-8): `timeout` solo mide inactividad; un byte cada 5 s no debe retenernos.
    const kill = setTimeout(() => req.destroy(new UnfurlError('timeout')), remaining);
    req.on('close', () => clearTimeout(kill));
    req.on('error', (e) => reject(e instanceof UnfurlError ? e : new UnfurlError('network')));
    req.end();
  });
}
