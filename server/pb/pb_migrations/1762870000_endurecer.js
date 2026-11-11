/// <reference path="../pb_data/types.d.ts" />
// Endurecimiento de la segunda auditoría (docs/security/AUDIT.md V-9, V-12).

migrate(
  (app) => {
    // V-12: buyMode obligatorio (antes se rellenan los grupos que lo tengan vacío).
    for (const g of app.findAllRecords('groups')) {
      if (!g.getString('buyMode')) {
        g.set('buyMode', 'mixto');
        app.save(g);
      }
    }
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.getByName('buyMode').required = true;
    app.save(groups);

    // V-9: las etiquetas de límite casan por prefijo solo si acaban en «/».
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.map((r) => ({
      label: r.label === 'GET /api/lazo/received' ? 'GET /api/lazo/received/' : r.label,
      maxRequests: r.maxRequests,
      duration: r.duration,
      audience: r.audience,
    }));
    app.save(s);
  },
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.fields.getByName('buyMode').required = false;
    app.save(groups);
  },
);
