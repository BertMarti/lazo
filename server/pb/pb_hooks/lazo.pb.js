/// <reference path="../pb_data/types.d.ts" />
// Endpoints propios de Lazo. Cada manejador se ejecuta aislado: lo compartido va en lib/ y se carga con require().

// ——— Cortafuegos de consultas: nadie (salvo el superusuario) puede filtrar, ordenar ni expandir por relaciones
// inversas (_via_) ni con @collection. Así no se puede sondear «¿tiene reservas este regalo mío?» desde items/lists.
routerUse((e) => {
  if (e.auth && e.auth.isSuperuser()) return e.next();
  let probe;
  try {
    probe = decodeURIComponent(String(e.request.url.rawQuery || '').replace(/\+/g, ' '));
  } catch {
    throw new BadRequestError('Consulta no válida.');
  }
  if (/_via_|@collection/i.test(probe)) throw new ForbiddenError('Consulta no permitida.');
  return e.next();
});

// Tiempo real (auditoría R-1): solo «coleccion/*» o «coleccion/id». Sin ?options= no hay filter, sort ni expand
// que vigilar (PocketBase descodifica las opciones del topic en dos capas que un filtro de texto no ve).
onRealtimeSubscribeRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    for (const s of e.subscriptions) {
      if (!/^[A-Za-z0-9_]+\/(\*|[A-Za-z0-9_]+)$/.test(String(s))) throw new ForbiddenError('Consulta no permitida.');
    }
  }
  e.next();
});

// ——— Grupos: quien crea es dueño, miembro y admin, y tiene su lista ———
onRecordCreateRequest((e) => {
  if (!e.auth || e.auth.collection().name !== 'users') throw new UnauthorizedError('Entra primero.');
  e.record.set('owner', e.auth.id);
  e.record.set('members', [e.auth.id]);
  e.record.set('admins', [e.auth.id]);
  if (!e.record.getString('currency')) e.record.set('currency', 'EUR');
  e.next();
}, 'groups');

// La lista del creador, dentro de la misma transacción (auditoría G-10).
onRecordCreate((e) => {
  e.next();
  const owner = e.app.findRecordById('users', e.record.getString('owner'));
  const list = new Record(e.app.findCollectionByNameOrId('lists'));
  list.set('group', e.record.id);
  list.set('name', owner.getString('name'));
  list.set('user', owner.id);
  e.app.save(list);
}, 'groups');

// ——— Reservas: una unidad cada vez y nunca más de las que hay ———
onRecordCreateRequest((e) => {
  e.record.set('units', 1);
  const item = $app.findRecordById('items', e.record.getString('item'));
  // Antes de mirar nada: el destinatario no puede ni preguntar (no debe saber si «ya está reservado»).
  const list = $app.findRecordById('lists', item.getString('list'));
  if (!e.auth || list.getString('user') === e.auth.id) throw new ForbiddenError('No puedes reservar regalos de tu propia lista.');
  const taken = $app.findRecordsByFilter('claims', 'item = {:item}', '', 0, 0, { item: item.id }).reduce((s, c) => s + c.getInt('units'), 0);
  // ponytail: sin bloqueo; dos reservas simultáneas de la última unidad podrían pasar. El índice único (item, user) limita el daño.
  if (taken >= item.getInt('quantity')) throw new BadRequestError('Alguien se te ha adelantado: ya está reservado.');
  e.next();
}, 'claims');

