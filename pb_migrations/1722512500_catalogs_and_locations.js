migrate((app) => {
  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const bodyWorkspace = '@request.body.workspace = @request.auth.workspace';
  const manager = '(@request.auth.role = "admin" || @request.auth.role = "coordinator")';

  const createCatalog = (id, name, extraFields = [], extraIndexes = []) => {
    const collection = new Collection({
      id,
      type: 'base',
      name,
      listRule: `${authenticated} && ${sameWorkspace}`,
      viewRule: `${authenticated} && ${sameWorkspace}`,
      createRule: `${authenticated} && ${bodyWorkspace} && ${manager}`,
      updateRule: `${authenticated} && ${sameWorkspace} && ${manager} && @request.body.workspace:changed = false && @request.body.external_id:changed = false`,
      deleteRule: `${authenticated} && ${sameWorkspace} && ${manager}`,
      fields: [
        { type: 'text', name: 'workspace', required: true, max: 80 },
        { type: 'text', name: 'external_id', required: true, max: 120 },
        { type: 'text', name: 'name', required: true, max: 180 },
        { type: 'text', name: 'code', max: 40 },
        { type: 'text', name: 'color', max: 24 },
        { type: 'text', name: 'icon', max: 80 },
        { type: 'bool', name: 'active' },
        ...extraFields,
        { type: 'text', name: 'source_created', max: 60 },
        { type: 'text', name: 'source_updated', max: 60 },
      ],
      indexes: [
        `CREATE UNIQUE INDEX idx_${name}_external ON ${name} (workspace, external_id)`,
        `CREATE UNIQUE INDEX idx_${name}_name ON ${name} (workspace, name)`,
        `CREATE UNIQUE INDEX idx_${name}_code ON ${name} (workspace, code) WHERE code != ""`,
        ...extraIndexes,
      ],
    });
    app.save(collection);
  };

  createCatalog('ivptoolcat00001', 'isivolt_tool_categories');
  createCatalog('ivptechcat00001', 'isivolt_technician_categories');
  createCatalog(
    'ivplocation0001',
    'isivolt_locations',
    [
      { type: 'text', name: 'parent_external_id', max: 120 },
      { type: 'text', name: 'description', max: 500 },
    ],
    ['CREATE INDEX idx_isivolt_locations_parent ON isivolt_locations (workspace, parent_external_id)'],
  );
}, (app) => {
  for (const name of ['isivolt_locations', 'isivolt_technician_categories', 'isivolt_tool_categories']) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch { /* continuar */ }
  }
});
