import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Modelo V3 no válido: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const types = read('src/types.ts');
const storage = read('src/storage.ts');
const sync = read('src/cloud/sync.ts');
const migration = read('pb_migrations/1722512400_expand_data_model_v3.js');
const protectedStart = migration.indexOf('const protectedFields = [');
const protectedEnd = migration.indexOf('].map((field)', protectedStart);
const protectedFieldsBlock = protectedStart >= 0 && protectedEnd > protectedStart
  ? migration.slice(protectedStart, protectedEnd)
  : '';

for (const fragment of [
  "ToolKind = 'returnable-tool'",
  "ToolServiceState = 'ready'",
  "TechnicianStatus = 'active'",
  'PhotoReference',
  'toolCategories?',
  'technicianCategories?',
  'locations?',
]) {
  if (!types.includes(fragment)) fail(`falta ${fragment} en los tipos`);
}

for (const fragment of [
  'candidate.schemaVersion !== 2 && candidate.schemaVersion !== 3',
  'schemaVersion: 3',
  "kind = toolKinds.has",
  "serviceState = toolServiceStates.has",
  "status === 'active' ? true",
  "catalogId('tool-category'",
  "catalogId('technician-category'",
  "catalogId('location'",
  'movements: candidate.movements',
  'batches: Array.isArray(candidate.batches)',
]) {
  if (!storage.includes(fragment)) fail(`la migración local no contiene ${fragment}`);
}

if (!protectedFieldsBlock) fail('no se encuentra la lista de campos protegidos');

for (const field of [
  'tool_kind',
  'service_state',
  'category_external_id',
  'location_external_id',
  'photo_refs',
  'purchase_date',
  'purchase_price',
  'review_due_date',
  'calibration_due_date',
  'quantity',
  'min_stock',
]) {
  if (!sync.includes(field)) fail(`sincronización no contiene ${field}`);
  if (!migration.includes(`name: '${field}'`)) fail(`PocketBase no crea ${field}`);
  if (!protectedFieldsBlock.includes(`'${field}'`)) fail(`el técnico podría modificar ${field}`);
}

for (const field of ['technician_status', 'company', 'department', 'notes', 'photo_refs']) {
  if (!sync.includes(field)) fail(`sincronización de técnico no contiene ${field}`);
}

if (!migration.includes("values: ['returnable-tool', 'loanable-material', 'measuring-equipment', 'kit', 'ppe', 'consumable', 'other']")) {
  fail('tipos de artículo incompletos en PocketBase');
}
if (!migration.includes("values: ['ready', 'reserved', 'review', 'repair', 'lost', 'retired']")) {
  fail('estados de servicio incompletos en PocketBase');
}
if (!migration.includes("values: ['active', 'inactive', 'absent', 'vacation', 'leave', 'blocked']")) {
  fail('estados de técnico incompletos en PocketBase');
}

console.log('Modelo V3 preparado: migración local, sincronización, campos y protección técnica correctos.');
