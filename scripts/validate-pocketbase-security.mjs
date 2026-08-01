import { readFileSync } from 'node:fs';

const accessPath = 'pb_migrations/1722512200_harden_isivolt_access.js';
const accessSource = readFileSync(accessPath, 'utf8');
const accessUpgrade = accessSource.split('}, (app) => {')[0];

const accessRequirements = [
  '@request.auth.active = true',
  '@request.body.workspace:changed = false',
  '@request.body.external_id:changed = false',
  '@request.body.technician_external_id = @request.auth.technician_external_id',
  'status = "available" && @request.body.status = "loaned"',
  'status = "loaned" && technician_external_id = @request.auth.technician_external_id',
  '@request.body.operator_mode = "self-service"',
  '@request.body.identification_method = "authenticated"',
  '@request.body.batch_external_id != ""',
  'batches.updateRule = null',
  'batches.deleteRule = null',
  'movements.updateRule = null',
  'movements.deleteRule = null',
];

const userPath = 'pb_migrations/1722512300_enable_user_management.js';
const userSource = readFileSync(userPath, 'utf8');
const userUpgrade = userSource.split('}, (app) => {')[0];

const userRequirements = [
  "users.authRule = 'active = true'",
  'users.createRule =',
  'users.updateRule =',
  'users.deleteRule =',
  'users.manageRule = users.updateRule',
  '@request.auth.role = "admin"',
  '(@request.body.role = "coordinator" || @request.body.role = "technician")',
  '@request.body.workspace:changed = false',
  '@request.body.email:changed = false',
  'id != @request.auth.id',
  'role != "admin"',
  '@request.body.technician_external_id != ""',
  '@request.body.technician_external_id = ""',
];

const missing = [
  ...accessRequirements.filter((fragment) => !accessUpgrade.includes(fragment)).map((fragment) => `${accessPath}: ${fragment}`),
  ...userRequirements.filter((fragment) => !userUpgrade.includes(fragment)).map((fragment) => `${userPath}: ${fragment}`),
];

if (missing.length > 0) {
  console.error('Faltan restricciones críticas en las migraciones PocketBase:');
  for (const fragment of missing) console.error(`- ${fragment}`);
  process.exit(1);
}

if (accessUpgrade.includes('tools.updateRule = readRule')) {
  console.error('La regla de actualización de herramientas no puede volver al permiso general de lectura.');
  process.exit(1);
}

if (userUpgrade.includes('@request.body.role = "admin"')) {
  console.error('La aplicación no puede crear o promover cuentas administradoras.');
  process.exit(1);
}

console.log(`Seguridad PocketBase validada: ${accessRequirements.length + userRequirements.length} restricciones críticas presentes.`);
