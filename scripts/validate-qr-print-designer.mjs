import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Diseñador QR no válido: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const designer = read('src/printing/QRPrintDesigner.tsx');
const launcher = read('src/printing/QRPrintLauncher.tsx');
const fullOutput = read('src/printing/QRPrintFullOutput.tsx');
const css = read('src/printing/qr-print-designer.css');
const modalCss = read('src/printing/qr-print-modal.css');
const outputCss = read('src/printing/qr-print-full-output.css');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "type LabelSize = '20' | '25' | '30' | '40' | 'technician-card'",
  "type PrintTemplate = 'a4' | 'thermal'",
  "PREFERENCES_KEY = 'isivoltpro:qr-print-preferences:v1'",
  "LOG_KEY = 'isivoltpro:qr-print-log:v1'",
  'Seleccionar visibles',
  'Todas las categorías',
  'Todas las ubicaciones',
  'Número de serie',
  'Tarjeta 86 × 54 mm',
  'Impresora térmica',
  'PrimaryPhoto',
  'getPhotoUrl',
  'recordPrint',
  'document.body.dataset.qrPrintDesigner',
  'selectedCount === 0',
  'window.print()',
]) {
  if (!designer.includes(fragment)) fail(`QRPrintDesigner no contiene ${fragment}`);
}

for (const fragment of [
  "document.querySelector('.admin-tools-panel nav')",
  'Etiquetas QR',
  '<QRPrintDesigner',
  'qr-print-modal-backdrop',
]) {
  if (!launcher.includes(fragment)) fail(`QRPrintLauncher no contiene ${fragment}`);
}

for (const fragment of [
  'window.print = interceptedPrint',
  "document.querySelectorAll('.qr-print-list > button.selected strong')",
  'Array.from({ length: copies }',
  'qr-print-full-output',
  'DEFAULT_PREFERENCES',
  'getPhotoUrl',
]) {
  if (!fullOutput.includes(fragment)) fail(`QRPrintFullOutput no contiene ${fragment}`);
}

for (const fragment of [
  '.qr-print-sheet.size-20',
  '.qr-print-sheet.size-25',
  '.qr-print-sheet.size-30',
  '.qr-print-sheet.size-40',
  '.qr-print-sheet.size-technician-card',
  'width: 86mm',
  'height: 54mm',
  'body[data-qr-print-designer="active"]',
  'body[data-qr-print-template="thermal"]',
  '@page thermal-label',
  '@media (max-width: 680px)',
]) {
  if (!css.includes(fragment)) fail(`faltan estilos ${fragment}`);
}

for (const fragment of [
  '.qr-print-full-output',
  '.qr-print-preview-panel .qr-print-sheet',
  'display: none !important',
  'body[data-qr-print-template="thermal"] .qr-print-full-output',
]) {
  if (!outputCss.includes(fragment)) fail(`salida completa no contiene ${fragment}`);
}

if (!modalCss.includes('.qr-print-modal') || !modalCss.includes('.qr-print-nav-launcher')) fail('falta integración modal o navegación');
if (!main.includes('<QRPrintLauncher />') || !main.includes('<QRPrintFullOutput />')) fail('el diseñador o la salida completa no están montados');
if (!main.includes("./printing/qr-print-designer.css") || !main.includes("./printing/qr-print-modal.css") || !main.includes("./printing/qr-print-full-output.css")) fail('faltan estilos QR en main');
if (!/^2\.0\.0-alpha\.7\.\d+$/.test(packageJson.version)) fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-7-')) fail('caché PWA no renovada');

console.log('Diseñador QR preparado: selección completa, filtros, tamaños físicos, A4, térmica, tarjetas, fotos e historial local.');
