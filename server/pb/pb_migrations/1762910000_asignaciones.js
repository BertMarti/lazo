/// <reference path="../pb_data/types.d.ts" />
// v1.1.2 (V-35): quien sale del grupo deja de ver su asignación del amigo invisible. No se borra la fila: el
// sorteo es de todos y la de quien sale es la que dice a quién le tocaba regalar (puede volver a su plaza).

const RULE = '@request.auth.id != "" && giver = @request.auth.id';

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId('assignments');
    c.listRule = c.viewRule = `${RULE} && draw.group.members.id ?= @request.auth.id`;
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId('assignments');
    c.listRule = c.viewRule = RULE;
    app.save(c);
  },
);
