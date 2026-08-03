import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Pantallas principales no válidas: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const enhancer = read('src/main-screen/MainScreenEnhancer.tsx');
const css = read('src/main-screen/main-screen-enhancer.css');
const bridge = read('src/admin/AdminDeepLinkBridge.tsx');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "'.tools-table-card tbody tr'",
  "'.technician-card'",
  'main-edit-entity',
  'Editar ficha',
  'ADMIN_OPEN_ENTITY_EVENT',
  "title === 'Nueva herramienta'",
  "title === 'Nuevo técnico'",
  '<PhotoManager',
  'Fotografía inicial',
  "form?.id === 'tool-form'",
  "form?.id === 'technician-form'",
  'pendingRef.current',
  'saveData(next)',
  'primaryPhoto(tool.photos)',
  'primaryPhoto(technician.photos)',
  "document.body.dataset.accessRole !== 'technician'",
]) {
  if (!enhancer.includes(fragment)) fail(`MainScreenEnhancer no contiene ${fragment}`);
}

for (const fragment of [
  "export const ADMIN_OPEN_ENTITY_EVENT",
  'handleOpenRequest',
  'window.addEventListener(ADMIN_OPEN_ENTITY_EVENT',
]) {
  if (!bridge.includes(fragment)) fail(`AdminDeepLinkBridge no contiene ${fragment}`);
}

for (const fragment of [
  '.main-edit-entity',
  '.main-tool-photo',
  '.technician-card .initials.has-photo',
  '.main-create-photo-slot',
  '@media (max-width: 760px)',
]) {
  if (!css.includes(fragment)) fail(`faltan estilos ${fragment}`);
}

if (!main.includes('<MainScreenEnhancer />')) fail('MainScreenEnhancer no está montado');
if (!main.includes("./main-screen/main-screen-enhancer.css")) fail('faltan estilos en main');
if (!/^2\.0\.0-alpha\.7\.\d+$/.test(packageJson.version)) fail(`versión inesperada: ${packageJson.version}`);
const cacheSuffix = packageJson.version.replace('2.0.0-alpha.', 'alpha-').replaceAll('.', '-');
if (!serviceWorker.includes(cacheSuffix)) fail(`caché PWA no corresponde a ${packageJson.version}`);

console.log('Pantallas principales preparadas: edición directa, fotografía inicial, miniaturas y vinculación automática.');
