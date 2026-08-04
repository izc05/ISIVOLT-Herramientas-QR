import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const fail = (message) => {
  console.error(`Operaciones atómicas no válidas: ${message}`);
  process.exit(1);
};

const hook = read('pb_hooks/isivolt_operations.pb.js');
const migration = read('pb_migrations/1722512600_atomic_operations.js');
const client = read('src/cloud/atomicOperations.ts');
const operation = read('src/data/atomicWorkspaceOperations.ts');
const bridge = read('src/data/workspaceOperations.ts');
const sync = read('src/cloud/sync.ts');
const cloud = read('src/cloud/CloudStatus.tsx');
const install = read('deploy/pocketbase/install.sh');
const service = read('deploy/pocketbase/isivoltpro-pocketbase.service');
const packageJson = JSON.parse(read('package.json'));
const sw = read('public/sw.js');

for (const fragment of [
  'routerAdd("POST", "/api/isivolt/operations"',
  '$apis.requireAuth("isivolt_users")',
  'runInTransaction',
  'existingBatch',
  'new ApiError(409',
  'status !== "available"',
  'status !== "loaned"',
  'new Record(txApp.findCollectionByNameOrId("isivolt_batches"))',
  'new Record(txApp.findCollectionByNameOrId("isivolt_movements"))',
]) {
  if (!hook.includes(fragment)) fail(`el hook no contiene ${fragment}`);
}

for (const fragment of [
  '@request.body.status:changed = false',
  '@request.body.technician_external_id:changed = false',
  'batches.createRule = null',
  '@request.body.type != "loan"',
  '@request.body.type != "return"',
]) {
  if (!migration.includes(fragment)) fail(`la migración no contiene ${fragment}`);
}

for (const fragment of [
  "'/api/isivolt/operations'",
  "status: 'confirmed'",
  "status: 'pending'",
  "status: 'conflict'",
  'PocketBaseRequestError',
]) {
  if (!client.includes(fragment)) fail(`el cliente atómico no contiene ${fragment}`);
}

for (const fragment of [
  'submitAtomicOperation',
  "central.status === 'conflict'",
  "central.status === 'confirmed'",
  'saveData(data)',
]) {
  if (!operation.includes(fragment)) fail(`la operación local no contiene ${fragment}`);
}
if (!bridge.includes("export { commitBatchOperation } from './atomicWorkspaceOperations'")) {
  fail('workspaceOperations no publica la implementación atómica');
}

for (const fragment of [
  'submitAtomicOperation',
  'legacyBatches',
  'rejectedBatchIds',
  'conflictToolIds',
  'canonicalTools',
  'conflicts: pushed.conflicts',
]) {
  if (!sync.includes(fragment)) fail(`la sincronización no contiene ${fragment}`);
}
if (!cloud.includes('coreResult.conflicts.length > 0')) fail('CloudStatus no informa de conflictos');

for (const fragment of ['"$INSTALL_DIR/pb_hooks"', '"$REPO_ROOT/pb_hooks"']) {
  if (!install.includes(fragment)) fail(`el instalador no contiene ${fragment}`);
}
if (!service.includes('--hooksDir=/opt/isivoltpro-pocketbase/pb_hooks')) fail('systemd no carga pb_hooks');

if (packageJson.version !== '2.0.0-alpha.7.12') fail(`versión inesperada: ${packageJson.version}`);
if (!sw.includes('alpha-7-12')) fail('caché PWA no renovada');

console.log('Operaciones atómicas preparadas: ruta autenticada, transacción, idempotencia, conflicto y reconciliación.');
