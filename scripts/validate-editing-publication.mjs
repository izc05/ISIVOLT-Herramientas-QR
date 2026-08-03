import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Edición/publicación no válida: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const photos = read('src/photos/PhotoManager.tsx');
const bridge = read('src/admin/AdminDeepLinkBridge.tsx');
const bridgeCss = read('src/admin/admin-deep-link.css');
const version = read('src/release/ReleaseVersionBadge.tsx');
const versionCss = read('src/release/release-version.css');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  'persistEntityPhotos',
  'activeStorageKey()',
  'window.localStorage.setItem',
  'Fotografía guardada y vinculada automáticamente',
  'Se guardan automáticamente',
]) {
  if (!photos.includes(fragment)) fail(`PhotoManager no contiene ${fragment}`);
}

for (const fragment of [
  "document.querySelector<HTMLButtonElement>('.admin-tools-launcher')",
  "buttonByText('.admin-tools-panel nav button', 'Fichas')",
  "mode === 'tool' ? 'Herramientas' : 'Técnicos'",
  "select.dispatchEvent(new Event('change'",
  "document.body.dataset.accessRole === 'technician'",
  'WORKSPACE_DATA_EVENT',
  '.status-tool-card, .status-technician-card',
]) {
  if (!bridge.includes(fragment)) fail(`AdminDeepLinkBridge no contiene ${fragment}`);
}

for (const fragment of ['data-editable-card', "content: 'Editar ficha'", '@media (max-width: 680px)']) {
  if (!bridgeCss.includes(fragment)) fail(`faltan estilos de edición ${fragment}`);
}

for (const fragment of [
  "import packageJson from '../../package.json'",
  'document.documentElement.dataset.appVersion',
  'Versión cargada:',
  'v{VERSION}',
]) {
  if (!version.includes(fragment)) fail(`ReleaseVersionBadge no contiene ${fragment}`);
}

if (!versionCss.includes('.release-version-chip') || !versionCss.includes('.release-version-mobile')) {
  fail('faltan estilos de versión');
}

for (const fragment of [
  '<AdminDeepLinkBridge />',
  '<ReleaseVersionBadge />',
  "./admin/admin-deep-link.css",
  "./release/release-version.css",
]) {
  if (!main.includes(fragment)) fail(`main no contiene ${fragment}`);
}

if (packageJson.version !== '2.0.0-alpha.7.6') fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-7-6')) fail('caché PWA no renovada');

console.log('Edición accesible: fotos persistentes, fichas directas y versión visible para verificar GitHub Pages.');
