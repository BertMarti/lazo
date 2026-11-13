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

// V-26: un id elegido por el cliente delata si una fila oculta (un regalo retirado) sigue existiendo.
onRecordCreateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser()) && e.requestInfo().body.id) throw new BadRequestError('Failed to create record.');
  e.next();
});
// El upsert de los lotes (PUT) hace la misma pregunta: 404 si existe oculto, 200 si no. Los lotes solo crean.
onBatchRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser()) && e.batch.some((r) => String(r.method).toUpperCase() !== 'POST')) throw new ForbiddenError('Consulta no permitida.');
  e.next();
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

// ——— Grupos: quien crea es dueño, miembro y admin; su plaza y las plazas previstas («¿Quiénes sois?») ———
onRecordCreateRequest((e) => {
  if (!e.auth || e.auth.collection().name !== 'users') throw new UnauthorizedError('Entra primero.');
  e.record.set('owner', e.auth.id);
  e.record.set('members', [e.auth.id]);
  e.record.set('admins', [e.auth.id]);
  if (!e.record.getString('currency')) e.record.set('currency', 'EUR');
  if (!e.record.getString('buyMode')) e.record.set('buyMode', 'mixto');
  for (const f of ['treasurer', 'deputy', 'revealAskedBy']) e.record.set(f, '');
  e.record.set('revealedAt', 0);
  e.record.set('drawRounds', 0); // V-12
  e.next();
  const { parsePlazas } = require(`${__hooks}/lib/plazas.cjs`);
  const raw = e.requestInfo().body.plazas;
  const names = parsePlazas(Array.isArray(raw) ? raw.map(String).slice(0, 80) : [], e.auth.getString('name'));
  const col = $app.findCollectionByNameOrId('lists');
  for (const name of names) {
    const l = new Record(col);
    l.set('group', e.record.id);
    l.set('name', name);
    l.set('kind', 'person');
    $app.save(l);
  }
}, 'groups');

// La plaza del creador, dentro de la misma transacción (auditoría G-10).
onRecordCreate((e) => {
  e.next();
  const owner = e.app.findRecordById('users', e.record.getString('owner'));
  const list = new Record(e.app.findCollectionByNameOrId('lists'));
  list.set('group', e.record.id);
  list.set('name', owner.getString('name'));
  list.set('kind', 'person');
  list.set('user', owner.id);
  list.set('via', 'creator');
  list.set('approvedBy', owner.id);
  list.set('claimedAt', Date.now());
  e.app.save(list);
}, 'groups');

// ——— A medias: nunca en la propia plaza (rechazo antes de leer nada), ni en modo hucha, ni sobre algo ya cogido ———
// V-8: comprobar y crear dentro de la misma transacción.
onRecordCreateRequest((e) => {
  $app.runInTransaction((tx) => {
    const item = tx.findRecordById('items', e.record.getString('item'));
    const list = tx.findRecordById('lists', item.getString('list'));
    if (!e.auth || list.getString('user') === e.auth.id) throw new ForbiddenError('No puedes aportar en tu propia lista.');
    if (item.getBool('removed')) throw new BadRequestError('Lo ha quitado de su lista.'); // V-13 e
    const group = tx.findRecordById('groups', list.getString('group'));
    if (group.getString('buyMode') === 'hucha') throw new BadRequestError('En este grupo todo va a la hucha.');
    if (tx.findRecordsByFilter('claims', 'item = {:i}', '', 1, 0, { i: item.id }).length) throw new BadRequestError('Este regalo ya está cogido.');
    e.app = tx;
    e.next();
  });
}, 'contributions');

// ——— Pagos de la hucha: solo con el tesorero (cuenta general) o con el suplente por los regalos del tesorero ———
onRecordCreateRequest((e) => {
  const L = require(`${__hooks}/lib/lazo.cjs`);
  const group = $app.findRecordById('groups', e.record.getString('group'));
  const members = group.getStringSlice('members');
  const from = e.record.getString('from');
  const to = e.record.getString('to');
  const userOf = (id) => (id ? $app.findRecordById('lists', id).getString('user') : '');
  const T = userOf(group.getString('treasurer'));
  const T2 = userOf(group.getString('deputy'));
  const ok =
    members.includes(from) &&
    members.includes(to) &&
    (e.record.getBool('sub') ? (from === T2 || to === T2) && from !== T && to !== T : !!T && (from === T || to === T));
  if (!ok) throw new BadRequestError('Ese pago no se puede apuntar.');
  void L;
  e.next();
}, 'payments');

