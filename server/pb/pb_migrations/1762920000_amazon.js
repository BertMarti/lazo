/// <reference path="../pb_data/types.d.ts" />
// v1.2: lista de Amazon leída por el servidor (apagada por defecto). Límite de PocketBase por IP como red de
// seguridad: en casa toda la familia comparte IP, así que el de cada persona (5 por hora) va en amazon.cjs.

const LABELS = ['POST /api/lazo/amazon-lista', 'POST /api/lazo/amazon-corto', 'GET /api/lazo/capacidades'];

migrate(
  (app) => {
    const s = app.settings();
    s.rateLimits.rules = [
      ...s.rateLimits.rules.filter((r) => !LABELS.includes(r.label)),
      { label: 'POST /api/lazo/amazon-lista', maxRequests: 20, duration: 3600, audience: '@auth' },
      { label: 'POST /api/lazo/amazon-corto', maxRequests: 10, duration: 60, audience: '@auth' },
      { label: 'GET /api/lazo/capacidades', maxRequests: 30, duration: 60, audience: '' },
    ];
    app.save(s);
  },
  (app) => {
    const s = app.settings();
    s.rateLimits.rules = s.rateLimits.rules.filter((r) => !LABELS.includes(r.label));
    app.save(s);
  },
);
