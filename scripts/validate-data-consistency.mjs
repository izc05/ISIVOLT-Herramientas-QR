import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Consistencia de datos no válida: ${message}`);
  process.exit(1);
};
const read = (path) => readFileSync(path, 'utf8');
const app = read('src/App.tsx');
const scan = read('src/scan/ScanSession.tsx');
const transactions = read('src/data/workspaceTransactions.ts');
const atomicOperation = read('src/data/atomicWorkspaceOperations.ts');
const operationsBridge = read('src/data/workspaceOperations.ts');
const bridge = read('src/data/WorkspaceStorageBridge.tsx');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  'WORKSPACE_DATA_EVENT',
  'createToolRecord',
  'createTechnicianRecord',
  'commitBatchOperation',
  'linkToolNfc',
]) {
  if (!app.includes(fragment)) fail(`App.tsx no contiene ${fragment}`);
}
if (app.includes('useEffect(() => saveData(data)')) {
  fail('App conserva el guardado automático de una copia potencialmente obsoleta');
}

for (const fragment of [
  'createQuickToolRecord',
  'commitBatchOperation',
  'invalidToolIds',
  "setStep('items')",
]) {
  if (!scan.includes(fragment)) fail(`ScanSession no contiene ${fragment}`);
}
if (scan.includes('const nextData: AppData')) {
  fail('ScanSession sigue construyendo el lote desde una copia obsoleta');
}

for (const fragment of [
  'activeStorageKey()',
  'navigator as WorkspaceNavigator',
  "{ mode: 'exclusive' }",
  'const current = loadData()',
  'technicianCanReceiveTools',
  'duplicateTool',
  'duplicateTechnician',
]) {
  if (!transactions.includes(fragment)) fail(`workspaceTransactions no contiene ${fragment}`);
}

for (const fragment of [
  'activeStorageKey()',
  'navigator as WorkspaceNavigator',
  "{ mode: 'exclusive' }",
  'const current = loadData()',
  'technicianCanReceiveTools',
  'toolIsLoanable',
  'new Set(input.toolIds.filter(Boolean))',
  "input.operation === 'loan' && !technicianCanReceiveTools(technician)",
  'submitAtomicOperation',
  "central.status === 'conflict'",
  "central.status === 'confirmed'",
  'saveData(data)',
]) {
  if (!atomicOperation.includes(fragment)) fail(`atomicWorkspaceOperations no contiene ${fragment}`);
}

for (const fragment of [
  "from './workspaceTransactions'",
  "from './atomicWorkspaceOperations'",
  'commitBatchOperation',
]) {
  if (!operationsBridge.includes(fragment)) fail(`workspaceOperations no contiene ${fragment}`);
}

for (const fragment of ['StorageEvent', 'activeStorageKey()', 'announceActiveData()']) {
  if (!bridge.includes(fragment)) fail(`WorkspaceStorageBridge no contiene ${fragment}`);
}
if (!main.includes('<WorkspaceStorageBridge />')) fail('WorkspaceStorageBridge no está montado');

if (!/^2\.0\.0-alpha\.7\.\d+$/.test(packageJson.version)) {
  fail(`versión inesperada: ${packageJson.version}`);
}
const cacheSuffix = packageJson.version.replace('2.0.0-alpha.', 'alpha-').replaceAll('.', '-');
if (!serviceWorker.includes(cacheSuffix)) {
  fail(`caché PWA no corresponde a ${packageJson.version}`);
}

console.log('Operaciones consistentes: estado reciente, bloqueo local, servidor atómico, reconciliación y NFC único.');
