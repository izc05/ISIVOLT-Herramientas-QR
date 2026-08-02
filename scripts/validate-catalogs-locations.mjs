import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Catálogos no válidos: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const admin = read('src/admin/CatalogAdmin.tsx');
const inventory = read('src/admin/InventoryAdmin.tsx');
const tools = read('src/admin/AdminTools.tsx');
const cloud = read('src/cloud/catalogSync.ts');
const cloudStatus = read('src/cloud/CloudStatus.tsx');
const migration = read('pb_migrations/1722512500_catalogs_and_locations.js');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "type CatalogKind = 'tools' | 'technicians' | 'locations'",
  'normalize(entry.name) === normalize(name)',
  'descendantsOf(draft.id)',
  'No se puede desactivar: está utilizado',
  'ubicación con ubicaciones hijas activas',
  'toolCategories:',
  'technicianCategories:',
  'locations:',
]) {
  if (!admin.includes(fragment)) fail(`falta ${fragment} en CatalogAdmin`);
}

for (const fragment of [
  '<CatalogAdmin',
  "tab === 'catalogs'",
  '<Tags size={18} /> Catálogos',
  'activeTechnicianCategories',
]) {
  if (!tools.includes(fragment)) fail(`Administración no contiene ${fragment}`);
}

for (const fragment of [
  'activeCategories',
  'activeLocations',
  'categoryId: category.id',
  'locationId: location?.id',
  'ensureCategory',
  'ensureLocation',
  'Las categorías y ubicaciones desconocidas se crean automáticamente',
]) {
  if (!inventory.includes(fragment)) fail(`Inventario no contiene ${fragment}`);
}

for (const name of ['isivolt_tool_categories', 'isivolt_technician_categories', 'isivolt_locations']) {
  if (!migration.includes(name)) fail(`falta la colección ${name}`);
  if (!cloud.includes(name)) fail(`falta sincronización de ${name}`);
}

for (const fragment of [
  '@request.auth.active = true',
  '@request.body.workspace = @request.auth.workspace',
  '@request.body.external_id:changed = false',
  'parent_external_id',
  'source_updated',
]) {
  if (!migration.includes(fragment)) fail(`la migración no contiene ${fragment}`);
}

if (!cloudStatus.includes('synchronizeCatalogs(coreResult.data, activeProfile)')) fail('CloudStatus no sincroniza catálogos');
if (!main.includes("./admin/catalog-admin.css")) fail('faltan estilos de catálogos');
if (!String(packageJson.version).startsWith('2.0.0-alpha.')) fail(`versión inesperada: ${packageJson.version}`);
const cacheSuffix = String(packageJson.version).replace(/^2\.0\.0-/, '').replaceAll('.', '-');
if (!serviceWorker.includes(cacheSuffix)) fail(`la caché PWA no coincide con ${packageJson.version}`);

console.log('Catálogos preparados: edición, jerarquía, selectores, importación y sincronización central.');
