// Ayudantes compartidos de los hooks (cada manejador se ejecuta aislado: se cargan con require()).
// Escrito a mano (a diferencia de draw.cjs y plazas.cjs, que se generan desde src/core).

const BAD_INVITE = 'Esta invitación no existe o ha caducado. Pide un enlace nuevo.';
const COLORS = ['limon', 'canela', 'menta', 'fresa', 'violeta', 'almendra', 'cielo'];

/** Invitación válida por token (mismo mensaje para todo fallo). */
function findInvite(app, token) {
  if (!/^[A-Za-z0-9]{20,64}$/.test(String(token || ''))) throw new BadRequestError(BAD_INVITE);
  let inv;
  try {
    inv = app.findFirstRecordByData('invites', 'tokenHash', $security.sha256(token));
  } catch {
    throw new BadRequestError(BAD_INVITE);
  }
  if (inv.getBool('revoked') || inv.getInt('expiresAt') < Date.now() || inv.getInt('uses') >= inv.getInt('maxUses')) throw new BadRequestError(BAD_INVITE);
  return inv;
}

/** Cuenta nueva sin contraseña conocida: se entra con el token de sesión. */
function newUser(tx, name, colorIndex) {
  const user = new Record(tx.findCollectionByNameOrId('users'));
  user.set('email', 'u-' + $security.randomStringWithAlphabet(24, 'abcdefghijklmnopqrstuvwxyz0123456789') + '@lazo.invalid');
  user.setPassword($security.randomString(48));
  user.set('name', String(name).slice(0, 40));
  user.set('color', COLORS[colorIndex % COLORS.length]);
  tx.save(user);
  return user;
}

/**
 * Reclamar una plaza (spec §5): la identidad es la plaza; la cuenta, la llave.
 * Si la ocupó otra cuenta antes, sus reservas, compras, aportaciones y pagos pasan a la nueva.
 */
function reclamar(tx, plaza, userId, via, by) {
  if (plaza.getString('user')) throw new BadRequestError('Esa plaza ya está ocupada.');
  const group = tx.findRecordById('groups', plaza.getString('group'));
  if (group.getStringSlice('members').includes(userId)) throw new BadRequestError('Ya estás en este grupo.');
  // V-5: quien fue sacado de una plaza no puede volver con otra (vería la antigua y mezclaría historiales).
  const others = tx.findRecordsByFilter('lists', 'group = {:g} && prevUser = {:u} && id != {:p}', '', 1, 0, { g: group.id, u: userId, p: plaza.id });
  if (others.length) throw new BadRequestError('Esta cuenta ya tuvo otra plaza en este grupo. Pide a quien organiza que te la devuelva.');
  plaza.set('user', userId);
  plaza.set('claimedAt', Date.now());
  plaza.set('via', via);
  plaza.set('approvedBy', by);
  const prev = plaza.getString('prevUser');
  plaza.set('prevUser', '');
  tx.save(plaza); // el índice único (group, user) cierra la carrera de dos reclamaciones simultáneas
  group.set('members+', userId);
  tx.save(group);
  if (prev && prev !== userId) {
    const g = group.id;
    for (const c of tx.findRecordsByFilter('claims', 'item.list.group = {:g} && (user = {:p} || paidBy = {:p})', '', 0, 0, { g, p: prev })) {
      if (c.getString('user') === prev) c.set('user', userId);
      if (c.getString('paidBy') === prev) c.set('paidBy', userId);
      tx.save(c);
    }
    for (const c of tx.findRecordsByFilter('contributions', 'item.list.group = {:g} && user = {:p}', '', 0, 0, { g, p: prev })) {
      c.set('user', userId);
      tx.save(c);
    }
    // V-13 b: las sorpresas que preparó siguen siendo editables por quien ocupa ahora la plaza.
    for (const it of tx.findRecordsByFilter('items', 'list.group = {:g} && createdBy = {:p}', '', 0, 0, { g, p: prev })) {
      it.set('createdBy', userId);
      tx.save(it);
    }
    for (const p of tx.findRecordsByFilter('payments', 'group = {:g} && (from = {:p} || to = {:p})', '', 0, 0, { g, p: prev })) {
      if (p.getString('from') === prev) p.set('from', userId);
      if (p.getString('to') === prev) p.set('to', userId);
      tx.save(p);
    }
  }
}

function isAdmin(group, userId) {
  return group.getStringSlice('admins').includes(userId);
}

/** Quien lleva la caja de la plaza: el tesorero, o el suplente si la plaza es la del tesorero. */
function keeperOf(app, group, listId) {
  const userOf = (id) => {
    if (!id) return '';
    try {
      return app.findRecordById('lists', id).getString('user');
    } catch {
      return '';
    }
  };
  return listId === group.getString('treasurer') ? userOf(group.getString('deputy')) : userOf(group.getString('treasurer'));
}

const BAD_SHARE = 'Este enlace no existe o ya no se comparte.';

/** La lista que puedo compartir: mi plaza, o la de un niño que llevo (y siempre dentro del grupo). Mismo 403 si no existe. */
function ownList(app, listId, me) {
  const no = () => new ForbiddenError('Solo puedes compartir tu propia lista.');
  let l, g;
  try {
    l = app.findRecordById('lists', String(listId || ''));
    g = app.findRecordById('groups', l.getString('group'));
  } catch {
    throw no();
  }
  const mine = l.getString('user') === me || (l.getString('kind') === 'child' && l.getStringSlice('managers').includes(me));
  if (!mine || !g.getStringSlice('members').includes(me)) throw no();
  return l;
}

module.exports = { BAD_INVITE, BAD_SHARE, COLORS, findInvite, newUser, reclamar, isAdmin, keeperOf, ownList };
