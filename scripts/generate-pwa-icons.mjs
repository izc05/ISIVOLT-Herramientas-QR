import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(resolve(root, 'scripts/pwa-icons.base64.json'), 'utf8'));
const output = resolve(root, 'public/icons');

mkdirSync(output, { recursive: true });

const writePng = (filename, value) => {
  if (typeof value !== 'string' || value.length < 100) {
    throw new Error(`Fuente PNG no válida: ${filename}`);
  }
  const buffer = Buffer.from(value, 'base64');
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`La fuente no es un PNG válido: ${filename}`);
  }
  writeFileSync(resolve(output, filename), buffer);
  console.log(`Generado public/icons/${filename} · ${buffer.length} bytes`);
};

writePng('icon-192.png', source.icon192);
writePng('apple-touch-icon.png', source.icon192);
writePng('icon-512.png', source.icon512);
writePng('maskable-512.png', source.icon512);
