function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value) {
  var raw = asText(value).replace(/[()\s.-]/g, "");
  if (raw.indexOf("00") === 0) raw = "+" + raw.slice(2);
  if (raw.indexOf("+") === 0) return "+" + raw.slice(1).replace(/\D/g, "");
  return raw.replace(/\D/g, "");
}

function validPhone(value) {
  var digits = normalizePhone(value).replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function asBool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function authContext(e) {
  if (!e.auth) throw new UnauthorizedError("Se necesita iniciar sesión.");
  if (e.auth.get("active") !== true) throw new ForbiddenError("El usuario está inactivo.");
  var workspace = asText(e.auth.get("workspace"));
  if (!workspace) throw new ForbiddenError("El usuario no tiene un espacio de trabajo asignado.");
  if (asText(e.auth.get("role")) !== "admin") {
    throw new ForbiddenError("Solo un administrador puede gestionar cuentas de técnicos.");
  }
  return { id: e.auth.id, workspace: workspace };
}

function assertWorkspace(context, requested) {
  if (!requested || requested !== context.workspace) {
    throw new ForbiddenError("El espacio de trabajo solicitado no pertenece al usuario.");
  }
}

function findOptional(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params || {});
  } catch (_) {
    return null;
  }
}

function accountJson(record) {
  return {
    id: record.id,
    email: asText(record.get("email")),
    phone: asText(record.get("phone")),
    name: asText(record.get("name")),
    technicianId: asText(record.get("technician_id")),
    active: record.get("active") === true,
    verified: record.get("verified") === true
  };
}

function list(e) {
  var context = authContext(e);
  var workspace = asText(e.request.url.query().get("workspace"));
  assertWorkspace(context, workspace);
  var records = e.app.findRecordsByFilter(
    "isivolt_users",
    "workspace = {:workspace} && role = 'technician'",
    "name,email",
    500,
    0,
    { workspace: workspace }
  );
  return e.json(200, { accounts: records.map(accountJson) });
}

function save(e) {
  var context = authContext(e);
  var data = new DynamicModel({
    workspaceId: "",
    technicianId: "",
    email: "",
    phone: "",
    password: "",
    name: "",
    active: true
  });
  e.bindBody(data);

  var workspace = asText(data.workspaceId);
  var technicianId = asText(data.technicianId);
  var email = asText(data.email).toLowerCase();
  var phone = normalizePhone(data.phone);
  var password = asText(data.password);
  var name = asText(data.name);
  var active = asBool(data.active, true);
  assertWorkspace(context, workspace);

  if (!technicianId || !email || !phone || !name) {
    throw new BadRequestError("Técnico, nombre, teléfono y correo son obligatorios.");
  }
  if (!validPhone(phone)) {
    throw new BadRequestError("El número de teléfono no es válido.");
  }

  var byTechnician = findOptional(
    e.app,
    "isivolt_users",
    "workspace = {:workspace} && role = 'technician' && technician_id = {:technicianId}",
    { workspace: workspace, technicianId: technicianId }
  );
  var byEmail = findOptional(
    e.app,
    "isivolt_users",
    "email = {:email}",
    { email: email }
  );
  var byPhone = findOptional(
    e.app,
    "isivolt_users",
    "phone = {:phone}",
    { phone: phone }
  );
  var candidates = [byTechnician, byEmail, byPhone].filter(function(record) { return Boolean(record); });
  var existing = candidates.length > 0 ? candidates[0] : null;
  if (candidates.some(function(record) { return record.id !== existing.id; })) {
    throw new BadRequestError("El teléfono o el correo ya pertenecen a otra cuenta.");
  }
  if (existing && asText(existing.get("workspace")) !== workspace) {
    throw new BadRequestError("El teléfono o el correo ya se utilizan en otro espacio de trabajo.");
  }
  if (existing && asText(existing.get("role")) !== "technician") {
    throw new BadRequestError("Los datos de acceso ya pertenecen a un usuario con otro perfil.");
  }

  var created = !existing;
  if (created && password.length < 8) {
    throw new BadRequestError("La cuenta nueva necesita una contraseña de al menos 8 caracteres.");
  }
  if (password && password.length < 8) {
    throw new BadRequestError("La contraseña debe contener al menos 8 caracteres.");
  }

  var record = existing || new Record(e.app.findCollectionByNameOrId("isivolt_users"));
  record.set("email", email);
  record.set("phone", phone);
  record.set("verified", true);
  record.set("name", name);
  record.set("role", "technician");
  record.set("workspace", workspace);
  record.set("technician_id", technicianId);
  record.set("active", active);
  record.set("registration_status", active ? "approved" : "rejected");
  if (password) record.setPassword(password);
  e.app.save(record);

  return e.json(200, { ok: true, created: created, account: accountJson(record) });
}

module.exports = { list: list, save: save };
