/// <reference path="../pb_data/types.d.ts" />
// Esquema y reglas de Lazo. LA REGLA: sobre la lista de X, todos los miembros del grupo MENOS X ven
// reservas, compras, aportaciones y presupuesto. Se aplica aquí (API, expand, filtros y tiempo real),
// no solo en la interfaz. Tests: server/test/rules.test.mjs.

const ME = '@request.auth.id';
const AUTH = `${ME} != ""`;
// Sobre un regalo: soy del grupo y la lista NO es mía (las de niños, sin user, las ven todos).
// Todas las reglas empiezan por AUTH (auditoría G-7: "" y NULL se confunden con visitantes sin sesión).
const SEE_ITEM = `${AUTH} && item.list.group.members.id ?= ${ME} && item.list.user != ${ME}`;
const SEE_LIST = `${AUTH} && list.group.members.id ?= ${ME} && list.user != ${ME}`;

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    if (!users.fields.getByName('color')) users.fields.add(new TextField({ name: 'color', max: 20 }));
    users.createRule = null; // solo se entra por invitación (hook /api/lazo/join)
    users.updateRule = `id = ${ME}`;
    users.deleteRule = `id = ${ME}`;
    users.passwordAuth.enabled = false; // sin contraseñas: token de 180 días que se renueva al abrir la app
    users.authToken.duration = 15552000;
    users.authAlert.enabled = false; // los correos son sintéticos (@lazo.invalid)
    const nameField = users.fields.getByName('name');
    if (nameField) nameField.max = 40;
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
        { type: 'number', name: 'drawRounds', onlyInt: true, min: 0 },
      ],
      listRule: `${AUTH} && members.id ?= ${ME}`,
      viewRule: `${AUTH} && members.id ?= ${ME}`,
      createRule: AUTH, // el hook fija owner, members y admins
      updateRule: `${AUTH} && admins.id ?= ${ME} && @request.body.members:isset = false && @request.body.admins:isset = false && @request.body.owner:isset = false && @request.body.drawRounds:isset = false`,
      deleteRule: `${AUTH} && owner = ${ME}`,
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
      listRule: `${AUTH} && group.members.id ?= ${ME}`,
      viewRule: `${AUTH} && group.members.id ?= ${ME}`,
      // Las listas de miembros las crea el hook al entrar; desde la API solo listas de niños.
      createRule: `${AUTH} && group.admins.id ?= ${ME} && user = "" && managers.id ?= ${ME}`,
      updateRule: `${AUTH} && group.members.id ?= ${ME} && (user = ${ME} || managers.id ?= ${ME}) && @request.body.group:isset = false && @request.body.user:isset = false && @request.body.managers:isset = false`,
      deleteRule: `${AUTH} && group.members.id ?= ${ME} && user = "" && managers.id ?= ${ME}`,
      indexes: ['CREATE INDEX idx_lists_group ON lists (`group`)'],
    });

    const EDIT_LIST = `${AUTH} && list.group.members.id ?= ${ME} && (list.user = ${ME} || list.managers.id ?= ${ME})`;
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
      listRule: `${AUTH} && list.group.members.id ?= ${ME}`,
      viewRule: `${AUTH} && list.group.members.id ?= ${ME}`,
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
      deleteRule: `${AUTH} && user = ${ME}`,
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
      deleteRule: `${AUTH} && user = ${ME}`,
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
        { type: 'number', name: 'round', onlyInt: true, min: 0 },
        rel('participants', users, { maxSelect: 500 }),
        rel('createdBy', users),
      ],
      listRule: `${AUTH} && group.members.id ?= ${ME}`,
      viewRule: `${AUTH} && group.members.id ?= ${ME}`,
      createRule: null, // solo el hook /api/lazo/draw
      updateRule: null,
      deleteRule: null,
    });

    col({
      name: 'assignments',
      fields: [rel('draw', draws, { required: true, cascadeDelete: true }), rel('giver', users, { required: true }), rel('receiver', users, { required: true })],
      // Cada uno ve SOLO a quién le regala. Ni quien organiza ve el resto.
      listRule: `${AUTH} && giver = ${ME}`,
      viewRule: `${AUTH} && giver = ${ME}`,
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
    users.listRule = `${AUTH} && (id = ${ME} || groups_via_members.members.id ?= ${ME})`;
    users.viewRule = users.listRule;
    app.save(users);

    const s = app.settings();
    s.rateLimits.enabled = true;
    // Detrás de Caddy (auditoría G-2): la IP real viene en X-Forwarded-For, que Caddy sobrescribe.
    s.trustedProxy.headers = ['X-Forwarded-For'];
    s.trustedProxy.useLeftmostIP = false;
    s.logs.logIP = false; // app familiar: sin IP en los registros (G-16)
    s.batch.enabled = true; // importar Excel en lotes de 50 (G-15)
    s.batch.maxRequests = 50;
    s.rateLimits.rules = [
      { label: '*:auth', maxRequests: 2, duration: 3, audience: '' },
      { label: 'POST /api/lazo/device-code', maxRequests: 5, duration: 60, audience: '@auth' },
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
