function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function authContext(e) {
  if (!e.auth) throw new UnauthorizedError("Se necesita iniciar sesión.");
  var active = e.auth.get("active") === true;
  if (!active) throw new ForbiddenError("El usuario está inactivo.");
  var workspace = asText(e.auth.get("workspace"));
  if (!workspace) throw new ForbiddenError("El usuario no tiene un espacio de trabajo asignado.");
  return {
    id: e.auth.id,
    name: asText(e.auth.get("name")) || asText(e.auth.get("email")),
    role: asText(e.auth.get("role")),
    workspace: workspace,
    technicianId: asText(e.auth.get("technician_id"))
  };
}

function assertWorkspace(context, requested) {
  if (!requested || requested !== context.workspace) {
    throw new ForbiddenError("El espacio de trabajo solicitado no pertenece al usuario.");
  }
}

function assertRole(context, allowed) {
  if (allowed.indexOf(context.role) === -1) {
    throw new ForbiddenError("El perfil actual no permite esta operación.");
  }
}

function findOptional(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params || {});
  } catch (_) {
    return null;
  }
}

function nextSequence(app) {
  var records = app.findRecordsByFilter("isivolt_sync_events", "", "-sequence", 1, 0);
  if (!records.length) return 1;
  return Number(records[0].get("sequence") || 0) + 1;
}

function appendEvent(app, workspace, entity, entityId, action, payload, actorUserId, occurredAt) {
  var record = new Record(app.findCollectionByNameOrId("isivolt_sync_events"));
  record.set("sequence", nextSequence(app));
  record.set("workspace", workspace);
  record.set("entity", entity);
  record.set("entity_id", entityId);
  record.set("action", action);
  record.set("payload", asObject(payload));
  record.set("actor_user_id", actorUserId || "");
  record.set("occurred_at", occurredAt || nowIso());
  app.save(record);
  return record;
}

function findEntity(app, workspace, entity, externalId) {
  return findOptional(
    app,
    "isivolt_entities",
    "workspace = {:workspace} && entity = {:entity} && external_id = {:externalId}",
    { workspace: workspace, entity: entity, externalId: externalId }
  );
}

function saveEntity(app, workspace, entity, externalId, payload, actorUserId) {
  var existing = findEntity(app, workspace, entity, externalId);
  var record = existing || new Record(app.findCollectionByNameOrId("isivolt_entities"));
  var action = existing ? "update" : "insert";
  record.set("workspace", workspace);
  record.set("entity", entity);
  record.set("external_id", externalId);
  record.set("payload", asObject(payload));
  record.set("version", existing ? Number(existing.get("version") || 1) + 1 : 1);
  record.set("updated_by", actorUserId || "");
  record.set("source_updated_at", asText(payload.updatedAt) || nowIso());
  app.save(record);
  appendEvent(app, workspace, entity, externalId, action, payload, actorUserId, nowIso());
  return record;
}

function registerDevice(app, workspace, payload, actorUserId) {
  var deviceId = asText(payload.deviceId);
  if (!deviceId) return;
  var record = findOptional(
    app,
    "isivolt_devices",
    "workspace = {:workspace} && external_id = {:externalId}",
    { workspace: workspace, externalId: deviceId }
  ) || new Record(app.findCollectionByNameOrId("isivolt_devices"));
  record.set("workspace", workspace);
  record.set("external_id", deviceId);
  record.set("user_id", actorUserId);
  record.set("name", asText(payload.deviceName) || "Dispositivo ISIVOLT");
  record.set("platform", asText(payload.platform) || "web");
  record.set("last_seen_at", nowIso());
  app.save(record);
}

function validateStation(app, workspace, payload, actorUserId) {
  var type = asText(payload.type);
  var physical = type === "delivery" || type === "return" || type === "incident";
  if (!physical) return;

  var stationId = asText(payload.stationId);
  var nonce = asText(payload.stationNonce);
  var verifiedAt = asText(payload.stationVerifiedAt);
  var requireStation = asText($os.getenv("ISIVOLT_REQUIRE_STATION")).toLowerCase() === "true";
  var supplied = Boolean(stationId || nonce || verifiedAt);

  if (requireStation && (!stationId || !nonce || !verifiedAt)) {
    throw new ForbiddenError("La operación necesita validación presencial del almacén.");
  }
  if (!supplied) return;
  if (!stationId || !nonce || !verifiedAt) {
    throw new BadRequestError("La prueba presencial está incompleta.");
  }

  var operationId = asText(payload.operationId) || asText(payload.id);
  var existing = findOptional(
    app,
    "isivolt_station_redemptions",
    "workspace = {:workspace} && station_id = {:stationId} && nonce = {:nonce}",
    { workspace: workspace, stationId: stationId, nonce: nonce }
  );
  if (existing) {
    if (asText(existing.get("operation_id")) !== operationId) {
      throw new ForbiddenError("El código presencial ya fue utilizado por otra operación.");
    }
    return;
  }

  var record = new Record(app.findCollectionByNameOrId("isivolt_station_redemptions"));
  record.set("workspace", workspace);
  record.set("station_id", stationId);
  record.set("nonce", nonce);
  record.set("operation_id", operationId);
  record.set("verified_at", verifiedAt);
  record.set("actor_user_id", actorUserId);
  app.save(record);
}

