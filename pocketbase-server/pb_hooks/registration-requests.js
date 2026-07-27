function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso() {
  return new Date().toISOString();
}

function findOptional(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params || {});
  } catch (_) {
    return null;
  }
}

function bind(e, shape) {
  var model = new DynamicModel(shape);
  e.bindBody(model);
  return model;
}

function adminContext(e) {
  if (!e.auth) throw new UnauthorizedError("Se necesita iniciar sesión.");
  if (e.auth.get("active") !== true) throw new ForbiddenError("El usuario está inactivo.");
  if (asText(e.auth.get("role")) !== "admin") {
    throw new ForbiddenError("Solo un administrador puede revisar solicitudes de acceso.");
  }
  var workspace = asText(e.auth.get("workspace"));
  if (!workspace) throw new ForbiddenError("El administrador no tiene un espacio de trabajo asignado.");
  return { id: e.auth.id, workspace: workspace };
}

function assertWorkspace(context, requested) {
  if (!requested || requested !== context.workspace) {
    throw new ForbiddenError("El espacio de trabajo solicitado no pertenece al administrador.");
  }
}

function workspaceExists(app, workspace) {
  return Boolean(findOptional(
    app,
    "isivolt_users",
    "workspace = {:workspace} && role = 'admin' && active = true",
    { workspace: workspace }
  ));
}

function findAuthByEmail(app, email) {
  try {
    return app.findAuthRecordByEmail("isivolt_users", email);
  } catch (_) {
    return null;
  }
}

function requestJson(record) {
  return {
    id: record.id,
    userId: asText(record.get("user_id")),
    workspace: asText(record.get("workspace")),
    name: asText(record.get("name")),
    email: asText(record.get("email")),
    technicianCode: asText(record.get("technician_code")),
    status: asText(record.get("status")),
    requestedAt: asText(record.get("requested_at")),
    reviewedBy: asText(record.get("reviewed_by")),
    reviewedAt: asText(record.get("reviewed_at")),
    rejectionReason: asText(record.get("rejection_reason"))
  };
}

