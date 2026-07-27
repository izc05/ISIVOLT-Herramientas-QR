migrate((app) => {
  const requests = new Collection({
    type: "base",
    name: "isivolt_registration_requests",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "workspace", type: "text", required: true, max: 64 },
      { name: "user_id", type: "text", required: true, max: 40 },
      { name: "name", type: "text", required: true, max: 120 },
      { name: "email", type: "email", required: true },
      { name: "technician_code", type: "text", required: true, max: 80 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "approved", "rejected"] },
      { name: "requested_at", type: "date", required: true },
      { name: "reviewed_by", type: "text", max: 40 },
      { name: "reviewed_at", type: "date" },
      { name: "rejection_reason", type: "text", max: 500 }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_registration_workspace_email ON isivolt_registration_requests (workspace, email)",
      "CREATE INDEX idx_registration_workspace_status ON isivolt_registration_requests (workspace, status, requested_at DESC)",
      "CREATE INDEX idx_registration_technician_code ON isivolt_registration_requests (workspace, technician_code)"
    ]
  });
  app.save(requests);
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("isivolt_registration_requests"));
  } catch (_) {
    // Reversión idempotente.
  }
});
