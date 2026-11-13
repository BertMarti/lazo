// Lectura automática de una lista de deseos de amazon.es (camino a). Solo existe con AMAZON_IMPORT=on.
// Del cliente solo llega el identificador (o el código de un amzn.eu/d/…): las URL las construye este archivo.
// Requisitos: AMZ-1 a AMZ-8 y AMZ-12 a AMZ-14 de docs/security/AUDIT.md.
import { once } from './fetch.mjs';
import { UnfurlError } from './guard.mjs';
import { AMZ_SERVIDOR, CODIGO_CORTO, ID_LISTA, esBloqueo, idDeUrl, listaUrl, paginaUrl, parsePaginaLista } from './amazon.mjs';

export const AMZ = { ...AMZ_SERVIDOR, msPagina: 6000, msTotal: 60_000, pausa: [1000, 2000], saltos: 2, bloqueoMs: 3_600_000, paginasHora: 60 };

/** Códigos que salen de aquí: un conjunto cerrado, nunca HTML, cabeceras ni la URL final (AMZ-13). */
export const BLOQUEA = 'AMAZON_BLOQUEA';

const state = { enCurso: false, bloqueadoHasta: 0, paginas: [] };
/** Solo para las pruebas. */
export const _reset = () => Object.assign(state, { enCurso: false, bloqueadoHasta: 0, paginas: [] });

const fallo = (code) => new UnfurlError(code);

/** Lo que Amazon contesta cuando no quiere robots: corta y salta el cortacircuitos (V-42: también el 403). */
const BLOQUEOS = new Set(['http_403', 'http_429', 'http_503']);

