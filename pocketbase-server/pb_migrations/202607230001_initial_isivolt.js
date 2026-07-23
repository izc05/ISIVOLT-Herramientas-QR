migrate((app) => {
  const users = new Collection({
    type: "auth",
    name: "users",
    listRule: "id = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'warehouse'",
    viewRule: "id = @request.auth.id || @request.auth.role = 'admin' || @request.auth.role = 'warehouse'",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    authRule: "active = true",
    fields: [
      { name: "name", type: "text", required: true, max: 120, presentable: true },
      { name: "role", type: "select", required: true, maxSelect: 1, values: ["admin", "warehouse", "coordinator", "technician"] },
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "technician_id", type: "text", max: 80 },
      { name: "active", type: "bool", required: true }
    ],
    passwordAuth: { enabled: true, identityFields: ["email"] },
    otp: { enabled: false },
    indexes: [
      "CREATE INDEX idx_users_workspace_role ON users (workspace, role)",
      "CREATE UNIQUE INDEX idx_users_workspace_technician ON users (workspace, technician_id) WHERE technician_id != '' AND active = 1"
    ]
  });
  app.save(users);

  const entities = new Collection({
    type: "base",
    name: "isivolt_entities",
    listRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace",
    viewRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "entity", type: "select", required: true, maxSelect: 1, values: ["tools", "technicians", "accessories", "maintenance_records"] },
      { name: "external_id", type: "text", required: true, max: 100 },
      { name: "payload", type: "json", required: true },
      { name: "version", type: "number", required: true, min: 1 },
      { name: "updated_by", type: "text", max: 40 },
      { name: "source_updated_at", type: "date" }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_entities_key ON isivolt_entities (workspace, entity, external_id)",
      "CREATE INDEX idx_entities_workspace_entity ON isivolt_entities (workspace, entity)"
    ]
  });
  app.save(entities);

  const movements = new Collection({
    type: "base",
    name: "isivolt_movements",
    listRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace",
    viewRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "external_id", type: "text", required: true, max: 100 },
      { name: "operation_id", type: "text", required: true, max: 100 },
      { name: "tool_id", type: "text", required: true, max: 100 },
      { name: "technician_id", type: "text", max: 100 },
      { name: "movement_type", type: "select", required: true, maxSelect: 1, values: ["delivery", "return", "incident", "adjustment"] },
      { name: "previous_status", type: "select", required: true, maxSelect: 1, values: ["available", "loaned", "review", "damaged", "retired"] },
      { name: "next_status", type: "select", required: true, maxSelect: 1, values: ["available", "loaned", "review", "damaged", "retired"] },
      { name: "payload", type: "json", required: true },
      { name: "actor_user_id", type: "text", required: true, max: 40 },
      { name: "device_id", type: "text", max: 120 },
      { name: "station_id", type: "text", max: 100 },
      { name: "station_nonce", type: "text", max: 160 },
      { name: "station_verified_at", type: "date" },
      { name: "occurred_at", type: "date", required: true }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_movements_external ON isivolt_movements (workspace, external_id)",
      "CREATE UNIQUE INDEX idx_movements_operation_tool_type ON isivolt_movements (workspace, operation_id, tool_id, movement_type)",
      "CREATE INDEX idx_movements_workspace_time ON isivolt_movements (workspace, occurred_at DESC)"
    ]
  });
  app.save(movements);

  const events = new Collection({
    type: "base",
    name: "isivolt_sync_events",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "sequence", type: "number", required: true, min: 1 },
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "entity", type: "select", required: true, maxSelect: 1, values: ["tools", "technicians", "movements", "accessories", "maintenance_records"] },
      { name: "entity_id", type: "text", required: true, max: 100 },
      { name: "action", type: "select", required: true, maxSelect: 1, values: ["insert", "update", "delete"] },
      { name: "payload", type: "json", required: true },
      { name: "actor_user_id", type: "text", max: 40 },
      { name: "occurred_at", type: "date", required: true }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_sync_events_sequence ON isivolt_sync_events (sequence)",
      "CREATE INDEX idx_sync_events_workspace_sequence ON isivolt_sync_events (workspace, sequence)"
    ]
  });
  app.save(events);

  const devices = new Collection({
    type: "base",
    name: "isivolt_devices",
    listRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace && (@request.auth.role = 'admin' || @request.auth.role = 'warehouse' || user_id = @request.auth.id)",
    viewRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace && (@request.auth.role = 'admin' || @request.auth.role = 'warehouse' || user_id = @request.auth.id)",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "external_id", type: "text", required: true, max: 120 },
      { name: "user_id", type: "text", required: true, max: 40 },
      { name: "name", type: "text", max: 255 },
      { name: "platform", type: "text", max: 120 },
      { name: "last_seen_at", type: "date", required: true }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_devices_key ON isivolt_devices (workspace, external_id)"
    ]
  });
  app.save(devices);

  const redemptions = new Collection({
    type: "base",
    name: "isivolt_station_redemptions",
    listRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace && (@request.auth.role = 'admin' || @request.auth.role = 'warehouse')",
    viewRule: "@request.auth.id != '' && @request.auth.active = true && workspace = @request.auth.workspace && (@request.auth.role = 'admin' || @request.auth.role = 'warehouse')",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "station_id", type: "text", required: true, max: 100 },
      { name: "nonce", type: "text", required: true, max: 160 },
      { name: "operation_id", type: "text", required: true, max: 100 },
      { name: "verified_at", type: "date", required: true },
      { name: "actor_user_id", type: "text", required: true, max: 40 }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_station_nonce ON isivolt_station_redemptions (workspace, station_id, nonce)"
    ]
  });
  app.save(redemptions);
}, (app) => {
  [
    "isivolt_station_redemptions",
    "isivolt_devices",
    "isivolt_sync_events",
    "isivolt_movements",
    "isivolt_entities",
    "users"
  ].forEach((name) => {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (_) {
      // La reversión es idempotente.
    }
  });
});
