migrate((app) => {
  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const manager = '@request.auth.role = "admin"';
  const validManagedRole = '(@request.body.role = "technician" || @request.body.role = "coordinator")';
  const validTechnicianLink = '((@request.body.role = "technician" && @request.body.technician_external_id != "") || (@request.body.role = "coordinator" && @request.body.technician_external_id = ""))';

  const users = app.findCollectionByNameOrId('isivolt_users');
  users.updateRule = `${authenticated} && ${sameWorkspace} && role != "admin" && id != @request.auth.id && @request.body.workspace:changed = false && @request.body.email:changed = false && ${validManagedRole} && ${validTechnicianLink}`;
  users.manageRule = `${authenticated} && ${sameWorkspace} && ${manager} && role != "admin" && id != @request.auth.id && ${validManagedRole} && ${validTechnicianLink}`;
  app.save(users);
}, (app) => {
  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const manager = '@request.auth.role = "admin"';
  const validManagedRole = '(@request.body.role = "technician" || @request.body.role = "coordinator")';
  const validTechnicianLink = '((@request.body.role = "technician" && @request.body.technician_external_id != "") || (@request.body.role = "coordinator" && @request.body.technician_external_id = ""))';

  const users = app.findCollectionByNameOrId('isivolt_users');
  users.updateRule = `${authenticated} && ${sameWorkspace} && active = true && role != "admin" && id != @request.auth.id && @request.body.workspace:changed = false && @request.body.email:changed = false && ${validManagedRole} && ${validTechnicianLink}`;
  users.manageRule = `${authenticated} && ${sameWorkspace} && ${manager} && active = true && role != "admin" && id != @request.auth.id && ${validManagedRole} && ${validTechnicianLink}`;
  app.save(users);
});