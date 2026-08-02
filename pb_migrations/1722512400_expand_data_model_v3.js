migrate((app) => {
  const technicians = app.findCollectionByNameOrId('isivolt_technicians');
  technicians.fields.add(new TextField({ name: 'category_external_id', max: 120 }));
  technicians.fields.add(new SelectField({
    name: 'technician_status',
    maxSelect: 1,
    values: ['active', 'inactive', 'absent', 'vacation', 'leave', 'blocked'],
  }));
  technicians.fields.add(new TextField({ name: 'company', max: 180 }));
  technicians.fields.add(new TextField({ name: 'department', max: 180 }));
  technicians.fields.add(new TextField({ name: 'notes', max: 5000 }));
  technicians.fields.add(new JSONField({ name: 'photo_refs', maxSize: 1000000 }));
  app.save(technicians);

  const tools = app.findCollectionByNameOrId('isivolt_tools');
  tools.fields.add(new TextField({ name: 'category_external_id', max: 120 }));
  tools.fields.add(new TextField({ name: 'location_external_id', max: 120 }));
  tools.fields.add(new SelectField({
    name: 'tool_kind',
    maxSelect: 1,
    values: ['returnable-tool', 'loanable-material', 'measuring-equipment', 'kit', 'ppe', 'consumable', 'other'],
  }));
  tools.fields.add(new SelectField({
    name: 'service_state',
    maxSelect: 1,
    values: ['ready', 'reserved', 'review', 'repair', 'lost', 'retired'],
  }));
  tools.fields.add(new TextField({ name: 'description', max: 3000 }));
  tools.fields.add(new TextField({ name: 'notes', max: 5000 }));
  tools.fields.add(new JSONField({ name: 'photo_refs', maxSize: 1000000 }));
  tools.fields.add(new TextField({ name: 'purchase_date', max: 40 }));
  tools.fields.add(new NumberField({ name: 'purchase_price', min: 0 }));
  tools.fields.add(new TextField({ name: 'review_due_date', max: 40 }));
  tools.fields.add(new TextField({ name: 'calibration_due_date', max: 40 }));
  tools.fields.add(new NumberField({ name: 'review_interval_days', min: 0, onlyInt: true }));
  tools.fields.add(new NumberField({ name: 'calibration_interval_days', min: 0, onlyInt: true }));
  tools.fields.add(new NumberField({ name: 'quantity', min: 0 }));
  tools.fields.add(new NumberField({ name: 'min_stock', min: 0 }));
  tools.fields.add(new TextField({ name: 'unit', max: 40 }));

  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const manager = '(@request.auth.role = "admin" || @request.auth.role = "coordinator")';
  const technician = '@request.auth.role = "technician" && @request.auth.technician_external_id != ""';
  const protectedFields = [
    'code',
    'name',
    'category',
    'category_external_id',
    'location',
    'location_external_id',
    'tool_kind',
    'service_state',
    'description',
    'notes',
    'photo_refs',
    'brand',
    'model',
    'serial_number',
    'purchase_date',
    'purchase_price',
    'review_due_date',
    'calibration_due_date',
    'review_interval_days',
    'calibration_interval_days',
    'quantity',
    'min_stock',
    'unit',
    'qr_payload',
    'nfc_tag',
    'source_created',
  ].map((field) => ` && @request.body.${field}:changed = false`).join('');

  tools.updateRule = `${authenticated} && ${sameWorkspace} && @request.body.workspace:changed = false && @request.body.external_id:changed = false && (`
    + `${manager} || (`
    + `${technician}`
    + protectedFields
    + ` && (`
    + `(status = "available" && @request.body.status = "loaned" && @request.body.technician_external_id = @request.auth.technician_external_id)`
    + ` || `
    + `(status = "loaned" && technician_external_id = @request.auth.technician_external_id && @request.body.status = "available" && @request.body.technician_external_id = "")`
    + `)`
    + `)`
    + `)`;
  app.save(tools);
}, (app) => {
  const technicians = app.findCollectionByNameOrId('isivolt_technicians');
  for (const name of ['category_external_id', 'technician_status', 'company', 'department', 'notes', 'photo_refs']) {
    try { technicians.fields.removeByName(name); } catch { /* continuar */ }
  }
  app.save(technicians);

  const tools = app.findCollectionByNameOrId('isivolt_tools');
  for (const name of [
    'category_external_id', 'location_external_id', 'tool_kind', 'service_state', 'description', 'notes', 'photo_refs',
    'purchase_date', 'purchase_price', 'review_due_date', 'calibration_due_date', 'review_interval_days',
    'calibration_interval_days', 'quantity', 'min_stock', 'unit',
  ]) {
    try { tools.fields.removeByName(name); } catch { /* continuar */ }
  }

  const authenticated = '@request.auth.id != "" && @request.auth.active = true';
  const sameWorkspace = 'workspace = @request.auth.workspace';
  const manager = '(@request.auth.role = "admin" || @request.auth.role = "coordinator")';
  const technician = '@request.auth.role = "technician" && @request.auth.technician_external_id != ""';
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
});
