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

requireFile('dist/sw.js');
console.log('PWA y diagnóstico preparados: iconos, manifiesto, metadatos, caché y comprobaciones correctos.');
