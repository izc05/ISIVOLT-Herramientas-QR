import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Cabecera/branding no válido: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const component = read('src/header/DesktopUtilityMenu.tsx');
const css = read('src/header/header-branding.css');
const mobile = read('src/mobile/MobileUtilityMenu.tsx');
const main = read('src/main.tsx');
const svg = read('public/icons/icon.svg');
const iconSource = JSON.parse(read('scripts/pwa-icons.base64.json'));
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "label: 'Sistema'",
  "selector: '.diagnostics-trigger'",
  "label: 'Ecosistema'",
  "selector: '.ecosystem-trigger'",
  "label: 'Seguridad'",
  "selector: '.security-center-trigger'",
  "label: 'Cuenta y nube'",
  "selector: '.cloud-status-trigger'",
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
  '.topbar-actions > :not(.cloud-status-trigger):not(.scan-launcher):not(.admin-tools-launcher):not(.desktop-utility-menu)',
  'display: none !important',
  'max-width: 1360px',
  '@media (max-width: 760px)',
]) {
  if (!css.includes(fragment)) fail(`header-branding.css no contiene ${fragment}`);
}

if (!mobile.includes('<span className="mobile-utility-brand">I</span>')) {
  fail('el menú móvil no usa el monograma I');
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

if (packageJson.version !== '2.0.0-alpha.7.9') fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-7-9')) fail('caché PWA no renovada');

console.log('Cabecera estable: solo Estado, Operación, Gestionar y Más; logo horizontal azul y versión dentro del menú.');
