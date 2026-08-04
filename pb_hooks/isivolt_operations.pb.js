function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value) {
  if (!Array.isArray(value)) return [];
  var seen = {};
  var result = [];
  value.forEach(function (item) {
    var normalized = text(item);
    if (!normalized || seen[normalized]) return;
    seen[normalized] = true;
    result.push(normalized);
  });
  return result;
}

function optionalRecord(app, collection, filter, params) {
  try {
    return app.findFirstRecordByFilter(collection, filter, params || {});
  } catch (_) {
    return null;
  }
}

function authContext(e) {
  if (!e.auth) throw new UnauthorizedError("Se necesita iniciar sesión.");
  if (e.auth.get("active") !== true) throw new ForbiddenError("La cuenta está desactivada.");

  var workspace = text(e.auth.get("workspace"));
  var role = text(e.auth.get("role"));
  var technicianId = text(e.auth.get("technician_external_id"));
  if (!workspace) throw new ForbiddenError("La cuenta no tiene espacio de trabajo.");
  if (["admin", "coordinator", "technician"].indexOf(role) === -1) {
    throw new ForbiddenError("El perfil no permite operaciones de material.");
  }

  return {
    id: e.auth.id,
    workspace: workspace,
    role: role,
    technicianId: technicianId
  };
}

function validateRequest(data, context) {
  var batchId = text(data.batch_external_id);
  var operation = text(data.operation);
  var technicianId = text(data.technician_external_id);
  var toolIds = textArray(data.tool_ids);
  var operatorMode = text(data.operator_mode);
  var identificationMethod = text(data.identification_method);
  var scanMethod = text(data.scan_method);
  var startedAt = text(data.started_at);
  var completedAt = text(data.completed_at) || new Date().toISOString();
  var movements = Array.isArray(data.movements) ? data.movements : [];

  if (!batchId || batchId.length > 120) throw new BadRequestError("Identificador de lote no válido.");
  if (["loan", "return"].indexOf(operation) === -1) throw new BadRequestError("Operación no válida.");
  if (!technicianId || technicianId.length > 120) throw new BadRequestError("Técnico no válido.");
  if (!toolIds.length || toolIds.length > 100) throw new BadRequestError("El lote debe contener entre 1 y 100 artículos.");
  if (["administrator", "self-service"].indexOf(operatorMode) === -1) throw new BadRequestError("Modo de operación no válido.");
  if (["manual", "qr", "nfc", "authenticated"].indexOf(identificationMethod) === -1) {
    throw new BadRequestError("Identificación no válida.");
  }
  if (["manual", "qr", "nfc", "mixed"].indexOf(scanMethod) === -1) throw new BadRequestError("Método de lectura no válido.");
  if (!startedAt || startedAt.length > 60 || completedAt.length > 60) throw new BadRequestError("Fechas del lote no válidas.");

  if (context.role === "technician") {
    if (!context.technicianId || technicianId !== context.technicianId) {
      throw new ForbiddenError("Un técnico solo puede operar con su propia ficha.");
    }
    if (operatorMode !== "self-service" || identificationMethod !== "authenticated") {
      throw new ForbiddenError("El autoservicio técnico debe estar autenticado.");
    }
  } else if (operatorMode !== "administrator") {
    throw new ForbiddenError("Administrador y coordinador deben registrar la operación como administrativa.");
  }

  var movementByTool = {};
  movements.forEach(function (movement) {
    if (!movement || typeof movement !== "object") return;
    var toolId = text(movement.tool_external_id);
    var externalId = text(movement.external_id);
    if (!toolId || !externalId || externalId.length > 120) return;
    movementByTool[toolId] = {
      externalId: externalId,
      detail: text(movement.detail).slice(0, 500)
    };
  });

  toolIds.forEach(function (toolId, index) {
    if (!movementByTool[toolId]) {
      var generated = ("mov-" + batchId + "-" + String(index + 1)).slice(0, 120);
      movementByTool[toolId] = { externalId: generated, detail: "" };
    }
  });

  return {
    batchId: batchId,
    operation: operation,
    technicianId: technicianId,
    toolIds: toolIds,
    operatorMode: operatorMode,
    identificationMethod: identificationMethod,
    scanMethod: scanMethod,
    startedAt: startedAt,
    completedAt: completedAt,
    movementByTool: movementByTool
  };
}

function toolSnapshot(record) {
  return {
    external_id: text(record.get("external_id")),
    code: text(record.get("code")),
    name: text(record.get("name")),
    status: text(record.get("status")),
    technician_external_id: text(record.get("technician_external_id")),
    service_state: text(record.get("service_state")) || "ready",
    source_updated: text(record.get("source_updated"))
  };
}

