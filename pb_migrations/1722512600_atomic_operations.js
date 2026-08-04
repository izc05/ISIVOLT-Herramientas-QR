migrate((app) => {
  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const bodyWorkspace = '@request.body.workspace = @request.auth.workspace';
  const manager = '(@request.auth.role = "admin" || @request.auth.role = "coordinator")';

  const tools = app.findCollectionByNameOrId('isivolt_tools');
  tools.updateRule = `${authenticated} && ${sameWorkspace} && ${manager}`
    + ` && @request.body.workspace:changed = false`
    + ` && @request.body.external_id:changed = false`
    + ` && @request.body.status:changed = false`
    + ` && @request.body.technician_external_id:changed = false`;
  app.save(tools);

  const batches = app.findCollectionByNameOrId('isivolt_batches');
  batches.createRule = null;
  batches.updateRule = null;
  batches.deleteRule = null;
  app.save(batches);

  const movements = app.findCollectionByNameOrId('isivolt_movements');
  movements.createRule = `${authenticated} && ${bodyWorkspace} && ${manager}`
    + ` && @request.body.type != "loan"`
    + ` && @request.body.type != "return"`;
  movements.updateRule = null;
  movements.deleteRule = null;
  app.save(movements);
}, (app) => {
  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const bodyWorkspace = '@request.body.workspace = @request.auth.workspace';
  const manager = '(@request.auth.role = "admin" || @request.auth.role = "coordinator")';
  const technician = '@request.auth.role = "technician" && @request.auth.technician_external_id != ""';

  const tools = app.findCollectionByNameOrId('isivolt_tools');
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
  app.save(tools);

  const batches = app.findCollectionByNameOrId('isivolt_batches');
  batches.createRule = `${authenticated} && ${bodyWorkspace} && (`
    + `${manager} || (`
    + `${technician}`
    + ` && @request.body.technician_external_id = @request.auth.technician_external_id`
    + ` && @request.body.operator_mode = "self-service"`
    + ` && @request.body.identification_method = "authenticated"`
    + `)`
    + `)`;
  app.save(batches);

  const movements = app.findCollectionByNameOrId('isivolt_movements');
  movements.createRule = `${authenticated} && ${bodyWorkspace} && (`
    + `${manager} || (`
    + `${technician}`
    + ` && @request.body.technician_external_id = @request.auth.technician_external_id`
    + ` && (@request.body.type = "loan" || @request.body.type = "return")`
    + ` && @request.body.identification_method = "authenticated"`
    + ` && @request.body.batch_external_id != ""`
    + `)`
    + `)`;
  app.save(movements);
});
