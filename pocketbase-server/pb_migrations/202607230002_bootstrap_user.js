migrate((app) => {
  const email = ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_EMAIL") || "").trim();
  const password = ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD") || "").trim();
  const workspace = ($os.getenv("ISIVOLT_BOOTSTRAP_WORKSPACE") || "ISIVOLT").trim();
  const name = ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_NAME") || "Administrador ISIVOLT").trim();
  if (!email || !password) return;

  try {
    app.findAuthRecordByEmail("isivolt_users", email);
    return;
  } catch (_) {
    // El usuario inicial todavía no existe.
  }

  const record = new Record(app.findCollectionByNameOrId("isivolt_users"));
  record.set("email", email);
  record.setPassword(password);
  record.setVerified(true);
  record.set("name", name);
  record.set("role", "admin");
  record.set("workspace", workspace);
  record.set("active", true);
  app.save(record);
}, (app) => {
  const email = ($os.getenv("ISIVOLT_BOOTSTRAP_ADMIN_EMAIL") || "").trim();
  if (!email) return;
  try {
    app.delete(app.findAuthRecordByEmail("isivolt_users", email));
  } catch (_) {
    // Reversión idempotente.
  }
});