function operationResponse(batchId, duplicate, tools) {
  return {
    ok: true,
    duplicate: duplicate,
    batch_external_id: batchId,
    tools: tools.map(toolSnapshot)
  };
}

routerAdd("POST", "/api/isivolt/operations", function (e) {
  var context = authContext(e);
  var data = e.requestInfo().body || {};
  var input = validateRequest(data, context);
  var result = null;

  e.app.runInTransaction(function (txApp) {
    var existingBatch = optionalRecord(
      txApp,
      "isivolt_batches",
      "workspace = {:workspace} && external_id = {:externalId}",
      { workspace: context.workspace, externalId: input.batchId }
    );

    if (existingBatch) {
      if (
        text(existingBatch.get("operation")) !== input.operation
        || text(existingBatch.get("technician_external_id")) !== input.technicianId
      ) {
        throw new ApiError(409, "El identificador del lote ya pertenece a otra operación.");
      }
      var existingTools = [];
      input.toolIds.forEach(function (toolId) {
        var tool = optionalRecord(
          txApp,
          "isivolt_tools",
          "workspace = {:workspace} && external_id = {:externalId}",
          { workspace: context.workspace, externalId: toolId }
        );
        if (tool) existingTools.push(tool);
      });
      result = operationResponse(input.batchId, true, existingTools);
      return;
    }

    var technician = optionalRecord(
      txApp,
      "isivolt_technicians",
      "workspace = {:workspace} && external_id = {:externalId}",
      { workspace: context.workspace, externalId: input.technicianId }
    );
    if (!technician) throw new NotFoundError("El técnico no existe en el servidor central.");

    if (input.operation === "loan") {
      var techStatus = text(technician.get("technician_status")) || (technician.get("active") === true ? "active" : "inactive");
      if (technician.get("active") !== true || techStatus !== "active") {
        throw new ApiError(409, "El técnico ya no está disponible para recibir material.");
      }
    }

    var tools = [];
    input.toolIds.forEach(function (toolId) {
      var tool = optionalRecord(
        txApp,
        "isivolt_tools",
        "workspace = {:workspace} && external_id = {:externalId}",
        { workspace: context.workspace, externalId: toolId }
      );
      if (!tool) throw new NotFoundError("Una herramienta del lote no existe en el servidor central.");

      var status = text(tool.get("status"));
      var holder = text(tool.get("technician_external_id"));
      var serviceState = text(tool.get("service_state")) || "ready";
      if (input.operation === "loan") {
        if (status !== "available" || holder || serviceState !== "ready") {
          throw new ApiError(409, "La herramienta " + text(tool.get("code")) + " ya no está disponible.");
        }
      } else if (status !== "loaned" || holder !== input.technicianId) {
        throw new ApiError(409, "La herramienta " + text(tool.get("code")) + " ya no está prestada al técnico indicado.");
      }
      tools.push(tool);
    });

    tools.forEach(function (tool) {
      tool.set("status", input.operation === "loan" ? "loaned" : "available");
      tool.set("technician_external_id", input.operation === "loan" ? input.technicianId : "");
      tool.set("source_updated", input.completedAt);
      txApp.save(tool);
    });

    var batch = new Record(txApp.findCollectionByNameOrId("isivolt_batches"));
    batch.set("workspace", context.workspace);
    batch.set("external_id", input.batchId);
    batch.set("operation", input.operation);
    batch.set("technician_external_id", input.technicianId);
    batch.set("tool_ids", input.toolIds);
    batch.set("operator_mode", input.operatorMode);
    batch.set("identification_method", input.identificationMethod);
    batch.set("scan_method", input.scanMethod);
    batch.set("started_at", input.startedAt);
    batch.set("completed_at", input.completedAt);
    txApp.save(batch);

    tools.forEach(function (tool) {
      var toolId = text(tool.get("external_id"));
      var movementInput = input.movementByTool[toolId];
      var movement = new Record(txApp.findCollectionByNameOrId("isivolt_movements"));
      movement.set("workspace", context.workspace);
      movement.set("external_id", movementInput.externalId);
      movement.set("type", input.operation);
      movement.set("occurred_at", input.completedAt);
      movement.set("tool_external_id", toolId);
      movement.set("technician_external_id", input.technicianId);
      movement.set("batch_external_id", input.batchId);
      movement.set("identification_method", input.identificationMethod);
      movement.set("scan_method", input.scanMethod);
      movement.set(
        "detail",
        movementInput.detail || (
          input.operation === "loan"
            ? text(tool.get("name")) + " asignada a " + text(technician.get("name"))
            : text(tool.get("name")) + " devuelta por " + text(technician.get("name"))
        )
      );
      txApp.save(movement);
    });

    result = operationResponse(input.batchId, false, tools);
  });

  return e.json(200, result);
}, $apis.requireAuth("isivolt_users"));
