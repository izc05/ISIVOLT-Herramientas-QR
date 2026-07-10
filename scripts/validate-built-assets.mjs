import { readFile } from 'node:fs/promises';

const html = await readFile('dist/index.html', 'utf8');
const sources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const assetSources = sources.filter((source) => source.includes('assets/'));

if (assetSources.length === 0) {
  throw new Error('La build no contiene referencias a assets compilados.');
}

const invalid = assetSources.filter((source) => source.startsWith('/') || source.includes('/ISIVOLT-Herramientas-QR/'));
if (invalid.length > 0) {
  throw new Error(`La build contiene rutas absolutas incompatibles con Android: ${invalid.join(', ')}`);
}

if (!assetSources.every((source) => source.startsWith('./assets/'))) {
  throw new Error(`Las rutas compiladas deben ser relativas: ${assetSources.join(', ')}`);
}

console.log(`Assets compatibles con Capacitor: ${assetSources.join(', ')}`);
