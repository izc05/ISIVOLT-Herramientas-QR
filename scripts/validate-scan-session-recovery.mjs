import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Sesión persistente no válida: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const draft = read('src/scan/scanDraft.ts');
const session = read('src/scan/ScanSession.tsx');
const transactions = read('src/data/workspaceTransactions.ts');
const css = read('src/scan/scan-recovery.css');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "PREFIX = 'isivoltpro:scan-draft:v1'",
  'profile.workspace',
  'profile.id',
  "return 'local-admin'",
  'loadScanDraft',
  'saveScanDraft',
  'clearScanDraft',
  'scanDraftIsMeaningful',
  'savedAt: new Date().toISOString()',
]) {
  if (!draft.includes(fragment)) fail(`scanDraft no contiene ${fragment}`);
}

for (const fragment of [
  'recoveryDraft',
  'resumeDraft',
  'discardRecovery',
  'Sesión recuperada',
  'Tienes un lote pendiente',
  'el lote se guarda automáticamente',
  'eligibleManualTools',
  'Añadir manualmente desde el inventario',
  'setQuickTool',
  'Registrar nuevo artículo',
  'Registrar y añadir',
  'createQuickToolRecord',
  'commitBatchOperation',
  'operation === \'return\'',
  'Solo se devolverán los artículos incluidos',
  'copyReceipt',
  'Comprobante copiado',
  'clearScanDraft();',
]) {
  if (!session.includes(fragment)) fail(`ScanSession no contiene ${fragment}`);
}

for (const fragment of [
  'export async function createQuickToolRecord',
  "kind: 'returnable-tool'",
  "serviceState: 'ready'",
  "status: 'available'",
  "type: 'tool_created'",
]) {
  if (!transactions.includes(fragment)) fail(`el alta rápida transaccional no contiene ${fragment}`);
}

if (!session.includes("operation === 'loan' && code")) fail('el alta rápida debe limitarse al préstamo');
if (!session.includes("tool.status === 'loaned' && tool.technicianId === selectedTechnician.id")) {
  fail('la devolución manual no está limitada al material del técnico');
}

for (const fragment of [
  '.scan-recovery-screen',
  '.scan-manual-browser',
  '.scan-quick-tool-backdrop',
  '.scan-receipt',
  '@media (max-width: 760px)',
]) {
  if (!css.includes(fragment)) fail(`faltan estilos ${fragment}`);
}

if (!main.includes("./scan/scan-recovery.css")) fail('los estilos de recuperación no están montados');
if (!String(packageJson.version).startsWith('2.0.0-alpha.7')) fail(`versión inesperada: ${packageJson.version}`);
const cacheSuffix = String(packageJson.version).replace(/^2\.0\.0-/, '').replaceAll('.', '-');
if (!serviceWorker.includes(cacheSuffix)) fail(`la caché PWA no coincide con ${packageJson.version}`);

console.log('Escaneo persistente preparado: borrador por cuenta, recuperación, alta rápida transaccional, selección manual y devolución parcial.');
