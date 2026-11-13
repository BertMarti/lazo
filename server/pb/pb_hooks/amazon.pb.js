/// <reference path="../pb_data/types.d.ts" />
// Lista de Amazon leída por el servidor (camino a). Apagada por defecto: AMAZON_IMPORT=on en server/.env.
// Del cliente solo llega el identificador de la lista o el código de un amzn.eu/d/…, nunca una URL libre.
// La respuesta es una vista previa: no lee ni escribe ninguna colección y no deduplica (AMZ-11, LA REGLA).

// ——— ¿Qué tiene encendido este servidor? ———
routerAdd(
  'GET',
  '/api/lazo/capacidades',
  (e) => e.json(200, { amazon: $os.getenv('AMAZON_IMPORT') === 'on' }),
  $apis.requireAuth('users'),
);

// ——— Leer la lista: { id } → { productos, partial? } ———
routerAdd('POST', '/api/lazo/amazon-lista', (e) => {
  const A = require(`${__hooks}/lib/amazon.cjs`);
  A.guard($app, e);
  const id = String(e.requestInfo().body.id || '');
  if (!/^[A-Z0-9]{10,16}$/.test(id)) return A.fail(e, 'NO_ES_LISTA');
  if (!A.allow($app, e.auth.id)) return A.fail(e, 'LIMITE');
  // unfurl tiene 60 s para 10 páginas con pausas; aquí algo más, para no rendirnos antes que él (AMZ-7).
  const r = A.call('/wishlist', { id }, 75);
  if (r.code) return A.fail(e, r.code);
  return e.json(200, r.json);
});

// ——— Enlace corto: { corto } → { id } (solo redirecciones de amzn.eu, sin leer la lista) ———
routerAdd('POST', '/api/lazo/amazon-corto', (e) => {
  const A = require(`${__hooks}/lib/amazon.cjs`);
  A.guard($app, e);
  const corto = String(e.requestInfo().body.corto || '');
  if (!/^[A-Za-z0-9]{4,20}$/.test(corto)) return A.fail(e, 'NO_ES_LISTA');
  // V-40: 30 por persona y hora (cada enlace corto de un producto suelto también pasa por aquí).
  if (!A.allow($app, e.auth.id, 'corto', 30)) return A.fail(e, 'LIMITE');
  const r = A.call('/amzn', { corto }, 10);
  if (r.code) return A.fail(e, r.code);
  return e.json(200, { id: String(r.json.id) });
});
