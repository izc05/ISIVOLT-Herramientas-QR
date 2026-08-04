import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Cabecera/PWA no válida: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const component = read('src/header/DesktopUtilityMenu.tsx');
const mobile = read('src/mobile/MobileUtilityMenu.tsx');
const ecosystem = read('src/ecosystem/EcosystemSwitcher.tsx');
const css = read('src/header/header-branding.css');
const main = read('src/main.tsx');
const svg = read('public/icons/icon.svg');
const iconSource = JSON.parse(read('scripts/pwa-icons.base64.json'));
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');
const viteConfig = read('vite.config.ts');
const pwaPrompt = read('src/pwa/PwaInstallPrompt.tsx');

for (const fragment of [
  "label: 'Sistema'",
  "selector: '.diagnostics-trigger'",
  "label: 'Ecosistema'",
  'eventName: ECOSYSTEM_OPEN_EVENT',
  "label: 'Seguridad'",
  "selector: '.security-center-trigger'",
  "label: 'Cuenta y nube'",
  "selector: '.cloud-status-trigger'",
  'window.dispatchEvent(new CustomEvent(action.eventName))',
  'className="desktop-utility-trigger"',
  '<span>Más</span>',
  'role="menu"',
  'getCloudProfile()',
  "import packageJson from '../../package.json'",
  'desktop-utility-version',
  'v{packageJson.version}',
]) {
  if (!component.includes(fragment)) fail(`DesktopUtilityMenu no contiene ${fragment}`);
}

for (const fragment of [
  'eventName: ECOSYSTEM_OPEN_EVENT',
  'window.dispatchEvent(new CustomEvent(action.eventName))',
  'className="mobile-utility-launcher"',
  '<span className="mobile-utility-brand">I</span>',
]) {
  if (!mobile.includes(fragment)) fail(`MobileUtilityMenu no contiene ${fragment}`);
}

for (const fragment of [
  "export const ECOSYSTEM_OPEN_EVENT = 'isivoltpro:ecosystem-open'",
  'window.addEventListener(ECOSYSTEM_OPEN_EVENT, handleOpen)',
  'if (!open) return null',
  'className="ecosystem-panel"',
]) {
  if (!ecosystem.includes(fragment)) fail(`EcosystemSwitcher no contiene ${fragment}`);
}

if (ecosystem.includes('className="ecosystem-trigger"')) {
  fail('EcosystemSwitcher vuelve a renderizar un botón flotante fuera de la cabecera');
}

for (const fragment of [
  '.brand {',
  'background: #fff',
  '.brand-mark::after',
  "content: 'I'",
  'background: linear-gradient(145deg, #0878ee, #0756c9)',
  '.brand strong span { color: #0866e8; }',
  '.topbar-actions .cloud-status-trigger { order: 10; }',
  '.topbar-actions .scan-launcher { order: 20; }',
  '.topbar-actions .admin-tools-launcher { order: 30; }',
  '.desktop-utility-menu',
  'order: 40',
  'max-width: 1360px',
  '@media (max-width: 760px)',
]) {
  if (!css.includes(fragment)) fail(`header-branding.css no contiene ${fragment}`);
}

for (const fragment of [
  "import DesktopUtilityMenu from './header/DesktopUtilityMenu'",
  '<DesktopUtilityMenu />',
  "./header/header-branding.css",
]) {
  if (!main.includes(fragment)) fail(`main no contiene ${fragment}`);
}

for (const fragment of ['aria-label="IsiVoltPro"', '>I</text>', 'fill="#0866e8"', 'fill="#28d4ea"']) {
  if (!svg.includes(fragment)) fail(`icon.svg no contiene ${fragment}`);
}

for (const key of ['icon192', 'icon512']) {
  if (typeof iconSource[key] !== 'string' || iconSource[key].length < 1000) fail(`fuente PNG ${key} no válida`);
  const signature = Buffer.from(iconSource[key], 'base64').subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') fail(`${key} no contiene un PNG`);
}

for (const fragment of [
  'VITE_BASE_PATH',
  'normalizeBase',
  "sourcemap: mode !== 'production'",
]) {
  if (!viteConfig.includes(fragment)) fail(`vite.config.ts no contiene ${fragment}`);
}

for (const fragment of [
  "const CACHE_PREFIX = 'isivoltpro-herramientas-'",
  "const BASE = new URL('./', self.location.href).pathname",
  'key.startsWith(CACHE_PREFIX)',
  'request.destination',
  'STATIC_DESTINATIONS',
]) {
  if (!serviceWorker.includes(fragment)) fail(`service worker no contiene ${fragment}`);
}

if (serviceWorker.includes("const BASE = '/ISIVOLT-Herramientas-QR/'")) {
  fail('el service worker conserva una base rígida de GitHub Pages');
}

const controllerListener = pwaPrompt.indexOf("addEventListener('controllerchange'");
const skipWaiting = pwaPrompt.indexOf("waiting.postMessage({ type: 'SKIP_WAITING' })");
if (controllerListener < 0 || skipWaiting < 0 || controllerListener > skipWaiting) {
  fail('el listener controllerchange debe registrarse antes de activar SKIP_WAITING');
}
if (!pwaPrompt.includes('window.setTimeout(reload, 5000)')) {
  fail('falta recuperación si la actualización PWA no cambia de controlador');
}

if (!/^2\.0\.0-alpha\.7\.\d+$/.test(packageJson.version)) fail(`versión inesperada: ${packageJson.version}`);
const cacheSuffix = packageJson.version.replace('2.0.0-alpha.', 'alpha-').replaceAll('.', '-');
if (!serviceWorker.includes(`const CACHE_NAME = \`${'${CACHE_PREFIX}'}${cacheSuffix}\``)) {
  fail(`caché PWA no corresponde a ${packageJson.version}`);
}

console.log('Cabecera y PWA estables: sin botón Ecosistema flotante, base adaptable y actualización sin carrera.');