// ——— Quitar un regalo propio responde SIEMPRE 204: si tenía reservas, compras o aportaciones se oculta (D6) ———
onRecordDeleteRequest((e) => {
  const id = e.record.id;
  let touched = 0;
  // V-2: se marca SIEMPRE como retirado antes de nada, así el dueño recibe exactamente los mismos eventos
  // de tiempo real (ninguno: un regalo retirado ya no es visible para él) tenga o no reservas.
  // Se guarda FUERA de la transacción del borrado: PocketBase evalúa la regla de los eventos «delete» con el
  // estado ya confirmado, y si no, el dueño recibiría «delete» solo de los regalos libres (v0.6, tiempo real).
  // Desde aquí nadie puede reservar ni aportar (gift y contributions rechazan lo retirado): V-8 sigue cerrado.
  if (!e.record.getBool('secret')) {
    e.record.set('removed', true);
    $app.save(e.record);
  }
  // V-8: comprobar y borrar en la misma transacción (una reserva no puede colarse entre medias).
  $app.runInTransaction((tx) => {
    e.app = tx;
    if (e.record.getBool('secret')) {
      if (tx.findRecordsByFilter('claims', 'item = {:i} && status = "bought"', '', 1, 0, { i: id }).length) throw new BadRequestError('Ya está comprado: deshaz la compra antes.');
      return e.next();
    }
    touched = tx.findRecordsByFilter('claims', 'item = {:i}', '', 1, 0, { i: id }).length || tx.findRecordsByFilter('contributions', 'item = {:i}', '', 1, 0, { i: id }).length;
    if (!touched) return e.next();
  });
  if (touched) return e.noContent(204);
}, 'items');

// ——— Borrar una plaza libre o una lista de niño: nunca si tiene compras ni si lleva la hucha (V-11) ———
onRecordDeleteRequest((e) => {
  if ($app.findRecordsByFilter('claims', 'item.list = {:l} && status = "bought"', '', 1, 0, { l: e.record.id }).length) throw new BadRequestError('Esta plaza tiene compras apuntadas.');
  const group = $app.findRecordById('groups', e.record.getString('group'));
  if ([group.getString('treasurer'), group.getString('deputy')].includes(e.record.id)) throw new BadRequestError('Esta plaza lleva las cuentas de la hucha y no se puede borrar.');
  e.next();
}, 'lists');

// ——— Plazas nuevas: sin nombres repetidos en el grupo (V-13 d) ———
onRecordCreateRequest((e) => {
  const { normName } = require(`${__hooks}/lib/plazas.cjs`);
  const n = normName(e.record.getString('name'));
  if ($app.findRecordsByFilter('lists', 'group = {:g}', '', 0, 0, { g: e.record.getString('group') }).some((l) => normName(l.getString('name')) === n)) throw new BadRequestError('Ya hay alguien con ese nombre en el grupo.');
  e.next();
}, 'lists');

// ——— Baja de cuenta: nunca con una plaza ocupada ni siendo dueño de un grupo (V-10) ———
onRecordDeleteRequest((e) => {
  if ($app.findRecordsByFilter('lists', 'kind = "person" && user = {:u}', '', 1, 0, { u: e.record.id }).length || $app.findRecordsByFilter('groups', 'owner = {:u}', '', 1, 0, { u: e.record.id }).length) throw new BadRequestError('Pide a quien organiza que libere tu sitio antes de borrar tu cuenta.');
  e.next();
}, 'users');

