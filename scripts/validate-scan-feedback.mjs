import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Respuesta del escáner no válida: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const component = read('src/scan/ScanFeedbackLayer.tsx');
const css = read('src/scan/scan-feedback.css');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "type FeedbackKind = 'success' | 'warning' | 'error' | 'complete'",
  "STORAGE_KEY = 'isivoltpro:scan-feedback-preferences'",
  'window.AudioContext',
  'context.createOscillator()',
  'navigator.vibrate',
  "navigator.vibrate([80, 45, 80])",
  'MutationObserver',
  "document.querySelector('.scan-message')",
  "document.querySelectorAll('.scan-tool-list article')",
  "document.querySelector('.scan-complete-screen')",
  'previousMessage',
  'completeShown',
  'Reducir animaciones',
  'Tono distinto para acierto, aviso y error',
]) {
  if (!component.includes(fragment)) fail(`falta ${fragment}`);
}

for (const fragment of [
  '.scan-feedback-flash.kind-success',
  '.scan-feedback-flash.kind-warning',
  '.scan-feedback-flash.kind-error',
  '.scan-feedback-flash.kind-complete',
  '.scan-feedback-settings',
  'prefers-reduced-motion',
  'pointer-events: none',
]) {
  if (!css.includes(fragment)) fail(`faltan estilos ${fragment}`);
}

if (!main.includes('<ScanFeedbackLayer />')) fail('la capa de respuesta no está montada');
if (!main.includes("./scan/scan-feedback.css")) fail('faltan estilos en main');
if (packageJson.version !== '2.0.0-alpha.7.1') fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-7-1')) fail('caché PWA no renovada');

console.log('Respuesta premium preparada: clasificación, destello, sonido, vibración y preferencias accesibles.');
