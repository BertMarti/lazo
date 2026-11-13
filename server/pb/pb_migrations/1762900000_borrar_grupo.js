/// <reference path="../pb_data/types.d.ts" />
// v1.1.2: un grupo solo se elimina con POST /api/lazo/group-delete (dueño, 403 claro y todo en una transacción).

migrate(
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.deleteRule = null;
    app.save(groups);
  },
  (app) => {
    const groups = app.findCollectionByNameOrId('groups');
    groups.deleteRule = '@request.auth.id != "" && owner = @request.auth.id';
    app.save(groups);
  },
);
