// Lista de Amazon desde el servidor (camino a, docs/legal/AMAZON.md). Solo con AMAZON_IMPORT=on.
// Escrito a mano. Lo usan las rutas de amazon.pb.js (cada manejador se ejecuta aislado: se carga con require()).

const MSG = {
  NO_ES_LISTA: [422, 'Ese enlace no es una lista de deseos de Amazon.'],
  LISTA_PRIVADA: [422, 'Esa lista no es pública. En Amazon, toca «Invitar» → «Solo ver» → «Copiar enlace» y pega ese enlace.'],
  VACIA: [422, 'No encuentro productos sin comprar en esa lista.'],
  AMAZON_BLOQUEA: [503, 'Amazon no deja leer la lista ahora mismo. Prueba dentro de un rato.'],
  OCUPADO: [429, 'Ya se está leyendo otra lista. Prueba en un minuto.'],
  LIMITE: [429, 'Ya has leído tu lista varias veces en la última hora. Prueba más tarde.'],
  ERROR: [502, 'No hemos podido leer la lista. Prueba otra vez o copia y pega la página.'],
};
// Códigos del servicio → los del cliente. Lo demás (blocked, network, http_*…) es el mismo ERROR (AMZ-13).
const CODES = { not_a_list: 'NO_ES_LISTA', private_list: 'LISTA_PRIVADA', empty: 'VACIA', AMAZON_BLOQUEA: 'AMAZON_BLOQUEA', busy: 'OCUPADO' };

/** Respuesta de error de un conjunto cerrado: `{code, message}`, nunca HTML ni la URL de Amazon. */
function fail(e, code) {
  const [status, message] = MSG[code] || MSG.ERROR;
  return e.json(status, { code: MSG[code] ? code : 'ERROR', message });
}

const enabled = () => $os.getenv('AMAZON_IMPORT') === 'on';

/**
 * Comprobaciones comunes. Apagado: 404 con y sin sesión (AMZ-1). Encendido: sesión de `users` y miembro de algún
 * grupo, como /api/lazo/unfurl. Devuelve null si se puede seguir, o la respuesta de error.
 */
function guard(app, e) {
  if (!enabled()) throw new NotFoundError();
  if (!e.auth || e.auth.collection().name !== 'users') throw new UnauthorizedError('Entra con tu enlace de invitación.');
  try {
    app.findFirstRecordByFilter('groups', 'members.id ?= {:me}', { me: e.auth.id });
  } catch {
    throw new ForbiddenError('Únete a un grupo primero.');
  }
}

/** POST al servicio interno. El identificador va en el cuerpo, nunca en la URL (AMZ-14). */
function call(path, body, timeout) {
  try {
    const res = $http.send({
      url: ($os.getenv('UNFURL_URL') || 'http://unfurl:8787') + path,
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-lazo-key': $os.getenv('UNFURL_KEY') },
      timeout,
    });
    if (res.statusCode === 200) return { json: res.json };
    return { code: CODES[(res.json && res.json.error) || ''] || 'ERROR' };
  } catch {
    return { code: 'ERROR' };
  }
}

/**
 * Límite por persona: 5 lecturas por hora (en casa toda la familia sale por la misma IP, así que el de PocketBase,
 * por IP, es solo la red de seguridad). ponytail: en memoria; se reinicia con PocketBase.
 */
const PER_HOUR = 5;
function allow(app, userId) {
  const key = `amz:${userId}`;
  const now = Date.now();
  // Se guarda como texto: un array de JS no vuelve como array a otro manejador.
  const recent = JSON.parse(app.store().get(key) || '[]').filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) return false;
  recent.push(now);
  app.store().set(key, JSON.stringify(recent));
  return true;
}

module.exports = { enabled, guard, call, fail, allow };
