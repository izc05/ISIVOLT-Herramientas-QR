import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-alpha-7-12.mjs';
let source = readFileSync(path, 'utf8');
const marker = "replaceExact(\n  '.github/workflows/validate-v2.yml',";

for (let index = 0; index < 2; index += 1) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('No se encontró una modificación esperada de validate-v2.yml.');
  const end = source.indexOf('\n);', start);
  if (end < 0) throw new Error('No se encontró el cierre de la modificación del workflow.');
  source = `${source.slice(0, start)}${source.slice(end + 3)}`;
}

writeFileSync(path, source);
console.log('Cambios de workflow separados del parche automático.');
