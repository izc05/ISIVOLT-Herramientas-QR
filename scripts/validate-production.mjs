import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const appConfig = await readFile('src/config/app.ts', 'utf8');
const capacitorConfig = await readFile('capacitor.config.ts', 'utf8');
const releaseWorkflow = await readFile('.github/workflows/build-release.yml', 'utf8');
const productionDocs = await readFile('docs/PRODUCTION.md', 'utf8');
const index = await readFile('index.html', 'utf8');

const versionMatch = /APP_VERSION = '([^']+)'/.exec(appConfig);
if (!versionMatch) throw new Error('No se ha encontrado APP_VERSION.');
if (packageJson.version !== versionMatch[1]) {
  throw new Error(`Versiones incoherentes: package=${packageJson.version}, app=${versionMatch[1]}`);
}
if (!/^1\.0\.0-rc\.\d+$/.test(packageJson.version)) {
  throw new Error(`La candidata debe usar 1.0.0-rc.N: ${packageJson.version}`);
}
if (!capacitorConfig.includes("appId: 'com.isivolt.herramientasqr'")) {
  throw new Error('El applicationId de producción ha cambiado inesperadamente.');
}
for (const secret of [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]) {
  if (!releaseWorkflow.includes(secret)) throw new Error(`El workflow release no declara ${secret}.`);
  if (!productionDocs.includes(secret)) throw new Error(`La documentación no explica ${secret}.`);
}
for (const bootstrap of [
  '/src/security/bootstrap.tsx',
  '/src/security/rectificationBootstrap.tsx',
  '/src/production/bootstrap.tsx',
  '/src/features/management/maintenanceBootstrap.tsx',
]) {
  if (!index.includes(bootstrap)) throw new Error(`index.html no carga ${bootstrap}.`);
}
console.log(`Producción validada: ${packageJson.version}, applicationId estable y módulos cargados.`);
