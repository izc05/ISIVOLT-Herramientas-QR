import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-data-consistency-alpha-7-11.mjs';
const source = readFileSync(path, 'utf8');
const current = "write(path, `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`);";
const corrected = "write(path, `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex + end.length)}`);";
if (!source.includes(current)) {
  throw new Error('No se encontró la implementación antigua de replaceBetween.');
}
writeFileSync(path, source.replace(current, corrected));
console.log('Transformador corregido.');
