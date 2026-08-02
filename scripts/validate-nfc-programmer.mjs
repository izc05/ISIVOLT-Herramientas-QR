import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Programador NFC no válido: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const programmer = read('src/nfc/NfcProgrammer.tsx');
const details = read('src/admin/EntityDetailsAdmin.tsx');
const css = read('src/nfc/nfc-programmer.css');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  'window.isSecureContext',
  'NDEFReader',
  'reader.scan()',
  'reader.write({ records:',
  "recordType: 'text'",
  "lang: 'es'",
  'decodeRecord',
  'detectedOwner',
  'La etiqueta leída ya pertenece',
  'NFC escrito correctamente',
  'Etiqueta NFC verificada',
  'La etiqueta física conserva su contenido',
  'No convierte el propio teléfono en una tarjeta NFC',
]) {
  if (!programmer.includes(fragment)) fail(`NfcProgrammer no contiene ${fragment}`);
}

for (const fragment of [
  '<NfcProgrammer',
  'entityType="tool"',
  'entityType="technician"',
  'payload={toolDraft.qrPayload',
  'payload={technicianPayload(technicianDraft)}',
  'nfcTag })',
]) {
  if (!details.includes(fragment)) fail(`EntityDetailsAdmin no contiene ${fragment}`);
}

for (const fragment of [
  '.nfc-programmer',
  '.nfc-read-result.verified',
  '.nfc-read-result.conflict',
  '.nfc-actions',
  '@media (max-width: 760px)',
]) {
  if (!css.includes(fragment)) fail(`faltan estilos ${fragment}`);
}

if (!main.includes("./nfc/nfc-programmer.css")) fail('los estilos NFC no están montados');
if (packageJson.version !== '2.0.0-alpha.7.3') fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-7-3')) fail('caché PWA no renovada');

console.log('Programador NFC preparado: lectura, conflicto, escritura NDEF, verificación y desvinculación segura.');