// ——— Invitar: enlace con token de 192 bits; se guarda solo su hash ———
routerAdd(
  'POST',
  '/api/lazo/invite',
  (e) => {
    const body = e.requestInfo().body;
    const group = $app.findRecordById('groups', String(body.group || ''));
    if (!group.getStringSlice('admins').includes(e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo puede invitar.');
    const token = $security.randomString(32);
    const days = 14;
    const inv = new Record($app.findCollectionByNameOrId('invites'));
    inv.set('group', group.id);
    inv.set('tokenHash', $security.sha256(token));
    inv.set('expiresAt', Date.now() + days * 86400000);
    inv.set('maxUses', 30);
    inv.set('uses', 0);
    inv.set('createdBy', e.auth.id);
    $app.save(inv);
    return e.json(200, { token, expires: new Date(Date.now() + days * 86400000).toISOString() });
  },
  $apis.requireAuth('users'),
);

// ——— Unirse: token de invitación + nombre → cuenta (si no hay) + miembro + su lista ———
routerAdd('POST', '/api/lazo/join', (e) => {
  const body = e.requestInfo().body;
  const token = String(body.token || '');
  const name = String(body.name || '').trim().slice(0, 40);
  const invalid = 'Esta invitación no existe o ha caducado. Pide un enlace nuevo.';
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) throw new BadRequestError(invalid);
  if (!name) throw new BadRequestError('Escribe tu nombre.');
  let invite;
  try {
    invite = $app.findFirstRecordByData('invites', 'tokenHash', $security.sha256(token));
  } catch {
    throw new BadRequestError(invalid);
  }
  if (invite.getBool('revoked') || invite.getInt('expiresAt') < Date.now() || invite.getInt('uses') >= invite.getInt('maxUses')) throw new BadRequestError(invalid);

  const COLORS = ['limon', 'canela', 'menta', 'fresa', 'violeta', 'almendra', 'cielo'];
  let user = e.auth;
  if (user && user.collection().name !== 'users') throw new ForbiddenError('Entra con una cuenta de la familia.');
  $app.runInTransaction((tx) => {
    const inv = tx.findRecordById('invites', invite.id); // releer dentro: dos altas simultáneas no pasan del límite
    if (inv.getBool('revoked') || inv.getInt('expiresAt') < Date.now() || inv.getInt('uses') >= inv.getInt('maxUses')) throw new BadRequestError(invalid);
    const group = tx.findRecordById('groups', invite.getString('group'));
    if (!user) {
      user = new Record(tx.findCollectionByNameOrId('users'));
      user.set('email', 'u-' + $security.randomStringWithAlphabet(24, 'abcdefghijklmnopqrstuvwxyz0123456789') + '@lazo.invalid');
      user.setPassword($security.randomString(48)); // nadie la conoce: se entra con el token
      user.set('name', name);
      user.set('color', COLORS[group.getStringSlice('members').length % COLORS.length]);
      tx.save(user);
    }
    if (!group.getStringSlice('members').includes(user.id)) {
      group.set('members+', user.id);
      tx.save(group);
      const list = new Record(tx.findCollectionByNameOrId('lists'));
      list.set('group', group.id);
      list.set('name', user.getString('name'));
      list.set('user', user.id);
      tx.save(list);
      inv.set('uses', inv.getInt('uses') + 1);
      tx.save(inv);
    }
  });
  return $apis.recordAuthResponse(e, user, 'invite', { group: invite.getString('group') });
});

// ——— Entrar en otro móvil: código de 8 caracteres, 10 minutos, un solo uso ———
routerAdd(
  'POST',
  '/api/lazo/device-code',
  (e) => {
    const code = $security.randomStringWithAlphabet(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    const rec = new Record($app.findCollectionByNameOrId('deviceCodes'));
    rec.set('user', e.auth.id);
    rec.set('codeHash', $security.sha256(code));
    rec.set('expiresAt', Date.now() + 10 * 60000);
    $app.save(rec);
    return e.json(200, { code, minutes: 10 });
  },
  $apis.requireAuth('users'),
);

routerAdd('POST', '/api/lazo/device-claim', (e) => {
  const code = String(e.requestInfo().body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const invalid = 'Ese código no vale o ha caducado. Genera otro en el móvil donde ya tienes Lazo.';
  if (code.length !== 8) throw new BadRequestError(invalid);
  let rec;
  try {
    rec = $app.findFirstRecordByData('deviceCodes', 'codeHash', $security.sha256(code));
  } catch {
    throw new BadRequestError(invalid);
  }
  $app.delete(rec); // un solo uso, también si ha caducado
  if (rec.getInt('expiresAt') < Date.now()) throw new BadRequestError(invalid);
  const user = $app.findRecordById('users', rec.getString('user'));
  return $apis.recordAuthResponse(e, user, 'device');
});

// ——— Amigo invisible: sorteo en el servidor; nadie (ni quien organiza) ve las asignaciones ajenas ———
routerAdd(
  'POST',
  '/api/lazo/draw',
  (e) => {
    const { drawPairs } = require(`${__hooks}/lib/draw.cjs`);
    const body = e.requestInfo().body;
    const group = $app.findRecordById('groups', String(body.group || ''));
    if (!group.getStringSlice('admins').includes(e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo puede sortear.');
    const members = group.getStringSlice('members');
    const participants = (Array.isArray(body.participants) ? body.participants : []).map(String).filter((id) => members.includes(id));
    const exclusions = (Array.isArray(body.exclusions) ? body.exclusions : [])
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map((p) => [String(p[0]), String(p[1])])
      .slice(0, 200);
    // Auditoría G-5: sin exclusiones que dejen un único reparto (quien organiza no puede fijar el sorteo).
    const uniq = [...new Set(participants)];
    const banned = new Set(exclusions.flatMap(([a, b]) => [a + '>' + b, b + '>' + a]));
    const min = Math.min(3, uniq.length - 1);
    if (uniq.some((g) => uniq.filter((r) => r !== g && !banned.has(g + '>' + r)).length < min))
      throw new BadRequestError('Demasiadas exclusiones: cada persona necesita al menos 3 destinatarios posibles.');
    const budget = Number.isInteger(body.budgetCents) && body.budgetCents > 0 ? body.budgetCents : 0;
    const rand = () => parseInt($security.randomStringWithAlphabet(8, '0123456789abcdef'), 16) / 4294967296;
    let pairs;
    try {
      pairs = drawPairs(participants, exclusions, rand);
    } catch (err) {
      throw new BadRequestError(String(err && err.reason ? err.reason : 'No se ha podido sortear.'));
    }
    $app.runInTransaction((tx) => {
      for (const old of tx.findRecordsByFilter('draws', 'group = {:g}', '', 0, 0, { g: group.id })) tx.delete(old);
      const draw = new Record(tx.findCollectionByNameOrId('draws'));
      draw.set('group', group.id);
      draw.set('budgetCents', budget);
      draw.set('exclusions', exclusions);
      draw.set('participants', participants);
      draw.set('createdBy', e.auth.id);
      group.set('drawRounds', group.getInt('drawRounds') + 1); // «sorteo n.º 3»: nadie repite en secreto
      draw.set('round', group.getInt('drawRounds'));
      tx.save(group);
      tx.save(draw);
      const col = tx.findCollectionByNameOrId('assignments');
      pairs.forEach((receiver, giver) => {
        const a = new Record(col);
        a.set('draw', draw.id);
        a.set('giver', giver);
        a.set('receiver', receiver);
        tx.save(a);
      });
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Vista previa de un enlace: solo miembros de algún grupo; la descarga la hace el servicio interno unfurl ———
routerAdd(
  'POST',
  '/api/lazo/unfurl',
  (e) => {
    const url = String(e.requestInfo().body.url || '').slice(0, 2048);
    try {
      $app.findFirstRecordByFilter('groups', 'members ?= {:me}', { me: e.auth.id });
    } catch {
      throw new ForbiddenError('Únete a un grupo primero.');
    }
    const res = $http.send({
      url: ($os.getenv('UNFURL_URL') || 'http://unfurl:8787') + '/unfurl',
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: { 'content-type': 'application/json', 'x-lazo-key': $os.getenv('UNFURL_KEY') },
      timeout: 10,
    });
    if (res.statusCode !== 200) {
      const code = (res.json && res.json.error) || 'error';
      const msg = {
        bad_url: 'Ese enlace no parece válido.',
        bad_port: 'Ese enlace no parece válido.',
        blocked: 'Ese enlace no está permitido.',
        timeout: 'La tienda tarda demasiado en responder. Rellénalo a mano.',
        not_html: 'Ese enlace no es una página de producto.',
      }[code];
      throw new BadRequestError(msg || 'No hemos podido leer esa página. Rellénalo a mano.');
    }
    return e.json(200, res.json);
  },
  $apis.requireAuth('users'),
);

// ——— Anular enlaces (auditoría G-3) ———
routerAdd(
  'POST',
  '/api/lazo/invite-revoke',
  (e) => {
    const group = $app.findRecordById('groups', String(e.requestInfo().body.group || ''));
    if (!group.getStringSlice('admins').includes(e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo.');
    for (const inv of $app.findRecordsByFilter('invites', 'group = {:g} && revoked = false', '', 0, 0, { g: group.id })) {
      inv.set('revoked', true);
      $app.save(inv);
    }
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Expulsar a alguien (auditoría G-3): sus reservas y aportaciones se borran; los enlaces, anulados ———
routerAdd(
  'POST',
  '/api/lazo/expel',
  (e) => {
    const body = e.requestInfo().body;
    const group = $app.findRecordById('groups', String(body.group || ''));
    const who = String(body.user || '');
    if (!group.getStringSlice('admins').includes(e.auth.id) || who === group.getString('owner') || who === e.auth.id) throw new ForbiddenError('No puedes expulsar a esa persona.');
    $app.runInTransaction((tx) => {
      for (const col of ['claims', 'contributions'])
        for (const r of tx.findRecordsByFilter(col, 'user = {:u} && item.list.group = {:g}', '', 0, 0, { u: who, g: group.id })) tx.delete(r);
      for (const l of tx.findRecordsByFilter('lists', 'user = {:u} && group = {:g}', '', 0, 0, { u: who, g: group.id })) tx.delete(l);
      for (const inv of tx.findRecordsByFilter('invites', 'group = {:g} && revoked = false', '', 0, 0, { g: group.id })) {
        inv.set('revoked', true);
        tx.save(inv);
      }
      group.set('members-', who);
      group.set('admins-', who);
      tx.save(group);
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Cerrar sesión en todos los dispositivos (auditoría G-4) ———
routerAdd(
  'POST',
  '/api/lazo/logout-all',
  (e) => {
    e.auth.refreshTokenKey();
    $app.save(e.auth);
    return $apis.recordAuthResponse(e, e.auth, 'rotate');
  },
  $apis.requireAuth('users'),
);