function validateAndApplyMovement(tool, payload, context) {
  var type = asText(payload.type);
  var technicianId = asText(payload.technicianId);
  var previousStatus = asText(payload.previousStatus);
  var nextStatus = asText(payload.nextStatus);
  var currentStatus = asText(tool.status);

  if (["delivery", "return", "incident", "adjustment"].indexOf(type) === -1) {
    throw new BadRequestError("Tipo de movimiento no permitido.");
  }
  if (currentStatus !== previousStatus) {
    throw new BadRequestError("La herramienta cambió de estado en otro dispositivo. Sincroniza y vuelve a intentarlo.");
  }
  if (context.role === "coordinator") {
    throw new ForbiddenError("El perfil Coordinador es de consulta.");
  }
  if (context.role === "technician") {
    if (!context.technicianId || technicianId !== context.technicianId) {
      throw new ForbiddenError("Un técnico solo puede operar con su propia identidad vinculada.");
    }
    if (type === "adjustment") {
      throw new ForbiddenError("Un técnico no puede registrar ajustes administrativos.");
    }
  }

  if (type === "delivery") {
    if (currentStatus !== "available" || !technicianId || nextStatus !== "loaned") {
      throw new BadRequestError("La entrega no mantiene una transición válida.");
    }
    tool.status = "loaned";
    tool.holderTechnicianId = technicianId;
    tool.loanedAt = asText(payload.occurredAt) || nowIso();
  } else if (type === "return" || type === "incident") {
    if (currentStatus !== "loaned" || asText(tool.holderTechnicianId) !== technicianId) {
      throw new BadRequestError("La herramienta no está prestada al técnico indicado.");
    }
    if (type === "return" && (nextStatus !== "available" || asText(payload.condition) !== "ok")) {
      throw new BadRequestError("La devolución correcta debe finalizar como disponible.");
    }
    if (type === "incident" && ["review", "damaged"].indexOf(nextStatus) === -1) {
      throw new BadRequestError("La incidencia debe finalizar en revisión o averiada.");
    }
    tool.status = nextStatus;
    delete tool.holderTechnicianId;
    delete tool.loanedAt;
  } else {
    assertRole(context, ["admin", "warehouse"]);
    var state = asObject(payload.toolState);
    if (asText(state.id) !== asText(payload.toolId) || asText(state.status) !== nextStatus) {
      throw new BadRequestError("El ajuste no contiene un estado final coherente.");
    }
    Object.keys(state).forEach(function (key) { tool[key] = state[key]; });
  }

  tool.updatedAt = asText(payload.occurredAt) || nowIso();
  return tool;
}

function health(e) {
  return e.json(200, {
    ok: true,
    service: "isivolt-pocketbase",
    version: "rc41",
    time: nowIso()
  });
}

function me(e) {
  return e.json(200, authContext(e));
}

function sync(e) {
  var context = authContext(e);
  var workspace = asText(e.request.url.query().get("workspace"));
  assertWorkspace(context, workspace);
  var cursor = Number(e.request.url.query().get("cursor") || 0);
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

  var records = e.app.findRecordsByFilter(
    "isivolt_sync_events",
    "workspace = {:workspace} && sequence > {:cursor}",
    "sequence",
    500,
    0,
    { workspace: workspace, cursor: cursor }
  );
  var events = records.map(function (record) {
    return {
      id: Number(record.get("sequence")),
      workspace_id: asText(record.get("workspace")),
      entity: asText(record.get("entity")),
      entity_id: asText(record.get("entity_id")),
      action: asText(record.get("action")),
      payload: asObject(record.get("payload")),
      actor_user_id: asText(record.get("actor_user_id")) || null,
      occurred_at: asText(record.get("occurred_at"))
    };
  });

  return e.json(200, {
    events: events,
    cursor: events.length ? events[events.length - 1].id : cursor,
    hasMore: events.length === 500
  });
}

