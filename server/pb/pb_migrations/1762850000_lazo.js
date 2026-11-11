/// <reference path="../pb_data/types.d.ts" />
// Esquema y reglas de Lazo. LA REGLA: sobre la lista de X, todos los miembros del grupo MENOS X ven
// reservas, compras, aportaciones y presupuesto. Se aplica aquí (API, expand, filtros y tiempo real),
// no solo en la interfaz. Tests: server/test/rules.test.mjs.

const ME = '@request.auth.id';
const AUTH = `${ME} != ""`;
// Sobre un regalo: soy del grupo y la lista NO es mía (las de niños, sin user, las ven todos).
const SEE_ITEM = `item.list.group.members ?= ${ME} && item.list.user != ${ME}`;
const SEE_LIST = `list.group.members ?= ${ME} && list.user != ${ME}`;

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    if (!users.fields.getByName('color')) users.fields.add(new TextField({ name: 'color', max: 20 }));
    users.createRule = null; // solo se entra por invitación (hook /api/lazo/join)
    users.updateRule = `id = ${ME}`;
    users.deleteRule = `id = ${ME}`;
    users.passwordAuth.enabled = false; // sin contraseñas: token de 180 días que se renueva al abrir la app
    users.authToken.duration = 15552000;
    app.save(users);

    const col = (def) => {
      const c = new Collection({ type: 'base', ...def });
      app.save(c);
      return c;
    };
    const rel = (name, target, o = {}) => ({ type: 'relation', name, collectionId: target.id, maxSelect: 1, ...o });

    const groups = col({
      name: 'groups',
      fields: [
        { type: 'text', name: 'name', required: true, max: 80 },
        { type: 'select', name: 'occasion', required: true, maxSelect: 1, values: ['navidad', 'cumpleanos', 'boda', 'bebe', 'otro'] },
        { type: 'text', name: 'date', max: 10, pattern: '^$|^\\d{4}-\\d{2}-\\d{2}$' },
        { type: 'text', name: 'currency', max: 3 },
        rel('owner', users),
        rel('members', users, { maxSelect: 500 }),
        rel('admins', users, { maxSelect: 50 }),
      ],
      listRule: `members ?= ${ME}`,
      viewRule: `members ?= ${ME}`,
      createRule: AUTH, // el hook fija owner, members y admins
      updateRule: `admins ?= ${ME} && @request.body.members:isset = false && @request.body.admins:isset = false && @request.body.owner:isset = false`,
      deleteRule: `owner = ${ME}`,
    });

    const lists = col({
      name: 'lists',
      fields: [
        rel('group', groups, { required: true, cascadeDelete: true }),
        { type: 'text', name: 'name', required: true, max: 40 },
        rel('user', users),
        rel('managers', users, { maxSelect: 10 }),
        { type: 'number', name: 'birthYear', onlyInt: true, min: 2000, max: 2100 },
        { type: 'text', name: 'notes', max: 500 },
      ],
      listRule: `group.members ?= ${ME}`,
      viewRule: `group.members ?= ${ME}`,
      // Las listas de miembros las crea el hook al entrar; desde la API solo listas de niños.
      createRule: `group.admins ?= ${ME} && user = "" && managers ?= ${ME}`,
      updateRule: `group.members ?= ${ME} && (user = ${ME} || managers ?= ${ME}) && @request.body.group:isset = false && @request.body.user:isset = false && @request.body.managers:isset = false`,
      deleteRule: `user = "" && managers ?= ${ME}`,
      indexes: ['CREATE INDEX idx_lists_group ON lists (`group`)'],
    });

    const EDIT_LIST = `list.group.members ?= ${ME} && (list.user = ${ME} || list.managers ?= ${ME})`;
    const items = col({
      name: 'items',
      fields: [
        rel('list', lists, { required: true, cascadeDelete: true }),
        { type: 'text', name: 'title', required: true, max: 200 },
        { type: 'url', name: 'url', onlyDomains: [], exceptDomains: [] },
        { type: 'url', name: 'image' },
        { type: 'number', name: 'priceCents', onlyInt: true, min: 0, max: 100000000 },
        { type: 'text', name: 'currency', max: 3 },
        { type: 'text', name: 'store', max: 80 },
        { type: 'text', name: 'size', max: 20 },
        { type: 'text', name: 'color', max: 40 },
        { type: 'number', name: 'priority', onlyInt: true, min: 1, max: 3, required: true },
        { type: 'number', name: 'quantity', onlyInt: true, min: 1, max: 20, required: true },
        { type: 'text', name: 'notes', max: 1000 },
        rel('createdBy', users),
      ],
      listRule: `list.group.members ?= ${ME}`,
      viewRule: `list.group.members ?= ${ME}`,
      createRule: `${EDIT_LIST} && createdBy = ${ME}`,
      updateRule: `${EDIT_LIST} && @request.body.list:isset = false && @request.body.createdBy:isset = false`,
      deleteRule: EDIT_LIST,
      indexes: ['CREATE INDEX idx_items_list ON items (list)'],
    });

    col({
      name: 'claims',
      fields: [
        rel('item', items, { required: true, cascadeDelete: true }),
        rel('user', users, { required: true }),
        { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['reserved', 'bought'] },
        { type: 'number', name: 'units', onlyInt: true, min: 1, max: 20 },
      ],
      listRule: SEE_ITEM,
      viewRule: SEE_ITEM,
      createRule: `${SEE_ITEM} && user = ${ME}`,
      updateRule: `user = ${ME} && ${SEE_ITEM} && @request.body.item:isset = false && @request.body.user:isset = false && @request.body.units:isset = false`,
      deleteRule: `user = ${ME}`,
      indexes: ['CREATE UNIQUE INDEX idx_claims_item_user ON claims (item, user)'],
    });

    col({
      name: 'contributions',
      fields: [
        rel('item', items, { required: true, cascadeDelete: true }),
        rel('user', users, { required: true }),
        { type: 'number', name: 'amountCents', onlyInt: true, min: 1, max: 100000000, required: true },
        { type: 'bool', name: 'paid' },
      ],
      listRule: SEE_ITEM,
      viewRule: SEE_ITEM,
      createRule: `${SEE_ITEM} && user = ${ME}`,
      // Cualquiera del grupo (menos el destinatario) marca «pagado»; el importe solo lo cambia quien lo puso.
      updateRule: `${SEE_ITEM} && @request.body.item:isset = false && @request.body.user:isset = false && (user = ${ME} || @request.body.amountCents:isset = false)`,
      deleteRule: `user = ${ME}`,
      indexes: ['CREATE UNIQUE INDEX idx_contrib_item_user ON contributions (item, user)'],
    });

    col({
      name: 'budgets',
      fields: [
        rel('list', lists, { required: true, cascadeDelete: true }),
        { type: 'number', name: 'amountCents', onlyInt: true, min: 0, max: 100000000, required: true },
      ],
      listRule: SEE_LIST,
      viewRule: SEE_LIST,
      createRule: SEE_LIST,
      updateRule: `${SEE_LIST} && @request.body.list:isset = false`,
      deleteRule: SEE_LIST,
      indexes: ['CREATE UNIQUE INDEX idx_budgets_list ON budgets (list)'],
    });

    const draws = col({
      name: 'draws',
      fields: [
        rel('group', groups, { required: true, cascadeDelete: true }),
        { type: 'number', name: 'budgetCents', onlyInt: true, min: 0, max: 100000000 },
        { type: 'json', name: 'exclusions', maxSize: 20000 },
        rel('participants', users, { maxSelect: 500 }),
        rel('createdBy', users),
      ],
      listRule: `group.members ?= ${ME}`,
      viewRule: `group.members ?= ${ME}`,
      createRule: null, // solo el hook /api/lazo/draw
      updateRule: null,
      deleteRule: null,
    });

    col({
      name: 'assignments',
      fields: [rel('draw', draws, { required: true, cascadeDelete: true }), rel('giver', users, { required: true }), rel('receiver', users, { required: true })],
      // Cada uno ve SOLO a quién le regala. Ni quien organiza ve el resto.
      listRule: `giver = ${ME}`,
      viewRule: `giver = ${ME}`,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    col({
      name: 'invites',
      fields: [
        rel('group', groups, { required: true, cascadeDelete: true }),
        { type: 'text', name: 'tokenHash', required: true, max: 64 },
        { type: 'number', name: 'expiresAt', onlyInt: true, required: true },
        { type: 'number', name: 'maxUses', onlyInt: true },
        { type: 'number', name: 'uses', onlyInt: true },
        { type: 'bool', name: 'revoked' },
        rel('createdBy', users),
      ],
      // Sin acceso por la API: solo los hooks.
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      indexes: ['CREATE UNIQUE INDEX idx_invites_hash ON invites (tokenHash)'],
    });

    col({
      name: 'deviceCodes',
      fields: [rel('user', users, { required: true, cascadeDelete: true }), { type: 'text', name: 'codeHash', required: true, max: 64 }, { type: 'number', name: 'expiresAt', onlyInt: true, required: true }],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      indexes: ['CREATE UNIQUE INDEX idx_device_hash ON deviceCodes (codeHash)'],
    });

    // Ver a otra persona solo si compartimos grupo (nombre y color; el correo es sintético y oculto).
    users.listRule = `id = ${ME} || groups_via_members.members ?= ${ME}`;
    users.viewRule = users.listRule;
    app.save(users);

    const s = app.settings();
    s.rateLimits.enabled = true;
    s.rateLimits.rules = [
      { label: 'POST /api/lazo/join', maxRequests: 10, duration: 60, audience: '' },
      { label: 'POST /api/lazo/device-claim', maxRequests: 10, duration: 60, audience: '' },
      { label: 'POST /api/lazo/unfurl', maxRequests: 20, duration: 60, audience: '@auth' },
      { label: '/api/', maxRequests: 300, duration: 10, audience: '' },
    ];
    app.save(s);
  },
  (app) => {
    for (const name of ['deviceCodes', 'invites', 'assignments', 'draws', 'budgets', 'contributions', 'claims', 'items', 'lists', 'groups']) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch {
        /* ya no existe */
      }
    }
  },
);
