/// <reference path="../pb_data/types.d.ts" />

(function () {
  var ROUTE = "/api/isivoltpro/batch-operation";

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function textArray(value) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    var result = [];
    for (var i = 0; i < value.length; i += 1) {
      var item = text(value[i]);
      if (!item || seen[item]) continue;
      seen[item] = true;
      result.push(item);
    }
    return result;
  }

  function createRecord(app, collectionName, values) {
    var collection = app.findCollectionByNameOrId(collectionName);
    var record = new Record(collection);
    Object.keys(values).forEach(function (key) {
      record.set(key, values[key]);
    });
    app.save(record);
    return record;
  }

  function findWorkspaceRecord(app, collection, workspace, externalId) {
    return app.findFirstRecordByFilter(
      collection,
      "workspace = {:workspace} && external_id = {:externalId}",
      { workspace: workspace, externalId: externalId }
    );
  }

  routerAdd("POST", ROUTE, function (e) {
    if (!e.auth) throw new UnauthorizedError("Debes iniciar sesión.");

    var body = e.requestInfo().body || {};
    var workspace = text(e.auth.get("workspace"));
    var role = text(e.auth.get("role"));
    var accountActive = e.auth.get("active") !== false;
    var operation = body.operation === "return" ? "return" : "loan";
    var operatorMode = body.operatorMode === "self-service" ? "self-service" : "administrator";
    var identificationMethod = text(body.identificationMethod) || "manual";
    var scanMethod = text(body.scanMethod) || "manual";
    var technicianExternalId = text(body.technicianExternalId);
    var toolExternalIds = textArray(body.toolExternalIds);
    var movementExternalIds = textArray(body.movementExternalIds);
    var batchExternalId = text(body.batchExternalId);
    var startedAt = text(body.startedAt);
    var completedAt = text(body.completedAt);

    if (!workspace || !accountActive) throw new ForbiddenError("La cuenta no está activa.");
    if (role !== "admin" && role !== "coordinator" && role !== "technician") {
      throw new ForbiddenError("Rol no autorizado.");
    }
    if (!technicianExternalId || !batchExternalId || !startedAt || !completedAt) {
      throw new BadRequestError("Faltan datos obligatorios del lote.");
    }
    if (toolExternalIds.length === 0 || movementExternalIds.length !== toolExternalIds.length) {
      throw new BadRequestError("El lote no contiene artículos válidos.");
    }
    if (["manual", "qr", "nfc", "authenticated"].indexOf(identificationMethod) < 0) {
      throw new BadRequestError("Método de identificación no válido.");
    }
    if (["manual", "qr", "nfc", "mixed"].indexOf(scanMethod) < 0) {
      throw new BadRequestError("Método de lectura no válido.");
    }

    if (role === "technician") {
      var ownTechnicianId = text(e.auth.get("technician_external_id"));
      if (
        operatorMode !== "self-service" ||
        identificationMethod !== "authenticated" ||
        !ownTechnicianId ||
        ownTechnicianId !== technicianExternalId
      ) {
        throw new ForbiddenError("La cuenta técnica solo puede operar con su propia ficha autenticada.");
      }
    }

    var response = null;

    e.app.runInTransaction(function (txApp) {
      var technician;
      try {
        technician = findWorkspaceRecord(txApp, "isivolt_technicians", workspace, technicianExternalId);
      } catch (error) {
        throw new NotFoundError("El técnico ya no existe en el servidor.");
      }

      if (operation === "loan") {
        var technicianStatus = text(technician.get("technician_status")) || "active";
        if (technician.get("active") === false || technicianStatus !== "active") {
          throw new BadRequestError("El técnico no está disponible para recibir material.");
        }
      }

      var tools = [];
      for (var i = 0; i < toolExternalIds.length; i += 1) {
        var toolId = toolExternalIds[i];
        var tool;
        try {
          tool = findWorkspaceRecord(txApp, "isivolt_tools", workspace, toolId);
        } catch (error) {
          throw new NotFoundError("Uno de los artículos todavía no existe en el servidor.");
        }

        var status = text(tool.get("status")) || "available";
        var serviceState = text(tool.get("service_state")) || "ready";
        var toolKind = text(tool.get("tool_kind")) || "returnable-tool";
        var currentTechnician = text(tool.get("technician_external_id"));

        if (operation === "loan") {
          if (status !== "available" || serviceState !== "ready") {
            throw new BadRequestError("Otro dispositivo ha cambiado el estado de " + text(tool.get("code")) + ".");
          }
          if (toolKind === "consumable") {
            throw new BadRequestError("Los consumibles no pueden registrarse como préstamo retornable.");
          }
        } else if (status !== "loaned" || currentTechnician !== technicianExternalId) {
          throw new BadRequestError("Otro dispositivo ha cambiado el responsable de " + text(tool.get("code")) + ".");
        }

        tools.push(tool);
      }

      createRecord(txApp, "isivolt_batches", {
        workspace: workspace,
        external_id: batchExternalId,
        operation: operation,
        technician_external_id: technicianExternalId,
        tool_ids: toolExternalIds,
        operator_mode: operatorMode,
        identification_method: identificationMethod,
        scan_method: scanMethod,
        started_at: startedAt,
        completed_at: completedAt
      });

      for (var j = 0; j < tools.length; j += 1) {
        var currentTool = tools[j];
        currentTool.set("status", operation === "loan" ? "loaned" : "available");
        currentTool.set("technician_external_id", operation === "loan" ? technicianExternalId : "");
        currentTool.set("source_updated", completedAt);
        txApp.save(currentTool);

        createRecord(txApp, "isivolt_movements", {
          workspace: workspace,
          external_id: movementExternalIds[j],
          type: operation,
          occurred_at: completedAt,
          tool_external_id: toolExternalIds[j],
          technician_external_id: technicianExternalId,
          batch_external_id: batchExternalId,
          identification_method: identificationMethod,
          scan_method: scanMethod,
          detail: operation === "loan"
            ? text(currentTool.get("name")) + " asignada a " + text(technician.get("name"))
            : text(currentTool.get("name")) + " devuelta por " + text(technician.get("name"))
        });
      }

      response = {
        ok: true,
        batchExternalId: batchExternalId,
        completedAt: completedAt,
        toolExternalIds: toolExternalIds
      };
    });

    return e.json(200, response);
  }, $apis.requireAuth());
})();
