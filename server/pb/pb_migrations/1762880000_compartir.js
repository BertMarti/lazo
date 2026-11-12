/// <reference path="../pb_data/types.d.ts" />
// v0.6: enlace de solo lectura de una lista (POST/DELETE /api/lazo/share, GET /api/lazo/shared/{token}).
// Solo se guarda el hash del token. Nadie lista ni lee esta colección: solo los hooks.

migrate(
  (app) => {
    const lists = app.findCollectionByNameOrId('lists');
    app.save(
      new Collection({
        type: 'base',
        name: 'shares',
        fields: [
          { type: 'relation', name: 'list', collectionId: lists.id, maxSelect: 1, required: true, cascadeDelete: true },
          { type: 'text', name: 'tokenHash', required: true, max: 64 },
        ],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        indexes: ['CREATE UNIQUE INDEX idx_shares_hash ON shares (tokenHash)', 'CREATE UNIQUE INDEX idx_shares_list ON shares (list)'],
      }),
    );

    const s = app.settings();
    s.rateLimits.rules = [
      ...s.rateLimits.rules,
      { label: 'GET /api/lazo/shared/', maxRequests: 30, duration: 60, audience: '' },
      { label: 'POST /api/lazo/share', maxRequests: 10, duration: 60, audience: '@auth' },
    ];
    app.save(s);
  },
  (app) => {
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.filter((r) => !['GET /api/lazo/shared/', 'POST /api/lazo/share'].includes(r.label));
    app.save(s);
    try {
      app.delete(app.findCollectionByNameOrId('shares'));
    } catch {
      /* ya no existe */
    }
  },
);
