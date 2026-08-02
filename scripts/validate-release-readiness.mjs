import { existsSync, readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Preparación de publicación no válida: ${message}`);
  process.exit(1);
};

const requireFile = (path) => {
  if (!existsSync(path)) fail(`falta ${path}`);
  return readFileSync(path);
};

const checkPng = (path, width, height) => {
  const file = requireFile(path);
  if (file.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${path} no es PNG`);
  const actualWidth = file.readUInt32BE(16);
  const actualHeight = file.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    fail(`${path} mide ${actualWidth}x${actualHeight}; se esperaba ${width}x${height}`);
  }
};

checkPng('dist/icons/icon-192.png', 192, 192);
checkPng('dist/icons/apple-touch-icon.png', 192, 192);
checkPng('dist/icons/icon-512.png', 512, 512);
checkPng('dist/icons/maskable-512.png', 512, 512);

const manifest = JSON.parse(requireFile('dist/manifest.webmanifest').toString('utf8'));
const iconSources = new Set((manifest.icons ?? []).map((icon) => icon.src));
for (const source of [
  '/ISIVOLT-Herramientas-QR/icons/icon-192.png',
  '/ISIVOLT-Herramientas-QR/icons/icon-512.png',
  '/ISIVOLT-Herramientas-QR/icons/maskable-512.png',
]) {
  if (!iconSources.has(source)) fail(`el manifiesto no referencia ${source}`);
}

const html = requireFile('dist/index.html').toString('utf8');
if (!html.includes('apple-touch-icon.png')) fail('index.html no referencia el icono Apple');
if (!html.includes('mobile-web-app-capable')) fail('falta el metadato móvil');

const diagnostics = requireFile('src/diagnostics/ReleaseDiagnostics.tsx').toString('utf8');
for (const fragment of ['testCamera', '/api/health', 'navigator.storage', 'NDEFReader', 'Copiar informe']) {
  if (!diagnostics.includes(fragment)) fail(`el diagnóstico no contiene ${fragment}`);
}

const mobileMenu = requireFile('src/mobile/MobileUtilityMenu.tsx').toString('utf8');
for (const fragment of [
  '.admin-tools-launcher',
  '.cloud-status-trigger',
  '.diagnostics-trigger',
  '.ecosystem-trigger',
  'role !== \'technician\'',
  'Accesos rápidos',
]) {
  if (!mobileMenu.includes(fragment)) fail(`el menú móvil no contiene ${fragment}`);
}

const mobileMenuCss = requireFile('src/mobile/mobile-utility-menu.css').toString('utf8');
for (const fragment of [
  '@media (max-width: 760px)',
  '.topbar-actions > .admin-tools-launcher',
  '.topbar-actions > .cloud-status-trigger',
  '.topbar-actions > .diagnostics-trigger',
  '.ecosystem-trigger',
  'display: none !important',
  '.mobile-utility-launcher',
]) {
  if (!mobileMenuCss.includes(fragment)) fail(`la corrección de cabecera móvil no contiene ${fragment}`);
}

const main = requireFile('src/main.tsx').toString('utf8');
if (!main.includes('<MobileUtilityMenu />')) fail('MobileUtilityMenu no está montado en la aplicación');

requireFile('dist/sw.js');
console.log('PWA, diagnóstico y cabecera móvil preparados: iconos, caché y accesos sin superposición correctos.');
