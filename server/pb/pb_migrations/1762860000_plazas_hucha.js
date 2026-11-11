/// <reference path="../pb_data/types.d.ts" />
// Plazas, modos de compra, hucha y día de la entrega (spec 2026-11-11-plazas-hucha §4).
// Principio: el servidor NO devuelve agregados; solo filas, y cada fila es visible o no para X según su regla.

const ME = '@request.auth.id';
const AUTH = `${ME} != ""`;
const SEE_LIST = `${AUTH} && list.group.members ?= ${ME} && list.user != ${ME}`;

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const groups = app.findCollectionByNameOrId('groups');
    const lists = app.findCollectionByNameOrId('lists');
    const items = app.findCollectionByNameOrId('items');
    const claims = app.findCollectionByNameOrId('claims');
    const invites = app.findCollectionByNameOrId('invites');
    const add = (c, def) => {
      if (!c.fields.getByName(def.name)) c.fields.add(new Field(def));
    };

    // — groups —
    add(groups, { type: 'select', name: 'buyMode', maxSelect: 1, values: ['hucha', 'individual', 'mixto'] });
    add(groups, { type: 'bool', name: 'allowNewNames' });
    add(groups, { type: 'relation', name: 'treasurer', collectionId: lists.id, maxSelect: 1 });
    add(groups, { type: 'relation', name: 'deputy', collectionId: lists.id, maxSelect: 1 });
    add(groups, { type: 'relation', name: 'revealAskedBy', collectionId: users.id, maxSelect: 1 });
    add(groups, { type: 'number', name: 'revealedAt', onlyInt: true, min: 0 });
    const hookOnly = ['members', 'admins', 'owner', 'drawRounds', 'treasurer', 'deputy', 'revealAskedBy', 'revealedAt'].map((f) => `@request.body.${f}:isset = false`).join(' && ');
    groups.updateRule = `${AUTH} && admins ?= ${ME} && ${hookOnly}`;
    app.save(groups);

    // — lists (plazas) —
    add(lists, { type: 'select', name: 'kind', maxSelect: 1, values: ['person', 'child'] });
    add(lists, { type: 'number', name: 'claimedAt', onlyInt: true, min: 0 });
    add(lists, { type: 'select', name: 'via', maxSelect: 1, values: ['creator', 'personal', 'approved'] });
    add(lists, { type: 'relation', name: 'approvedBy', collectionId: users.id, maxSelect: 1 });
    add(lists, { type: 'relation', name: 'prevUser', collectionId: users.id, maxSelect: 1 });
    lists.createRule = `${AUTH} && group.admins ?= ${ME} && user = "" && claimedAt = 0 && via = "" && approvedBy = "" && prevUser = "" && ((kind = "child" && managers ?= ${ME}) || (kind = "person" && managers:length = 0 && birthYear = 0))`;
    const listLocked = ['group', 'user', 'managers', 'kind', 'claimedAt', 'via', 'approvedBy', 'prevUser'].map((f) => `@request.body.${f}:isset = false`).join(' && ');
    lists.updateRule = `${AUTH} && group.members ?= ${ME} && (user = ${ME} || managers ?= ${ME} || (kind = "person" && user = "" && group.admins ?= ${ME})) && ${listLocked}`;
    lists.deleteRule = `${AUTH} && group.members ?= ${ME} && ((kind = "child" && managers ?= ${ME}) || (kind = "person" && user = "" && group.admins ?= ${ME}))`;
    lists.indexes = [...lists.indexes, "CREATE UNIQUE INDEX idx_lists_group_user ON lists (`group`, user) WHERE user != ''"];
    app.save(lists);

    // — items: sorpresas y retirados —
    add(items, { type: 'bool', name: 'secret' });
    add(items, { type: 'bool', name: 'removed' });
    const VIS = `${AUTH} && list.group.members ?= ${ME} && (list.user != ${ME} || (secret = false && removed = false))`;
    const OWN = `secret = false && removed = false && (list.user = ${ME} || list.managers ?= ${ME})`;
    const SURP = `secret = true && createdBy = ${ME} && list.user != ${ME}`;
    items.listRule = VIS;
    items.viewRule = VIS;
    items.createRule = `${AUTH} && list.group.members ?= ${ME} && createdBy = ${ME} && removed = false && ((secret = false && (list.user = ${ME} || list.managers ?= ${ME})) || (secret = true && list.kind = "person" && list.user != ${ME}))`;
    items.updateRule = `${AUTH} && list.group.members ?= ${ME} && (${OWN} || ${SURP}) && @request.body.list:isset = false && @request.body.createdBy:isset = false && @request.body.secret:isset = false && @request.body.removed:isset = false`;
    items.deleteRule = `${AUTH} && list.group.members ?= ${ME} && (${OWN} || ${SURP})`;
    app.save(items);

    // — claims: solo por POST /api/lazo/gift —
    add(claims, { type: 'select', name: 'kind', maxSelect: 1, values: ['self', 'pot'] });
    add(claims, { type: 'relation', name: 'paidBy', collectionId: users.id, maxSelect: 1 });
    add(claims, { type: 'number', name: 'paidCents', onlyInt: true, min: 0, max: 100000000 });
    add(claims, { type: 'number', name: 'boughtAt', onlyInt: true, min: 0 });
    claims.createRule = null;
    claims.updateRule = null;
    claims.deleteRule = null;
    claims.indexes = ['CREATE INDEX idx_claims_item ON claims (item)'];
    app.save(claims);

    // — budgets: sin cambios de esquema (la regla SEE_LIST ya existe) —

    // — payments —
    app.save(
      new Collection({
        type: 'base',
        name: 'payments',
        fields: [
          { type: 'relation', name: 'group', collectionId: groups.id, maxSelect: 1, required: true, cascadeDelete: true },
          { type: 'relation', name: 'from', collectionId: users.id, maxSelect: 1, required: true },
          { type: 'relation', name: 'to', collectionId: users.id, maxSelect: 1, required: true },
          { type: 'number', name: 'amountCents', onlyInt: true, min: 1, max: 100000000, required: true },
          { type: 'bool', name: 'sub' },
          { type: 'number', name: 'at', onlyInt: true, min: 0 },
        ],
        listRule: `${AUTH} && (from = ${ME} || to = ${ME})`,
        viewRule: `${AUTH} && (from = ${ME} || to = ${ME})`,
        createRule: `${AUTH} && (from = ${ME} || to = ${ME}) && from != to && group.members ?= from && group.members ?= to && ((sub = false && (from = group.treasurer.user || to = group.treasurer.user)) || (sub = true && (from = group.deputy.user || to = group.deputy.user) && from != group.treasurer.user && to != group.treasurer.user))`,
        updateRule: null,
        deleteRule: `${AUTH} && (from = ${ME} || to = ${ME})`,
        indexes: ['CREATE INDEX idx_pay_group ON payments (`group`)'],
      }),
    );

    // — invites: enlace personal por plaza —
    add(invites, { type: 'relation', name: 'list', collectionId: lists.id, maxSelect: 1, cascadeDelete: true });
    app.save(invites);

    // — joinRequests —
    app.save(
      new Collection({
        type: 'base',
        name: 'joinRequests',
        fields: [
          { type: 'relation', name: 'group', collectionId: groups.id, maxSelect: 1, required: true, cascadeDelete: true },
          { type: 'relation', name: 'user', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
          { type: 'relation', name: 'list', collectionId: lists.id, maxSelect: 1, cascadeDelete: true },
          { type: 'text', name: 'name', required: true, max: 40 },
          { type: 'text', name: 'code', pattern: '^\\d{4}$' },
          { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['pending', 'approved', 'rejected'] },
          { type: 'relation', name: 'decidedBy', collectionId: users.id, maxSelect: 1 },
        ],
        listRule: `${AUTH} && (user = ${ME} || (status = "pending" && group.admins ?= ${ME}))`,
        viewRule: `${AUTH} && (user = ${ME} || (status = "pending" && group.admins ?= ${ME}))`,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        indexes: ['CREATE UNIQUE INDEX idx_joinreq_group_user ON joinRequests (`group`, user)'],
      }),
    );

    // — datos existentes —
    for (const g of app.findAllRecords('groups')) {
      if (!g.getString('buyMode')) {
        g.set('buyMode', 'individual');
        app.save(g);
      }
    }
    for (const l of app.findAllRecords('lists')) {
      if (!l.getString('kind')) {
        l.set('kind', l.getString('user') ? 'person' : 'child');
        app.save(l);
      }
    }
    for (const c of app.findAllRecords('claims')) {
      if (!c.getString('kind')) {
        c.set('kind', 'self');
        if (c.getString('status') === 'bought') {
          c.set('paidBy', c.getString('user'));
          c.set('paidCents', app.findRecordById('items', c.getString('item')).getInt('priceCents'));
        }
        app.save(c);
      }
    }

    const s = app.settings();
    s.rateLimits.rules = [
      ...s.rateLimits.rules,
      { label: 'POST /api/lazo/invite-info', maxRequests: 20, duration: 60, audience: '' },
      { label: 'POST /api/lazo/gift', maxRequests: 60, duration: 60, audience: '@auth' },
      { label: 'GET /api/lazo/received', maxRequests: 10, duration: 60, audience: '@auth' },
    ];
    app.save(s);
    void SEE_LIST;
  },
  (app) => {
    for (const name of ['joinRequests', 'payments']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch {
        /* ya no existe */
      }
    }
  },
);
