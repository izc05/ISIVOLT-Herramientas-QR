import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const appConfig = await readFile('src/config/app.ts', 'utf8');
const capacitorConfig = await readFile('capacitor.config.ts', 'utf8');
const releaseWorkflow = await readFile('.github/workflows/build-release.yml', 'utf8');
const productionDocs = await readFile('docs/PRODUCTION.md', 'utf8');
const index = await readFile('index.html', 'utf8');
const main = await readFile('src/main.tsx', 'utf8');
const appRoot = await readFile('src/AppRoot.tsx', 'utf8');

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

const moduleScripts = [...index.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map((match) => match[1]);
if (moduleScripts.length !== 1 || moduleScripts[0] !== '/src/main.tsx') {
  throw new Error(`index.html debe tener un único arranque React. Detectados: ${moduleScripts.join(', ')}`);
}
if (!main.includes("import AppRoot from './AppRoot'")) {
  throw new Error('main.tsx no carga AppRoot.');
}
for (const component of [
  'SecurityController',
  'RectificationCenter',
  'MaintenanceBoard',
  'CommissioningCenter',
  'BootErrorBoundary',
]) {
  if (!appRoot.includes(component)) throw new Error(`AppRoot no integra ${component}.`);
}
if (!appRoot.includes('timeout(7_000)') || !appRoot.includes('Continuar en modo local')) {
  throw new Error('El arranque no contiene timeout y recuperación local.');
}

console.log(`Producción validada: ${packageJson.version}, arranque único, recuperación visible y applicationId estable.`);
