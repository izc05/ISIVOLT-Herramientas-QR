migrate((app) => {
  const users = app.findCollectionByNameOrId('isivolt_users');
  const activeAdmin = '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "admin"';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const nonAdminTarget = 'role != "admin"';
  const validManagedRole = '(@request.body.role = "coordinator" || @request.body.role = "technician")';
  const validTechnicianLink = '((@request.body.role = "technician" && @request.body.technician_external_id != "") || (@request.body.role = "coordinator" && @request.body.technician_external_id = ""))';

  users.authRule = 'active = true';
  users.listRule = '@request.auth.id != "" && @request.auth.active = true && (id = @request.auth.id || (@request.auth.role = "admin" && workspace = @request.auth.workspace))';
  users.viewRule = users.listRule;
  users.createRule = `${activeAdmin}`
    + ` && @request.body.workspace = @request.auth.workspace`
    + ` && ${validManagedRole}`
    + ` && ${validTechnicianLink}`;
  users.updateRule = `${activeAdmin}`
    + ` && ${sameWorkspace}`
    + ` && ${nonAdminTarget}`
    + ` && id != @request.auth.id`
    + ` && @request.body.workspace:changed = false`
    + ` && @request.body.email:changed = false`
    + ` && ${validManagedRole}`
    + ` && ${validTechnicianLink}`;
  users.deleteRule = `${activeAdmin}`
    + ` && ${sameWorkspace}`
    + ` && ${nonAdminTarget}`
    + ` && id != @request.auth.id`;
  users.manageRule = users.updateRule;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('isivolt_users');
  users.authRule = '';
  users.listRule = 'id = @request.auth.id || (@request.auth.role = "admin" && workspace = @request.auth.workspace)';
  users.viewRule = users.listRule;
  users.createRule = null;
  users.updateRule = null;
  users.deleteRule = null;
  users.manageRule = null;
  app.save(users);
});
