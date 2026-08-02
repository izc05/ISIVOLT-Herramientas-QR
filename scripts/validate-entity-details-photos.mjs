import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Fichas y fotografías no válidas: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const store = read('src/photos/photoStore.ts');
const manager = read('src/photos/PhotoManager.tsx');
const details = read('src/admin/EntityDetailsAdmin.tsx');
const admin = read('src/admin/AdminTools.tsx');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "DATABASE_NAME = 'isivoltpro-media-v1'",
  "createObjectStore(STORE_NAME, { keyPath: 'id' })",
  "createIndex('entityId', 'entityId'",
  'MAX_DIMENSION = 1600',
  'JPEG_QUALITY = 0.82',
  "canvas.toBlob(",
  "'image/jpeg'",
  'saveLocalPhoto',
  'getPhotoUrl',
  'removeLocalPhoto',
]) {
  if (!store.includes(fragment)) fail(`photoStore no contiene ${fragment}`);
}
if (/localStorage|sessionStorage|readAsDataURL|base64/i.test(store)) fail('las imágenes no deben guardarse como texto o Base64');

for (const fragment of [
  'capture="environment"',
  'maxPhotos = 5',
  'primary: true',
  'setPrimary',
  'removeLocalPhoto',
  'URL.revokeObjectURL',
  'Cámara',
  'Galería',
]) {
  if (!manager.includes(fragment)) fail(`PhotoManager no contiene ${fragment}`);
}

for (const fragment of [
  "type EntityMode = 'tool' | 'technician'",
  '<PhotoManager entityId={toolDraft.id}',
  '<PhotoManager entityId={technicianDraft.id}',
  'Próxima revisión',
  'Próxima calibración',
  'Tipo de artículo',
  'Estado técnico',
  "toolDraft.kind === 'consumable'",
  'artículos asignados',
  'movimientos registrados',
]) {
  if (!details.includes(fragment)) fail(`EntityDetailsAdmin no contiene ${fragment}`);
}

if (!admin.includes("tab === 'details'") || !admin.includes('<BookOpen size={18} /> Fichas')) fail('la pestaña Fichas no está integrada');
if (!main.includes("./photos/photo-manager.css") || !main.includes("./admin/entity-details.css")) fail('faltan estilos de fichas o fotografías');
if (!String(packageJson.version).startsWith('2.0.0-alpha.')) fail(`versión inesperada: ${packageJson.version}`);
const cacheSuffix = String(packageJson.version).replace(/^2\.0\.0-/, '').replaceAll('.', '-');
if (!serviceWorker.includes(cacheSuffix)) fail(`la caché PWA no coincide con ${packageJson.version}`);

console.log('Fichas completas preparadas: IndexedDB, compresión, cámara, galería, estados, mantenimiento y fotografía principal.');