// ——— Invitar: enlace general (14 días, 30 usos) o personal de una plaza libre (1 uso). Solo se guarda el hash ———
routerAdd(
  'POST',
  '/api/lazo/invite',
  (e) => {
    const body = e.requestInfo().body;
    const group = $app.findRecordById('groups', String(body.group || ''));
    if (!group.getStringSlice('admins').includes(e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo puede invitar.');
    let listId = '';
    if (body.list) {
      const plaza = $app.findRecordById('lists', String(body.list));
      if (plaza.getString('group') !== group.id || plaza.getString('kind') !== 'person' || plaza.getString('user')) throw new BadRequestError('Esa plaza ya está ocupada.');
      listId = plaza.id;
      for (const old of $app.findRecordsByFilter('invites', 'list = {:l} && revoked = false', '', 0, 0, { l: listId })) {
        old.set('revoked', true);
        $app.save(old);
      }
    }
    const token = $security.randomString(32);
    const days = 14;
    const inv = new Record($app.findCollectionByNameOrId('invites'));
    inv.set('group', group.id);
    inv.set('list', listId);
    inv.set('tokenHash', $security.sha256(token));
    inv.set('expiresAt', Date.now() + days * 86400000);
    inv.set('maxUses', listId ? 1 : 30);
    inv.set('uses', 0);
    inv.set('createdBy', e.auth.id);
    $app.save(inv);
    return e.json(200, { token, expires: new Date(Date.now() + days * 86400000).toISOString() });
  },
  $apis.requireAuth('users'),
);

// ——— Qué abre un enlace: nombre del grupo, quién organiza, la plaza personal o las libres y las caras de quien ya está. Nada más ———
routerAdd('POST', '/api/lazo/invite-info', (e) => {
  const L = require(`${__hooks}/lib/lazo.cjs`);
  const inv = L.findInvite($app, String(e.requestInfo().body.token || ''));
  const g = $app.findRecordById('groups', inv.getString('group'));
  let organizer = '';
  try {
    organizer = $app.findRecordById('users', inv.getString('createdBy')).getString('name');
  } catch {
    /* ya no está */
  }
  const colorOf = (userId) => {
    if (!userId) return '';
    try {
      return $app.findRecordById('users', userId).getString('color');
    } catch {
      return '';
    }
  };
  const listId = inv.getString('list');
  let personal = null;
  if (listId) {
    const plaza = $app.findRecordById('lists', listId);
    if (plaza.getString('user')) throw new BadRequestError(L.BAD_INVITE);
    personal = { list: plaza.id, name: plaza.getString('name'), color: colorOf(plaza.getString('prevUser')) };
  }
  const free = listId
    ? []
    : $app.findRecordsByFilter('lists', 'group = {:g} && kind = "person" && user = ""', 'name', 0, 0, { g: g.id }).map((l) => ({ list: l.id, name: l.getString('name'), color: colorOf(l.getString('prevUser')) }));
  // Quien ya está dentro: solo inicial y color (ni ids, ni nombres, ni correos), como mucho 12.
  const { initial } = require(`${__hooks}/lib/plazas.cjs`);
  const faces = $app
    .findRecordsByFilter('lists', 'group = {:g} && kind = "person" && user != ""', 'claimedAt', 12, 0, { g: g.id })
    .map((l) => ({ initial: initial(l.getString('name')), color: colorOf(l.getString('user')) }));
  return e.json(200, {
    group: { id: g.id, name: g.getString('name'), occasion: g.getString('occasion'), date: g.getString('date') || undefined },
    organizer,
    personal,
    free,
    faces,
    allowNewNames: !listId && g.getBool('allowNewNames'),
  });
});

// ——— Entrar: personal → dentro al momento; general → solicitud pendiente con código (no es miembro, no lee nada) ———
routerAdd('POST', '/api/lazo/join', (e) => {
  const L = require(`${__hooks}/lib/lazo.cjs`);
  const { normName, parsePlazas } = require(`${__hooks}/lib/plazas.cjs`);
  const body = e.requestInfo().body;
  const invite = L.findInvite($app, String(body.token || ''));
  let user = e.auth;
  if (user && user.collection().name !== 'users') throw new ForbiddenError('Entra con una cuenta de la familia.');
  let meta = {};
  $app.runInTransaction((tx) => {
    const inv = tx.findRecordById('invites', invite.id);
    if (inv.getBool('revoked') || inv.getInt('expiresAt') < Date.now() || inv.getInt('uses') >= inv.getInt('maxUses')) throw new BadRequestError(L.BAD_INVITE);
    const group = tx.findRecordById('groups', inv.getString('group'));
    if (!L.isAdmin(group, inv.getString('createdBy'))) throw new BadRequestError(L.BAD_INVITE); // V-32
    if (user && group.getStringSlice('members').includes(user.id)) throw new BadRequestError('Ya estás en este grupo.');
    const personalId = inv.getString('list');
    if (personalId) {
      const plaza = tx.findRecordById('lists', personalId);
      if (plaza.getString('user')) throw new BadRequestError(L.BAD_INVITE);
      if (!user) user = L.newUser(tx, plaza.getString('name'), group.getStringSlice('members').length);
      L.reclamar(tx, plaza, user.id, 'personal', inv.getString('createdBy'));
      meta = { group: group.id };
    } else {
      let listId = '';
      let name = '';
      if (body.list) {
        const plaza = tx.findRecordById('lists', String(body.list));
        if (plaza.getString('group') !== group.id || plaza.getString('kind') !== 'person' || plaza.getString('user')) throw new BadRequestError('Esa plaza ya está ocupada.');
        listId = plaza.id;
        name = plaza.getString('name');
      } else {
        if (!group.getBool('allowNewNames')) throw new BadRequestError('Elige tu nombre en la lista.');
        name = parsePlazas([String(body.name || '')])[0] || '';
        if (!name) throw new BadRequestError('Escribe tu nombre.');
        const taken = tx.findRecordsByFilter('lists', 'group = {:g}', '', 0, 0, { g: group.id }).some((l) => normName(l.getString('name')) === normName(name));
        if (taken) throw new BadRequestError('Ya hay una plaza con ese nombre: elígela en la lista.');
      }
      if (tx.findRecordsByFilter('joinRequests', 'group = {:g} && status = "pending"', '', 21, 0, { g: group.id }).length >= 20) throw new BadRequestError('Hay demasiadas entradas pendientes. Avisa a quien organiza.');
      if (!user) user = L.newUser(tx, name, group.getStringSlice('members').length);
      if (tx.findRecordsByFilter('joinRequests', 'group = {:g} && user = {:u}', '', 1, 0, { g: group.id, u: user.id }).length) throw new BadRequestError('Ya has pedido entrar en este grupo.');
      const req = new Record(tx.findCollectionByNameOrId('joinRequests'));
      req.set('group', group.id);
      req.set('user', user.id);
      req.set('list', listId);
      req.set('name', name);
      req.set('code', String(parseInt($security.randomStringWithAlphabet(4, '0123456789'), 10)).padStart(4, '0'));
      req.set('status', 'pending');
      tx.save(req);
      meta = { group: group.id, pending: true, request: req.id, code: req.getString('code') };
    }
    inv.set('uses', inv.getInt('uses') + 1);
    tx.save(inv);
  });
  return $apis.recordAuthResponse(e, user, 'invite', meta);
});

// ——— Aceptar o rechazar una entrada (admin) ———
routerAdd(
  'POST',
  '/api/lazo/join-decide',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const body = e.requestInfo().body;
    $app.runInTransaction((tx) => {
      const req = tx.findRecordById('joinRequests', String(body.request || ''));
      const group = tx.findRecordById('groups', req.getString('group'));
      if (!L.isAdmin(group, e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo puede aceptar.');
      if (req.getString('status') !== 'pending') throw new BadRequestError('Esa solicitud ya está resuelta.');
      if (body.accept === true) {
        let plaza;
        if (req.getString('list')) {
          plaza = tx.findRecordById('lists', req.getString('list'));
          if (plaza.getString('user')) throw new BadRequestError('Esa plaza ya está ocupada.');
        } else {
          const { normName } = require(`${__hooks}/lib/plazas.cjs`);
          const n = normName(req.getString('name'));
          if (tx.findRecordsByFilter('lists', 'group = {:g}', '', 0, 0, { g: group.id }).some((l) => normName(l.getString('name')) === n)) throw new BadRequestError('Ya hay alguien con ese nombre: elige su plaza o cámbiale el nombre.');
          plaza = new Record(tx.findCollectionByNameOrId('lists'));
          plaza.set('group', group.id);
          plaza.set('name', req.getString('name'));
          plaza.set('kind', 'person');
          tx.save(plaza);
        }
        L.reclamar(tx, plaza, req.getString('user'), 'approved', e.auth.id);
        req.set('status', 'approved');
        req.set('decidedBy', e.auth.id);
        tx.save(req);
      } else tx.delete(req); // V-13 c: así puede volver a pedir entrada
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Liberar una plaza (admin; nunca la suya ni la del dueño). Expulsa la cuenta; la plaza conserva su historial ———
routerAdd(
  'POST',
  '/api/lazo/plaza-release',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    $app.runInTransaction((tx) => {
      const plaza = tx.findRecordById('lists', String(e.requestInfo().body.list || ''));
      const group = tx.findRecordById('groups', plaza.getString('group'));
      const who = plaza.getString('user');
      if (!L.isAdmin(group, e.auth.id) || plaza.getString('kind') !== 'person' || !who || who === e.auth.id || who === group.getString('owner')) throw new ForbiddenError('No puedes liberar esa plaza.');
      group.set('members-', who);
      group.set('admins-', who);
      tx.save(group);
      plaza.set('prevUser', who);
      plaza.set('user', '');
      plaza.set('claimedAt', 0);
      plaza.set('via', '');
      plaza.set('approvedBy', ''); // V-13 a
      tx.save(plaza);
      for (const r of tx.findRecordsByFilter('joinRequests', 'group = {:g} && user = {:u}', '', 0, 0, { g: group.id, u: who })) tx.delete(r); // V-13 c
      for (const inv of tx.findRecordsByFilter('invites', 'list = {:l} && revoked = false', '', 0, 0, { l: plaza.id })) {
        inv.set('revoked', true);
        tx.save(inv);
      }
      // Su enlace de solo lectura no pasa a quien ocupe la plaza después.
      for (const s of tx.findRecordsByFilter('shares', 'list = {:l}', '', 0, 0, { l: plaza.id })) tx.delete(s);
      L.soltar(tx, group, who); // V-32 y V-34
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Eliminar el grupo: solo quien lo creó. Es la única puerta (groups.deleteRule = null desde v1.1.2) ———
// El borrado arrastra en la misma transacción todo lo que cuelga del grupo por cascadeDelete: plazas, regalos,
// reservas, aportaciones, presupuestos, pagos, sorteos, asignaciones, enlaces, solicitudes y enlaces de solo lectura.
// Misma respuesta (403) si el grupo no existe o no es tuyo; nunca mira qué hay dentro.
routerAdd(
  'POST',
  '/api/lazo/group-delete',
  (e) => {
    const no = () => new ForbiddenError('Solo quien creó el grupo puede eliminarlo.');
    $app.runInTransaction((tx) => {
      let group;
      try {
        group = tx.findRecordById('groups', String(e.requestInfo().body.group || ''));
      } catch {
        throw no();
      }
      if (group.getString('owner') !== e.auth.id) throw no();
      tx.delete(group);
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Salir del grupo (cualquiera menos el dueño). Su plaza queda libre, como con plaza-release, y además se
// suelta lo que solo era una promesa suya hacia otros: reservas sin comprar y aportaciones sin pagar a regalos
// sin comprar. Lo comprado y lo pagado se queda apuntado (ese dinero ya se movió). Su lista no se toca y la
// respuesta es siempre la misma: no depende de lo que tenga reservado ni de lo que haya en su lista.
routerAdd(
  'POST',
  '/api/lazo/group-leave',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const me = e.auth.id;
    $app.runInTransaction((tx) => {
      let group;
      try {
        group = tx.findRecordById('groups', String(e.requestInfo().body.group || ''));
      } catch {
        throw new ForbiddenError('No perteneces a este grupo.');
      }
      if (!group.getStringSlice('members').includes(me)) throw new ForbiddenError('No perteneces a este grupo.');
      if (group.getString('owner') === me) throw new ForbiddenError('Quien creó el grupo no puede salir: tendría que eliminarlo.');
      const plaza = tx.findRecordsByFilter('lists', 'group = {:g} && kind = "person" && user = {:u}', '', 1, 0, { g: group.id, u: me })[0];
      if (plaza && [group.getString('treasurer'), group.getString('deputy')].includes(plaza.id)) throw new BadRequestError('Llevas las cuentas de la hucha y no puedes salir del grupo.');
      group.set('members-', me);
      group.set('admins-', me);
      tx.save(group);
      if (plaza) {
        plaza.set('prevUser', me); // V-5: no puede volver en otra plaza
        plaza.set('user', '');
        plaza.set('claimedAt', 0);
        plaza.set('via', '');
        plaza.set('approvedBy', '');
        tx.save(plaza);
        for (const inv of tx.findRecordsByFilter('invites', 'list = {:l} && revoked = false', '', 0, 0, { l: plaza.id })) {
          inv.set('revoked', true);
          tx.save(inv);
        }
        for (const s of tx.findRecordsByFilter('shares', 'list = {:l}', '', 0, 0, { l: plaza.id })) tx.delete(s);
      }
      for (const r of tx.findRecordsByFilter('joinRequests', 'group = {:g} && user = {:u}', '', 0, 0, { g: group.id, u: me })) tx.delete(r);
      const g = group.id;
      for (const c of tx.findRecordsByFilter('claims', 'item.list.group = {:g} && user = {:u} && status = "reserved" && kind != "pot"', '', 0, 0, { g, u: me })) tx.delete(c);
      for (const c of tx.findRecordsByFilter('contributions', 'item.list.group = {:g} && user = {:u} && paid = false', '', 0, 0, { g, u: me })) {
        if (!tx.findRecordsByFilter('claims', 'item = {:i} && status = "bought"', '', 1, 0, { i: c.getString('item') }).length) tx.delete(c);
      }
      // Sus invitaciones (V-32) y las listas de niños que llevaba, con su enlace de solo lectura (V-34).
      L.soltar(tx, group, me);
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Enlace de solo lectura de MI lista (o la de un niño que llevo). Crear otra vez rota el token; solo se guarda el hash ———
routerAdd(
  'POST',
  '/api/lazo/share',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const plaza = L.ownList($app, e.requestInfo().body.list, e.auth.id);
    const token = $security.randomString(32);
    let rec;
    try {
      rec = $app.findFirstRecordByData('shares', 'list', plaza.id);
    } catch {
      rec = new Record($app.findCollectionByNameOrId('shares'));
      rec.set('list', plaza.id);
    }
    rec.set('tokenHash', $security.sha256(token));
    $app.save(rec);
    return e.json(200, { token });
  },
  $apis.requireAuth('users'),
);

routerAdd(
  'DELETE',
  '/api/lazo/share',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const plaza = L.ownList($app, e.requestInfo().body.list, e.auth.id);
    for (const s of $app.findRecordsByFilter('shares', 'list = {:l}', '', 0, 0, { l: plaza.id })) $app.delete(s);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Lista compartida (pública): nombre, ocasión y regalos. Ni estado, ni sorpresas, ni retirados, ni ids.
// Token falso, rotado o revocado: la MISMA respuesta. Se ordena por prioridad y título (nunca por estado).
routerAdd('GET', '/api/lazo/shared/{token}', (e) => {
  const L = require(`${__hooks}/lib/lazo.cjs`);
  const bad = () => new NotFoundError(L.BAD_SHARE);
  const token = String(e.request.pathValue('token') || '');
  if (!/^[A-Za-z0-9]{32}$/.test(token)) throw bad();
  let share;
  try {
    share = $app.findFirstRecordByData('shares', 'tokenHash', $security.sha256(token));
  } catch {
    throw bad();
  }
  const list = $app.findRecordById('lists', share.getString('list'));
  const group = $app.findRecordById('groups', list.getString('group'));
  const opt = (v) => v || undefined;
  const items = $app.findRecordsByFilter('items', 'list = {:l} && secret = false && removed = false', '', 0, 0, { l: list.id }).map((i) => ({
    title: i.getString('title'),
    image: opt(i.getString('image')),
    store: opt(i.getString('store')),
    priceCents: i.getInt('priceCents') || undefined,
    currency: i.getString('currency') || 'EUR',
    priority: i.getInt('priority') || 2,
    size: opt(i.getString('size')),
    color: opt(i.getString('color')),
    url: opt(i.getString('url')),
  }));
  items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'es'));
  e.response.header().set('Cache-Control', 'no-store');
  return e.json(200, { name: list.getString('name'), occasion: group.getString('occasion'), items });
});

// ——— Todas las transiciones de un regalo (spec §3.2). Orden: regalo → ¿es tuyo? (403 antes de leer estado) → grupo → transacción ———
routerAdd(
  'POST',
  '/api/lazo/gift',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const a = e.requestInfo().body;
    const me = e.auth.id;
    const notFound = () => new NotFoundError('Ese regalo ya no existe.');
    let claimRec = null;
    let itemId = String(a.item || '');
    if (a.claim) {
      try {
        claimRec = $app.findRecordById('claims', String(a.claim));
      } catch {
        throw notFound();
      }
      itemId = claimRec.getString('item');
    }
    let item;
    try {
      item = $app.findRecordById('items', itemId);
    } catch {
      throw notFound();
    }
    let list = $app.findRecordById('lists', item.getString('list'));
    if (list.getString('user') === me) {
      // V-1: retirado o sorpresa ≡ inexistente (si no, el código delata si estaba cogido)
      if (item.getBool('secret') || item.getBool('removed')) throw notFound();
      throw new ForbiddenError('No puedes reservar regalos de tu propia lista.');
    }
    const group0 = $app.findRecordById('groups', list.getString('group'));
    if (!group0.getStringSlice('members').includes(me)) throw notFound();

    $app.runInTransaction((tx) => {
      // V-8: releer dentro de la transacción (un join simultáneo no puede convertirla en tu plaza).
      item = tx.findRecordById('items', item.id);
      list = tx.findRecordById('lists', list.id);
      if (list.getString('user') === me) throw new ForbiddenError('No puedes reservar regalos de tu propia lista.');
      const group = tx.findRecordById('groups', group0.id);
      if (!group.getStringSlice('members').includes(me)) throw notFound();
      const mode = group.getString('buyMode') || 'individual';
      const allowed = (k) => (k === 'self' ? mode !== 'hucha' : mode !== 'individual');
      const rows = () => tx.findRecordsByFilter('claims', 'item = {:i}', '', 0, 0, { i: item.id });
      const taken = () => rows().reduce((s, c) => s + c.getInt('units'), 0);
      const pots = () => tx.findRecordsByFilter('contributions', 'item = {:i} && amountCents > 0', '', 0, 0, { i: item.id });
      const payers = group.getStringSlice('members').filter((u) => u !== list.getString('user'));
      const checkPay = () => {
        if (!Number.isInteger(a.paidCents) || a.paidCents < 0 || a.paidCents > 100000000) throw new BadRequestError('El precio no es válido.');
        if (!payers.includes(String(a.paidBy || ''))) throw new BadRequestError('Esa persona no puede pagar este regalo.');
      };
      const c = claimRec ? tx.findRecordById('claims', claimRec.id) : null;
      const ownSelf = (r) => (r.getString('kind') || 'self') === 'self' && r.getString('user') !== me;
      switch (a.action) {
        case 'reserve': {
          const kind = a.kind === 'pot' ? 'pot' : 'self';
          if (!allowed(kind)) throw new BadRequestError(kind === 'self' ? 'En este grupo todo va a la hucha.' : 'En este grupo cada uno compra lo suyo.');
          if (item.getBool('removed')) throw new BadRequestError('Lo ha quitado de su lista.');
          if (pots().length) throw new BadRequestError('Este regalo va a medias: pon tu parte.');
          if (taken() >= item.getInt('quantity')) throw new BadRequestError('Alguien se te ha adelantado: ya está cogido.');
          const r = new Record(tx.findCollectionByNameOrId('claims'));
          r.set('item', item.id);
          r.set('user', me);
          r.set('kind', kind);
          r.set('status', 'reserved');
          r.set('units', 1);
          tx.save(r);
          break;
        }
        case 'release': {
          if (!c || c.getString('status') !== 'reserved' || ownSelf(c)) throw new BadRequestError('Esa reserva no es tuya.');
          tx.delete(c);
          break;
        }
        case 'move': {
          const kind = a.kind === 'pot' ? 'pot' : 'self';
          if (!c || c.getString('status') !== 'reserved' || !allowed(kind) || ownSelf(c)) throw new BadRequestError('No se puede cambiar ahora.');
          c.set('kind', kind);
          if (kind === 'self') c.set('user', me);
          tx.save(c);
          break;
        }
        case 'buy': {
          checkPay();
          if (!c && item.getBool('removed')) throw new BadRequestError('Lo ha quitado de su lista.'); // V-13 e
          if (c) {
            if (c.getString('status') !== 'reserved' || ownSelf(c)) throw new BadRequestError('Esa reserva no es tuya.');
            c.set('status', 'bought');
            c.set('paidCents', a.paidCents);
            c.set('paidBy', String(a.paidBy));
            c.set('boughtAt', Date.now());
            tx.save(c);
          } else {
            const kind = mode === 'hucha' ? 'pot' : mode === 'individual' ? 'self' : a.kind === 'pot' ? 'pot' : 'self';
            if (taken() >= item.getInt('quantity')) throw new BadRequestError('Alguien se te ha adelantado: ya está cogido.');
            const ps = pots();
            if (ps.length && (kind !== 'self' || !ps.some((p) => p.getString('user') === me))) throw new BadRequestError('Lo compra alguien que pone dinero.');
            const r = new Record(tx.findCollectionByNameOrId('claims'));
            r.set('item', item.id);
            r.set('user', me);
            r.set('kind', kind);
            r.set('status', 'bought');
            r.set('units', 1);
            r.set('paidCents', a.paidCents);
            r.set('paidBy', String(a.paidBy));
            r.set('boughtAt', Date.now());
            tx.save(r);
          }
          break;
        }
        case 'unbuy': {
          const keeper = L.keeperOf(tx, group, list.id);
          if (!c || c.getString('status') !== 'bought' || ![c.getString('user'), c.getString('paidBy'), keeper].includes(me) && !L.isAdmin(group, me)) throw new BadRequestError('No puedes deshacer esta compra.');
          c.set('status', 'reserved');
          c.set('paidCents', 0);
          c.set('paidBy', '');
          c.set('boughtAt', 0);
          tx.save(c);
          break;
        }
        default:
          throw new BadRequestError('Acción desconocida.');
      }
    });
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Quién lleva la hucha y quién las cuentas de sus regalos: se fija una sola vez ———
routerAdd(
  'POST',
  '/api/lazo/hucha-roles',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const body = e.requestInfo().body;
    const group = $app.findRecordById('groups', String(body.group || ''));
    if (!L.isAdmin(group, e.auth.id)) throw new ForbiddenError('Solo quien organiza el grupo.');
    if (group.getString('treasurer') || group.getString('deputy')) throw new BadRequestError('Ya están elegidos y no se pueden cambiar.');
    const t = $app.findRecordById('lists', String(body.treasurer || ''));
    const d = $app.findRecordById('lists', String(body.deputy || ''));
    const ok = (l) => l.getString('group') === group.id && l.getString('kind') === 'person' && l.getString('user');
    if (t.id === d.id || !ok(t) || !ok(d)) throw new BadRequestError('Elige dos personas distintas que ya estén dentro.');
    group.set('treasurer', t.id);
    group.set('deputy', d.id);
    $app.save(group);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Día de la entrega: dos llaves (un admin propone; otra persona confirma) ———
routerAdd(
  'POST',
  '/api/lazo/reveal',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const body = e.requestInfo().body;
    const group = $app.findRecordById('groups', String(body.group || ''));
    const me = e.auth.id;
    if (!group.getStringSlice('members').includes(me)) throw new ForbiddenError('No perteneces a este grupo.');
    const admin = L.isAdmin(group, me);
    const asked = group.getString('revealAskedBy');
    if (body.action === 'ask' && admin) group.set('revealAskedBy', me);
    else if (body.action === 'confirm' && asked && asked !== me) {
      group.set('revealedAt', Date.now());
      group.set('revealAskedBy', '');
    } else if (body.action === 'cancel' && admin) group.set('revealAskedBy', '');
    else if (body.action === 'close' && admin) group.set('revealedAt', 0);
    else throw new ForbiddenError('No puedes hacer esto.');
    $app.save(group);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth('users'),
);

// ——— Lo que te regalaron: solo lo comprado de tu plaza, «de parte de» y nunca precios ———
routerAdd(
  'GET',
  '/api/lazo/received/{group}',
  (e) => {
    const me = e.auth.id;
    let group;
    try {
      group = $app.findRecordById('groups', e.request.pathValue('group'));
    } catch {
      throw new ForbiddenError('No perteneces a este grupo.');
    }
    if (!group.getStringSlice('members').includes(me)) throw new ForbiddenError('No perteneces a este grupo.');
    if (!group.getInt('revealedAt')) throw new ForbiddenError('La entrega aún no está abierta.');
    const plaza = $app.findRecordsByFilter('lists', 'group = {:g} && kind = "person" && user = {:u}', '', 1, 0, { g: group.id, u: me })[0];
    if (!plaza) return e.json(200, []);
    const nameOf = (id) => {
      try {
        return $app.findRecordById('users', id).getString('name');
      } catch {
        return 'Alguien';
      }
    };
    const out = [];
    for (const c of $app.findRecordsByFilter('claims', 'item.list = {:l} && status = "bought" && boughtAt <= {:r}', '', 0, 0, { l: plaza.id, r: group.getInt('revealedAt') })) {
      const it = $app.findRecordById('items', c.getString('item'));
      const pots = $app.findRecordsByFilter('contributions', 'item = {:i} && amountCents > 0', '', 0, 0, { i: it.id }).map((x) => x.getString('user'));
      const fromAll = c.getString('kind') === 'pot';
      const ids = fromAll ? [] : pots.length ? pots : [c.getString('user')];
      out.push({ title: it.getString('title'), image: it.getString('image') || undefined, url: it.getString('url') || undefined, from: ids.map((id) => ({ id, name: nameOf(id) })), fromAll });
    }
    return e.json(200, out);
  },
  $apis.requireAuth('users'),
);

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
      $app.findFirstRecordByFilter('groups', 'members.id ?= {:me}', { me: e.auth.id });
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

// ——— Copia del grupo: los regalos pedidos de cada plaza, en un grupo recién creado (solo está quien organiza) ———
// Solo crea regalos normales (ni sorpresas, ni reservas, ni compras, ni aportaciones) y nunca mira qué hay ya en
// una lista: en la propia plaza eso delataría sorpresas o retirados. Todo o nada, en una transacción.
routerAdd(
  'POST',
  '/api/lazo/restore',
  (e) => {
    const L = require(`${__hooks}/lib/lazo.cjs`);
    const C = require(`${__hooks}/lib/copia.cjs`);
    const body = e.requestInfo().body;
    const me = e.auth.id;
    let group;
    try {
      group = $app.findRecordById('groups', String(body.group || ''));
    } catch {
      throw new ForbiddenError('Solo quien organiza el grupo.');
    }
    if (!L.isAdmin(group, me)) throw new ForbiddenError('Solo quien organiza el grupo.');
    const members = group.getStringSlice('members');
    if (members.length !== 1 || members[0] !== me) throw new BadRequestError('Solo se puede restaurar en un grupo recién creado.');
    const lists = body.lists;
    if (!Array.isArray(lists) || lists.length > C.COPIA_MAX.lists) throw new BadRequestError('La copia tiene demasiadas personas.');
    const plan = [];
    const used = {};
    let total = 0;
    for (const x of lists) {
      const items = x && x.items;
      if (!Array.isArray(items) || items.length > C.COPIA_MAX.itemsPerList) throw new BadRequestError('Esa copia no encaja en este grupo.');
      total += items.length;
      if (total > C.COPIA_MAX.items) throw new BadRequestError('La copia tiene demasiados regalos.');
      let l;
      try {
        l = $app.findRecordById('lists', String(x.list || ''));
      } catch {
        throw new BadRequestError('Esa copia no encaja en este grupo.');
      }
      const kind = l.getString('kind');
      const fits = l.getString('group') === group.id && !used[l.id] && (kind === 'child' ? l.getStringSlice('managers').includes(me) : kind === 'person' && (!l.getString('user') || l.getString('user') === me));
      if (!fits) throw new BadRequestError('Esa copia no encaja en este grupo.');
      used[l.id] = true;
      let clean;
      try {
        clean = items.map((i) => C.cleanGift(i));
      } catch {
        throw new BadRequestError('Este archivo no es una copia de Lazo válida.');
      }
      plan.push({ list: l.id, items: clean });
    }
    const col = $app.findCollectionByNameOrId('items');
    const fields = ['title', 'url', 'image', 'priceCents', 'store', 'size', 'color', 'priority', 'notes', 'quantity'];
    $app.runInTransaction((tx) => {
      for (const p of plan) {
        for (const it of p.items) {
          const r = new Record(col);
          for (const f of fields) if (it[f] !== undefined) r.set(f, it[f]);
          r.set('list', p.list);
          r.set('createdBy', me);
          r.set('currency', group.getString('currency') || 'EUR');
          r.set('secret', false);
          r.set('removed', false);
          tx.save(r);
        }
      }
    });
    return e.json(200, { created: total });
  },
  $apis.requireAuth('users'),
);
