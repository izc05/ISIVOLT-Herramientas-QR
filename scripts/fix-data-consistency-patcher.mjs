import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-data-consistency-alpha-7-11.mjs';
const source = readFileSync(path, 'utf8');
const current = "write(path, `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`);";
const corrected = "write(path, `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex + end.length)}`);";

if (!source.includes(current)) {
  throw new Error('No se encontró la implementación antigua de replaceBetween.');
}

let next = source.replace(current, corrected);
const workflowStart = next.indexOf("replaceExact(\n  '.github/workflows/validate-v2.yml',");
const workflowEndMarker = "\n);\n\nrmSync('scripts/apply-data-consistency-alpha-7-11.mjs');";
const workflowEnd = next.indexOf(workflowEndMarker, workflowStart);
if (workflowStart < 0 || workflowEnd < 0) {
  throw new Error('No se encontró el bloque que modifica validate-v2.yml.');
}
next = `${next.slice(0, workflowStart)}rmSync('scripts/apply-data-consistency-alpha-7-11.mjs');${next.slice(workflowEnd + workflowEndMarker.length)}`;

const deleteTemporaryWorkflow = "rmSync('.github/workflows/apply-data-consistency-alpha-7-11.yml');\n";
if (!next.includes(deleteTemporaryWorkflow)) {
  throw new Error('No se encontró la eliminación del workflow temporal.');
}
next = next.replace(deleteTemporaryWorkflow, '');

writeFileSync(path, next);
console.log('Transformador corregido y separado del workflow protegido.');