function entity(e) {
  var context = authContext(e);
  assertRole(context, ["admin", "warehouse"]);
  var data = new DynamicModel({
    workspaceId: "",
    entity: "",
    entityId: "",
    action: "upsert",
    payload: {}
  });
  e.bindBody(data);
  assertWorkspace(context, asText(data.workspaceId));

  var entityName = asText(data.entity);
  var entityId = asText(data.entityId);
  if (["tools", "technicians", "accessories", "maintenance_records"].indexOf(entityName) === -1 || !entityId) {
    throw new BadRequestError("Entidad o identificador no válido.");
  }

  if (asText(data.action) === "delete") {
    var existing = findEntity(e.app, context.workspace, entityName, entityId);
    if (existing) e.app.delete(existing);
    appendEvent(e.app, context.workspace, entityName, entityId, "delete", { id: entityId }, context.id, nowIso());
    return e.json(200, { ok: true, deleted: true });
  }

  var record = saveEntity(e.app, context.workspace, entityName, entityId, asObject(data.payload), context.id);
  return e.json(200, { ok: true, id: record.id, version: Number(record.get("version")) });
}

function movement(e) {
  var context = authContext(e);
  assertRole(context, ["admin", "warehouse", "technician"]);
  var data = new DynamicModel({ workspaceId: "", payload: {} });
  e.bindBody(data);
  assertWorkspace(context, asText(data.workspaceId));
  var payload = asObject(data.payload);
  var movementId = asText(payload.id);
  var operationId = asText(payload.operationId) || movementId;
  var toolId = asText(payload.toolId);
  var movementType = asText(payload.type);
  if (!movementId || !operationId || !toolId || !movementType) {
    throw new BadRequestError("El movimiento no contiene todos los identificadores obligatorios.");
  }

  var result = null;
  e.app.runInTransaction(function (txApp) {
    var duplicate = findOptional(
      txApp,
      "isivolt_movements",
      "workspace = {:workspace} && (external_id = {:movementId} || (operation_id = {:operationId} && tool_id = {:toolId} && movement_type = {:movementType}))",
      {
        workspace: context.workspace,
        movementId: movementId,
        operationId: operationId,
        toolId: toolId,
        movementType: movementType
      }
    );
    if (duplicate) {
      result = { ok: true, duplicate: true, movementId: asText(duplicate.get("external_id")) };
      return;
    }

    var toolRecord = findEntity(txApp, context.workspace, "tools", toolId);
    if (!toolRecord) throw new NotFoundError("La herramienta no existe en el servidor central.");
    var tool = asObject(toolRecord.get("payload"));
    validateStation(txApp, context.workspace, payload, context.id);
    var updatedTool = validateAndApplyMovement(tool, payload, context);

    toolRecord.set("payload", updatedTool);
    toolRecord.set("version", Number(toolRecord.get("version") || 1) + 1);
    toolRecord.set("updated_by", context.id);
    toolRecord.set("source_updated_at", asText(updatedTool.updatedAt) || nowIso());
    txApp.save(toolRecord);

    var movementRecord = new Record(txApp.findCollectionByNameOrId("isivolt_movements"));
    movementRecord.set("workspace", context.workspace);
    movementRecord.set("external_id", movementId);
    movementRecord.set("operation_id", operationId);
    movementRecord.set("tool_id", toolId);
    movementRecord.set("technician_id", asText(payload.technicianId));
    movementRecord.set("movement_type", movementType);
    movementRecord.set("previous_status", asText(payload.previousStatus));
    movementRecord.set("next_status", asText(payload.nextStatus));
    movementRecord.set("payload", payload);
    movementRecord.set("actor_user_id", context.id);
    movementRecord.set("device_id", asText(payload.deviceId));
    movementRecord.set("station_id", asText(payload.stationId));
    movementRecord.set("station_nonce", asText(payload.stationNonce));
    movementRecord.set("station_verified_at", asText(payload.stationVerifiedAt));
    movementRecord.set("occurred_at", asText(payload.occurredAt) || nowIso());
    txApp.save(movementRecord);

    registerDevice(txApp, context.workspace, payload, context.id);
    appendEvent(txApp, context.workspace, "tools", toolId, "update", updatedTool, context.id, nowIso());
    appendEvent(txApp, context.workspace, "movements", movementId, "insert", payload, context.id, asText(payload.occurredAt) || nowIso());
    result = { ok: true, duplicate: false, movementId: movementId, tool: updatedTool };
  });

  return e.json(200, result);
}

module.exports = {
  health: health,
  me: me,
  sync: sync,
  entity: entity,
  movement: movement
};
