migrate((app) => {
  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const bodyWorkspace = '@request.body.workspace = @request.auth.workspace';
  const manager = '(@request.auth.role = "admin" || @request.auth.role = "coordinator")';
  const technician = '@request.auth.role = "technician" && @request.auth.technician_external_id != ""';

  const technicians = app.findCollectionByNameOrId('isivolt_technicians');
  technicians.listRule = `${authenticated} && ${sameWorkspace} && (${manager} || external_id = @request.auth.technician_external_id)`;
  technicians.viewRule = technicians.listRule;
  technicians.createRule = `${authenticated} && ${bodyWorkspace} && ${manager}`;
  technicians.updateRule = `${authenticated} && ${sameWorkspace} && ${manager} && @request.body.workspace:changed = false && @request.body.external_id:changed = false`;
  technicians.deleteRule = `${authenticated} && ${sameWorkspace} && ${manager}`;
  app.save(technicians);

  const tools = app.findCollectionByNameOrId('isivolt_tools');
  tools.listRule = `${authenticated} && ${sameWorkspace} && (${manager} || (${technician} && (status = "available" || technician_external_id = @request.auth.technician_external_id)))`;
  tools.viewRule = tools.listRule;
  tools.createRule = `${authenticated} && ${bodyWorkspace} && ${manager}`;
  tools.updateRule = `${authenticated} && ${sameWorkspace} && @request.body.workspace:changed = false && @request.body.external_id:changed = false && (`
    + `${manager} || (`
    + `${technician}`
    + ` && @request.body.code:changed = false`
    + ` && @request.body.name:changed = false`
    + ` && @request.body.category:changed = false`
    + ` && @request.body.location:changed = false`
    + ` && @request.body.brand:changed = false`
    + ` && @request.body.model:changed = false`
    + ` && @request.body.serial_number:changed = false`
    + ` && @request.body.qr_payload:changed = false`
    + ` && @request.body.nfc_tag:changed = false`
    + ` && @request.body.source_created:changed = false`
    + ` && (`
    + `(status = "available" && @request.body.status = "loaned" && @request.body.technician_external_id = @request.auth.technician_external_id)`
    + ` || `
    + `(status = "loaned" && technician_external_id = @request.auth.technician_external_id && @request.body.status = "available" && @request.body.technician_external_id = "")`
    + `)`
    + `)`
    + `)`;
  tools.deleteRule = `${authenticated} && ${sameWorkspace} && ${manager}`;
  app.save(tools);

  const batches = app.findCollectionByNameOrId('isivolt_batches');
  batches.listRule = `${authenticated} && ${sameWorkspace} && (${manager} || (${technician} && technician_external_id = @request.auth.technician_external_id))`;
  batches.viewRule = batches.listRule;
  batches.createRule = `${authenticated} && ${bodyWorkspace} && (`
    + `${manager} || (`
    + `${technician}`
    + ` && @request.body.technician_external_id = @request.auth.technician_external_id`
    + ` && @request.body.operator_mode = "self-service"`
    + ` && @request.body.identification_method = "authenticated"`
    + `)`
    + `)`;
  batches.updateRule = null;
  batches.deleteRule = null;
  app.save(batches);

  const movements = app.findCollectionByNameOrId('isivolt_movements');
  movements.listRule = `${authenticated} && ${sameWorkspace} && (${manager} || (${technician} && technician_external_id = @request.auth.technician_external_id))`;
  movements.viewRule = movements.listRule;
  movements.createRule = `${authenticated} && ${bodyWorkspace} && (`
    + `${manager} || (`
    + `${technician}`
    + ` && @request.body.technician_external_id = @request.auth.technician_external_id`
    + ` && (@request.body.type = "loan" || @request.body.type = "return")`
    + ` && @request.body.identification_method = "authenticated"`
    + ` && @request.body.batch_external_id != ""`
    + `)`
    + `)`;
  movements.updateRule = null;
  movements.deleteRule = null;
  app.save(movements);
}, (app) => {
  const readRule = '@request.auth.id != "" && workspace = @request.auth.workspace';
  const createRule = '@request.auth.id != "" && @request.body.workspace = @request.auth.workspace';
  const coordinatorRule = '@request.auth.id != "" && workspace = @request.auth.workspace && (@request.auth.role = "admin" || @request.auth.role = "coordinator")';

  const technicians = app.findCollectionByNameOrId('isivolt_technicians');
  technicians.listRule = readRule;
  technicians.viewRule = readRule;
  technicians.createRule = `${createRule} && (@request.auth.role = "admin" || @request.auth.role = "coordinator")`;
  technicians.updateRule = coordinatorRule;
  technicians.deleteRule = coordinatorRule;
  app.save(technicians);

  const tools = app.findCollectionByNameOrId('isivolt_tools');
  tools.listRule = readRule;
  tools.viewRule = readRule;
  tools.createRule = createRule;
  tools.updateRule = readRule;
  tools.deleteRule = coordinatorRule;
  app.save(tools);

  for (const name of ['isivolt_batches', 'isivolt_movements']) {
    const collection = app.findCollectionByNameOrId(name);
    collection.listRule = readRule;
    collection.viewRule = readRule;
    collection.createRule = createRule;
    collection.updateRule = null;
    collection.deleteRule = null;
    app.save(collection);
  }
});
