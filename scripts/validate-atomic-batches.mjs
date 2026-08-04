import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Lotes atómicos no válidos: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const hook = read('pb_hooks/isivolt_atomic_batches.pb.js');
const transactions = read('src/data/workspaceTransactions.ts');
const client = read('src/cloud/pocketbaseClient.ts');
const installer = read('deploy/pocketbase/install.sh');
const serviceWorker = read('public/sw.js');
const packageJson = JSON.parse(read('package.json'));

for (const fragment of [
  'routerAdd("POST", ROUTE',
  '$apis.requireAuth()',
  'e.app.runInTransaction',
  'findWorkspaceRecord(txApp, "isivolt_tools"',
  'currentTool.set("status"',
  'createRecord(txApp, "isivolt_batches"',
  'createRecord(txApp, "isivolt_movements"',
  'role === "technician"',
  'identificationMethod !== "authenticated"',
  'toolKind === "consumable"',
]) {
  if (!hook.includes(fragment)) fail(`el hook no contiene ${fragment}`);
}

for (const fragment of [
  'export async function commitAtomicBatch',
  "'/api/isivoltpro/batch-operation'",
  'AtomicBatchRequest',
]) {
  if (!client.includes(fragment)) fail(`el cliente no contiene ${fragment}`);
}

for (const fragment of [
  'await commitAtomicBatch({',
  'movementExternalIds: movementIds',
  "requestError?.status !== 0",
  "tool.kind !== 'consumable'",
  "input.operatorMode === 'self-service'",
]) {
  if (!transactions.includes(fragment)) fail(`la transacción local no contiene ${fragment}`);
}

for (const fragment of [
  '"$INSTALL_DIR/pb_hooks"',
  '"$REPO_ROOT/pb_hooks"',
  "-name '*.pb.js'",
]) {
  if (!installer.includes(fragment)) fail(`el instalador no contiene ${fragment}`);
}

if (packageJson.version !== '2.0.0-alpha.7.12') fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-7-12')) fail('la caché PWA no corresponde a alpha.7.12');

console.log('Lotes atómicos preparados: ruta privada, transacción servidor, cliente online y fallback offline.');
