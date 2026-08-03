import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Estado operativo no válido: ${message}`);
  process.exit(1);
};

const read = (path) => readFileSync(path, 'utf8');
const component = read('src/status/StatusOverview.tsx');
const css = read('src/status/status-overview.css');
const main = read('src/main.tsx');
const packageJson = JSON.parse(read('package.json'));
const serviceWorker = read('public/sw.js');

for (const fragment of [
  "type ToolFilter = 'all' | 'available' | 'loaned' | 'attention' | 'service' | 'missing-data'",
  "type TechnicianFilter = 'all' | 'active' | 'with-material' | 'attention' | 'inactive'",
  'toolVisualState',
  "tool.serviceState === 'lost'",
  "tool.serviceState === 'repair'",
  "tool.serviceState === 'review'",
  "tool.status === 'loaned' && days >= threshold",
  'profile?.role === \'technician\'',
  'tool.technicianId !== technicianScope',
  'getPhotoUrl',
  'Datos pendientes',
  'Con material',
  'Con alertas',
  'Responsable',
  'Ubicación',
  'tool.nfcTag',
  'tool.qrPayload',
]) {
  if (!component.includes(fragment)) fail(`StatusOverview no contiene ${fragment}`);
}

for (const fragment of [
  'html:not([data-isivolt-view="dashboard"]) .status-overview',
  '.status-tool-card.tone-green',
  '.status-tool-card.tone-orange',
  '.status-tool-card.tone-red',
  '.status-tool-card.tone-purple',
  '.status-tool-card.tone-yellow',
  '.status-technician-card.attention',
  '.technician-state.state-blocked',
  '@media (max-width: 820px)',
  '@media (max-width: 520px)',
]) {
  if (!css.includes(fragment)) fail(`faltan estilos ${fragment}`);
}

if (!main.includes('<StatusOverview />')) fail('el panel no está montado');
if (!main.includes("./status/status-overview.css")) fail('faltan estilos en main');
if (!/^2\.0\.0-alpha\.7\./.test(packageJson.version)) fail(`versión inesperada: ${packageJson.version}`);
if (!/alpha-7-\d+/.test(serviceWorker)) fail('caché PWA no renovada');

console.log('Estado operativo preparado: herramientas, técnicos, alertas, fotos, QR/NFC, filtros y aislamiento por rol.');
