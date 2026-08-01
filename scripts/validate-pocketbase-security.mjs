import { readFileSync } from 'node:fs';

const path = 'pb_migrations/1722512200_harden_isivolt_access.js';
const source = readFileSync(path, 'utf8');
const upgrade = source.split('}, (app) => {')[0];

const requiredFragments = [
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

const missing = requiredFragments.filter((fragment) => !upgrade.includes(fragment));
if (missing.length > 0) {
  console.error('Faltan restricciones críticas en la migración PocketBase:');
  for (const fragment of missing) console.error(`- ${fragment}`);
  process.exit(1);
}

if (upgrade.includes('tools.updateRule = readRule')) {
  console.error('La regla de actualización de herramientas no puede volver al permiso general de lectura.');
  process.exit(1);
}

console.log(`Seguridad PocketBase validada: ${requiredFragments.length} restricciones críticas presentes.`);
