/// <reference path="../pb_data/types.d.ts" />
// V-29: límite de peticiones para la copia del grupo. Restaurar es una sola llamada; un bucle llenaría el disco.

migrate(
  (app) => {
    const s = app.settings();
    s.rateLimits.rules = [...s.rateLimits.rules, { label: 'POST /api/lazo/restore', maxRequests: 3, duration: 60, audience: '@auth' }];
    app.save(s);
  },
  (app) => {
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.filter((r) => r.label !== 'POST /api/lazo/restore');
    app.save(s);
  },
);
