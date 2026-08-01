migrate((app) => {
  const readRule = '@request.auth.id != "" && workspace = @request.auth.workspace';
  const createRule = '@request.auth.id != "" && @request.body.workspace = @request.auth.workspace';
  const coordinatorRule = '@request.auth.id != "" && workspace = @request.auth.workspace && (@request.auth.role = "admin" || @request.auth.role = "coordinator")';

  const technicians = new Collection({
    id: 'ivptechs0000001', type: 'base', name: 'isivolt_technicians',
    listRule: readRule, viewRule: readRule,
    createRule: '@request.auth.id != "" && @request.body.workspace = @request.auth.workspace && (@request.auth.role = "admin" || @request.auth.role = "coordinator")',
    updateRule: coordinatorRule, deleteRule: coordinatorRule,
    fields: [
      { type: 'text', name: 'workspace', required: true, max: 80 },
      { type: 'text', name: 'external_id', required: true, max: 120 },
      { type: 'text', name: 'code', required: true, max: 40 },
      { type: 'text', name: 'name', required: true, max: 180 },
      { type: 'text', name: 'category', max: 120 },
      { type: 'text', name: 'phone', max: 40 },
      { type: 'email', name: 'email' },
      { type: 'text', name: 'qr_payload', max: 240 },
      { type: 'text', name: 'nfc_tag', max: 120 },
      { type: 'bool', name: 'active' },
      { type: 'text', name: 'source_created', max: 60 },
      { type: 'text', name: 'source_updated', max: 60 },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_ivp_tech_external ON isivolt_technicians (workspace, external_id)',
      'CREATE UNIQUE INDEX idx_ivp_tech_code ON isivolt_technicians (workspace, code)',
    ],
  });
  app.save(technicians);

  const users = new Collection({
    id: 'ivpusers0000001', type: 'auth', name: 'isivolt_users',
    listRule: 'id = @request.auth.id || (@request.auth.role = "admin" && workspace = @request.auth.workspace)',
    viewRule: 'id = @request.auth.id || (@request.auth.role = "admin" && workspace = @request.auth.workspace)',
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: 'text', name: 'display_name', required: true, max: 180 },
      { type: 'select', name: 'role', required: true, maxSelect: 1, values: ['admin', 'coordinator', 'technician'] },
      { type: 'text', name: 'workspace', required: true, max: 80 },
      { type: 'text', name: 'technician_external_id', max: 120 },
      { type: 'bool', name: 'active' },
    ],
    passwordAuth: { enabled: true, identityFields: ['email'] },
    indexes: [
      'CREATE INDEX idx_ivp_users_workspace ON isivolt_users (workspace)',
      'CREATE UNIQUE INDEX idx_ivp_users_technician ON isivolt_users (workspace, technician_external_id) WHERE technician_external_id != ""',
    ],
  });
  app.save(users);

  const tools = new Collection({
    id: 'ivptools0000001', type: 'base', name: 'isivolt_tools',
    listRule: readRule, viewRule: readRule, createRule, updateRule: readRule, deleteRule: coordinatorRule,
    fields: [
      { type: 'text', name: 'workspace', required: true, max: 80 },
      { type: 'text', name: 'external_id', required: true, max: 120 },
      { type: 'text', name: 'code', required: true, max: 40 },
      { type: 'text', name: 'name', required: true, max: 180 },
      { type: 'text', name: 'category', max: 120 },
      { type: 'text', name: 'location', max: 180 },
      { type: 'text', name: 'brand', max: 120 },
      { type: 'text', name: 'model', max: 120 },
      { type: 'text', name: 'serial_number', max: 120 },
      { type: 'text', name: 'qr_payload', required: true, max: 240 },
      { type: 'text', name: 'nfc_tag', max: 120 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['available', 'loaned', 'review', 'retired'] },
      { type: 'text', name: 'technician_external_id', max: 120 },
      { type: 'text', name: 'source_created', max: 60 },
      { type: 'text', name: 'source_updated', max: 60 },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_ivp_tools_external ON isivolt_tools (workspace, external_id)',
      'CREATE UNIQUE INDEX idx_ivp_tools_code ON isivolt_tools (workspace, code)',
      'CREATE INDEX idx_ivp_tools_holder ON isivolt_tools (workspace, technician_external_id)',
    ],
  });
  app.save(tools);

  const batches = new Collection({
    id: 'ivpbatch0000001', type: 'base', name: 'isivolt_batches',
    listRule: readRule, viewRule: readRule, createRule, updateRule: null, deleteRule: null,
    fields: [
      { type: 'text', name: 'workspace', required: true, max: 80 },
      { type: 'text', name: 'external_id', required: true, max: 120 },
      { type: 'select', name: 'operation', required: true, maxSelect: 1, values: ['loan', 'return'] },
      { type: 'text', name: 'technician_external_id', required: true, max: 120 },
      { type: 'json', name: 'tool_ids', required: true, maxSize: 200000 },
      { type: 'select', name: 'operator_mode', required: true, maxSelect: 1, values: ['administrator', 'self-service'] },
      { type: 'select', name: 'identification_method', required: true, maxSelect: 1, values: ['manual', 'qr', 'nfc', 'authenticated'] },
      { type: 'select', name: 'scan_method', required: true, maxSelect: 1, values: ['manual', 'qr', 'nfc', 'mixed'] },
      { type: 'text', name: 'started_at', required: true, max: 60 },
      { type: 'text', name: 'completed_at', required: true, max: 60 },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_ivp_batches_external ON isivolt_batches (workspace, external_id)',
      'CREATE INDEX idx_ivp_batches_technician ON isivolt_batches (workspace, technician_external_id)',
    ],
  });
  app.save(batches);

  const movements = new Collection({
    id: 'ivpmoves0000001', type: 'base', name: 'isivolt_movements',
    listRule: readRule, viewRule: readRule, createRule, updateRule: null, deleteRule: null,
    fields: [
      { type: 'text', name: 'workspace', required: true, max: 80 },
      { type: 'text', name: 'external_id', required: true, max: 120 },
      { type: 'select', name: 'type', required: true, maxSelect: 1, values: ['loan', 'return', 'tool_created', 'technician_created', 'nfc_linked'] },
      { type: 'text', name: 'occurred_at', required: true, max: 60 },
      { type: 'text', name: 'tool_external_id', max: 120 },
      { type: 'text', name: 'technician_external_id', max: 120 },
      { type: 'text', name: 'batch_external_id', max: 120 },
      { type: 'select', name: 'identification_method', maxSelect: 1, values: ['manual', 'qr', 'nfc', 'authenticated'] },
      { type: 'select', name: 'scan_method', maxSelect: 1, values: ['manual', 'qr', 'nfc', 'mixed'] },
      { type: 'text', name: 'detail', required: true, max: 500 },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_ivp_movements_external ON isivolt_movements (workspace, external_id)',
      'CREATE INDEX idx_ivp_movements_batch ON isivolt_movements (workspace, batch_external_id)',
      'CREATE INDEX idx_ivp_movements_time ON isivolt_movements (workspace, occurred_at)',
    ],
  });
  app.save(movements);
}, (app) => {
  for (const name of ['isivolt_movements', 'isivolt_batches', 'isivolt_tools', 'isivolt_users', 'isivolt_technicians']) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch { /* continuar */ }
  }
});
