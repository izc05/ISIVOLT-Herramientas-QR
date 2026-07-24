migrate((app) => {
  const workspace = ($os.getenv("ISIVOLT_BOOTSTRAP_WORKSPACE") || "ISIVOLT").trim();

  const ensureUser = (options) => {
    if (!options.email || !options.password) return;
    try {
      app.findAuthRecordByEmail("isivolt_users", options.email);
      return;
    } catch (_) {
      // El usuario inicial todavía no existe.
    }

    const record = new Record(app.findCollectionByNameOrId("isivolt_users"));
    record.set("email", options.email);
    record.setPassword(options.password);
    record.setVerified(true);
    record.set("name", options.name);
    record.set("role", options.role);
    record.set("workspace", workspace);
    record.set("technician_id", options.technicianId || "");
    record.set("active", true);
    app.save(record);
  };

  ensureUser({
    email: ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_EMAIL") || "").trim(),
    password: ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD") || "").trim(),
    name: ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_NAME") || "Administrador ISIVOLT").trim(),
    role: "admin",
    technicianId: ""
  });

  ensureUser({
    email: ($os.getenv("ISIVOLT_BOOTSTRAP_TECH_EMAIL") || "").trim(),
    password: ($os.getenv("ISIVOLT_BOOTSTRAP_TECH_PASSWORD") || "").trim(),
    name: ($os.getenv("ISIVOLT_BOOTSTRAP_TECH_NAME") || "Técnico ISIVOLT").trim(),
    role: "technician",
    technicianId: ($os.getenv("ISIVOLT_BOOTSTRAP_TECHNICIAN_ID") || "").trim()
  });
}, (app) => {
  [
    ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_EMAIL") || "").trim(),
    ($os.getenv("ISIVOLT_BOOTSTRAP_TECH_EMAIL") || "").trim()
  ].filter(Boolean).forEach((email) => {
    try {
      app.delete(app.findAuthRecordByEmail("isivolt_users", email));
    } catch (_) {
      // Reversión idempotente.
    }
  });
});