/** V-42: como mucho 60 peticiones de lista por hora en todo el servidor, las pida quien las pida. En memoria. */
function cuentaPagina(now) {
  const t = now();
  state.paginas = state.paginas.filter((p) => t - p < AMZ.bloqueoMs);
  if (state.paginas.length >= AMZ.paginasHora) throw fallo('rate_limited');
  state.paginas.push(t);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** AMZ-3: https, host exacto www.amazon.es, sin puerto ni credenciales y ruta de listas. */
function permitida(u) {
  return u.protocol === 'https:' && u.hostname === 'www.amazon.es' && !u.port && !u.username && !u.password && u.pathname.startsWith('/hz/wishlist/');
}

/** Una página con sus redirecciones revalidadas. Cualquier bloqueo corta la importación. */
async function pagina(url, opts, deadline) {
  // `dns` solo existe para las pruebas: va DEBAJO de safeLookup, que sigue rechazando las IP privadas (AMZ-5).
  const get = opts.get ?? ((u, d) => once(u, d, { maxBytes: AMZ.bytesPagina, dns: opts.dns }));
  let u = new URL(url);
  for (let hop = 0; ; hop++) {
    cuentaPagina(opts.now ?? Date.now);
    let res;
    try {
      res = await get(u, Math.min(deadline, Date.now() + AMZ.msPagina));
    } catch (e) {
      if (BLOQUEOS.has(e?.code)) throw fallo(BLOQUEA);
      if (e?.code === 'http_404') throw fallo('not_a_list');
      throw fallo(e?.code === 'timeout' ? 'timeout' : 'error');
    }
    if (!res.redirect) {
      if (esBloqueo(res.body)) throw fallo(BLOQUEA);
      return res;
    }
    let next;
    try {
      next = new URL(res.redirect, u);
    } catch {
      throw fallo('error');
    }
    if (next.pathname.startsWith('/errors/validateCaptcha')) throw fallo(BLOQUEA);
    if (next.hostname === 'www.amazon.es' && next.pathname.startsWith('/ap/signin')) throw fallo('private_list');
    if (!permitida(next) || hop >= AMZ.saltos) throw fallo('error');
    u = next;
  }
}

/**
 * Lee la lista `id` (solo «No comprados»): como mucho 10 páginas y 200 productos, una pausa de 1 a 2 s entre páginas,
 * sin cookies ni reintentos. `opts.get` y `opts.sleep` existen para las pruebas.
 */
export async function leeLista(id, opts = {}) {
  if (typeof id !== 'string' || !ID_LISTA.test(id)) throw fallo('not_a_list');
  const now = opts.now ?? Date.now;
  // AMZ-8: tras un captcha, nadie vuelve a tocar Amazon durante una hora.
  if (now() < state.bloqueadoHasta) throw fallo(BLOQUEA);
  if (state.enCurso) throw fallo('busy'); // AMZ-12: una lectura a la vez en todo el servidor
  state.enCurso = true;
  const deadline = Date.now() + AMZ.msTotal;
  const productos = [];
  const seen = new Set();
  const tokens = new Set();
  let partial = false;
  try {
    let url = listaUrl(id);
    for (let n = 0; n < AMZ.paginas; n++) {
      if (n > 0) await (opts.sleep ?? sleep)(AMZ.pausa[0] + Math.floor(Math.random() * (AMZ.pausa[1] - AMZ.pausa[0])));
      if (Date.now() >= deadline) {
        partial = true;
        break;
      }
      let res;
      try {
        res = await pagina(url, opts, deadline);
      } catch (e) {
        if (e.code === BLOQUEA) state.bloqueadoHasta = now() + AMZ.bloqueoMs;
        if (n === 0 || e.code === BLOQUEA) throw e;
        partial = true; // la primera página ya está: devolvemos lo leído
        break;
      }
      if (res.truncated) partial = true;
      const { productos: nuevos, token } = parsePaginaLista(res.body, id);
      let alguno = false;
      for (const p of nuevos) {
        if (seen.has(p.asin)) continue;
        if (productos.length >= AMZ.productos) {
          partial = true;
          break;
        }
        seen.add(p.asin);
        productos.push(p);
        alguno = true;
      }
      // Fin: no hay «ver más», la página no aporta nada nuevo, el testigo se repite o ya hay 200.
      if (!token || !alguno || tokens.has(token) || productos.length >= AMZ.productos) break;
      if (n === AMZ.paginas - 1) partial = true;
      tokens.add(token);
      url = paginaUrl(id, token);
    }
  } finally {
    state.enCurso = false;
  }
  if (!productos.length) throw fallo('empty');
  return partial ? { productos, partial } : { productos };
}

/**
 * AMZ-4: `https://amzn.eu/d/<código>` → identificador de lista. Solo se siguen redirecciones dentro de amzn.eu (sin
 * leer cuerpos); en cuanto una apunta a una lista de amazon.es se para: esa página no se pide aquí.
 */
export async function resuelveCorto(codigo, opts = {}) {
  if (typeof codigo !== 'string' || !CODIGO_CORTO.test(codigo)) throw fallo('not_a_list');
  const now = opts.now ?? Date.now;
  // V-40: el acortador también respeta (y fija) el cortacircuitos de una hora.
  if (now() < state.bloqueadoHasta) throw fallo(BLOQUEA);
  const get = opts.get ?? ((u, d) => once(u, d, { maxBytes: 1, dns: opts.dns }));
  let u = new URL(`https://amzn.eu/d/${codigo}`);
  const deadline = Date.now() + AMZ.msPagina;
  for (let hop = 0; hop < 4; hop++) {
    let res;
    try {
      res = await get(u, deadline);
    } catch (e) {
      if (BLOQUEOS.has(e?.code)) {
        state.bloqueadoHasta = now() + AMZ.bloqueoMs;
        throw fallo(BLOQUEA);
      }
      throw fallo('not_a_list');
    }
    if (!res.redirect) throw fallo('not_a_list');
    let next;
    try {
      next = new URL(res.redirect, u);
    } catch {
      throw fallo('not_a_list');
    }
    const id = idDeUrl(next.href);
    if (id) return id;
    // Un producto u otra página de Amazon no se visita: solo se sigue dentro del propio acortador.
    if (next.protocol !== 'https:' || next.port || next.username || next.password || next.hostname !== 'amzn.eu') throw fallo('not_a_list');
    u = next;
  }
  throw fallo('not_a_list');
}