function submit(e) {
  var data = bind(e, {
    workspaceId: "",
    name: "",
    email: "",
    technicianCode: "",
    password: ""
  });
  var workspace = asText(data.workspaceId);
  var name = asText(data.name);
  var email = asText(data.email).toLowerCase();
  var technicianCode = asText(data.technicianCode).toUpperCase();
  var password = asText(data.password);

  if (!workspace || !workspaceExists(e.app, workspace)) {
    throw new BadRequestError("El centro de trabajo indicado no está disponible.");
  }
  if (name.length < 3 || name.length > 120) {
    throw new BadRequestError("Escribe el nombre y los apellidos del técnico.");
  }
  if (!email || email.indexOf("@") < 1 || email.length > 180) {
    throw new BadRequestError("Escribe un correo válido.");
  }
  if (technicianCode.length < 2 || technicianCode.length > 80) {
    throw new BadRequestError("Escribe el código interno del técnico.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new BadRequestError("La contraseña debe contener entre 8 y 72 caracteres.");
  }

  var existingUser = findAuthByEmail(e.app, email);
  if (existingUser && existingUser.get("active") === true) {
    throw new BadRequestError("Ya existe una cuenta activa con este correo.");
  }
  if (existingUser && asText(existingUser.get("workspace")) !== workspace) {
    throw new BadRequestError("El correo ya pertenece a otro centro de trabajo.");
  }
  if (existingUser && asText(existingUser.get("role")) !== "technician") {
    throw new BadRequestError("El correo ya pertenece a un perfil diferente.");
  }

  var request = findOptional(
    e.app,
    "isivolt_registration_requests",
    "workspace = {:workspace} && email = {:email}",
    { workspace: workspace, email: email }
  );
  if (request && asText(request.get("status")) === "approved") {
    throw new BadRequestError("La solicitud ya fue aprobada. Inicia sesión con tu correo.");
  }

  var user = existingUser || new Record(e.app.findCollectionByNameOrId("isivolt_users"));
  user.set("email", email);
  user.setPassword(password);
  user.setVerified(false);
  user.set("name", name);
  user.set("role", "technician");
  user.set("workspace", workspace);
  user.set("technician_id", "");
  user.set("active", false);
  e.app.save(user);

  request = request || new Record(e.app.findCollectionByNameOrId("isivolt_registration_requests"));
  request.set("workspace", workspace);
  request.set("user_id", user.id);
  request.set("name", name);
  request.set("email", email);
  request.set("technician_code", technicianCode);
  request.set("status", "pending");
  request.set("requested_at", nowIso());
  request.set("reviewed_by", "");
  request.set("reviewed_at", "");
  request.set("rejection_reason", "");
  e.app.save(request);

  return e.json(202, {
    ok: true,
    status: "pending",
    message: "Solicitud recibida. Un administrador debe vincularla con tu ficha técnica."
  });
}

function status(e) {
  var data = bind(e, { workspaceId: "", email: "" });
  var workspace = asText(data.workspaceId);
  var email = asText(data.email).toLowerCase();
  var request = findOptional(
    e.app,
    "isivolt_registration_requests",
    "workspace = {:workspace} && email = {:email}",
    { workspace: workspace, email: email }
  );
  if (!request) {
    return e.json(200, { found: false, status: "missing" });
  }
  var value = requestJson(request);
  return e.json(200, {
    found: true,
    status: value.status,
    requestedAt: value.requestedAt,
    reviewedAt: value.reviewedAt,
    rejectionReason: value.status === "rejected" ? value.rejectionReason : ""
  });
}

function list(e) {
  var context = adminContext(e);
  var workspace = asText(e.request.url.query().get("workspace"));
  assertWorkspace(context, workspace);
  var records = e.app.findRecordsByFilter(
    "isivolt_registration_requests",
    "workspace = {:workspace}",
    "-requested_at",
    500,
    0,
    { workspace: workspace }
  );
  return e.json(200, { requests: records.map(requestJson) });
}

function technicianExists(app, workspace, technicianId) {
  return findOptional(
    app,
    "isivolt_entities",
    "workspace = {:workspace} && entity = 'technicians' && external_id = {:technicianId}",
    { workspace: workspace, technicianId: technicianId }
  );
}

function approve(e) {
  var context = adminContext(e);
  var data = bind(e, { workspaceId: "", requestId: "", technicianId: "" });
  var workspace = asText(data.workspaceId);
  var requestId = asText(data.requestId);
  var technicianId = asText(data.technicianId);
  assertWorkspace(context, workspace);
  if (!requestId || !technicianId) {
    throw new BadRequestError("Solicitud y ficha técnica son obligatorias.");
  }

  var request = e.app.findRecordById("isivolt_registration_requests", requestId);
  if (asText(request.get("workspace")) !== workspace) {
    throw new ForbiddenError("La solicitud pertenece a otro espacio de trabajo.");
  }
  if (asText(request.get("status")) !== "pending") {
    throw new BadRequestError("La solicitud ya fue revisada.");
  }
  if (!technicianExists(e.app, workspace, technicianId)) {
    throw new BadRequestError("La ficha técnica seleccionada no existe en el servidor.");
  }

  var duplicate = findOptional(
    e.app,
    "isivolt_users",
    "workspace = {:workspace} && role = 'technician' && technician_id = {:technicianId} && active = true",
    { workspace: workspace, technicianId: technicianId }
  );
  var user = e.app.findRecordById("isivolt_users", asText(request.get("user_id")));
  if (duplicate && duplicate.id !== user.id) {
    throw new BadRequestError("La ficha técnica ya está vinculada a otra cuenta activa.");
  }

  user.set("name", asText(request.get("name")));
  user.set("role", "technician");
  user.set("workspace", workspace);
  user.set("technician_id", technicianId);
  user.set("active", true);
  user.setVerified(true);
  e.app.save(user);

  request.set("status", "approved");
  request.set("reviewed_by", context.id);
  request.set("reviewed_at", nowIso());
  request.set("rejection_reason", "");
  e.app.save(request);

  return e.json(200, { ok: true, request: requestJson(request), technicianId: technicianId });
}

function reject(e) {
  var context = adminContext(e);
  var data = bind(e, { workspaceId: "", requestId: "", reason: "" });
  var workspace = asText(data.workspaceId);
  var requestId = asText(data.requestId);
  var reason = asText(data.reason);
  assertWorkspace(context, workspace);
  if (!requestId) throw new BadRequestError("Selecciona una solicitud.");
  if (reason.length < 4) throw new BadRequestError("Indica brevemente el motivo del rechazo.");

  var request = e.app.findRecordById("isivolt_registration_requests", requestId);
  if (asText(request.get("workspace")) !== workspace) {
    throw new ForbiddenError("La solicitud pertenece a otro espacio de trabajo.");
  }
  if (asText(request.get("status")) !== "pending") {
    throw new BadRequestError("La solicitud ya fue revisada.");
  }

  var user = e.app.findRecordById("isivolt_users", asText(request.get("user_id")));
  user.set("active", false);
  user.setVerified(false);
  user.set("technician_id", "");
  e.app.save(user);

  request.set("status", "rejected");
  request.set("reviewed_by", context.id);
  request.set("reviewed_at", nowIso());
  request.set("rejection_reason", reason);
  e.app.save(request);

  return e.json(200, { ok: true, request: requestJson(request) });
}

module.exports = {
  submit: submit,
  status: status,
  list: list,
  approve: approve,
  reject: reject
};
