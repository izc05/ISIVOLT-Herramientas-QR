import { readFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`Seguridad del dispositivo no válida: ${message}`);
  process.exit(1);
};

const security = readFileSync('src/security/deviceSecurity.ts', 'utf8');
const gate = readFileSync('src/security/DeviceSecurityGate.tsx', 'utf8');
const center = readFileSync('src/security/SecurityCenter.tsx', 'utf8');
const main = readFileSync('src/main.tsx', 'utf8');
const mobileMenu = readFileSync('src/mobile/MobileUtilityMenu.tsx', 'utf8');
const css = readFileSync('src/security/device-security.css', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const serviceWorker = readFileSync('public/sw.js', 'utf8');

for (const fragment of [
  "name: 'PBKDF2'",
  "hash: 'SHA-256'",
  'DEFAULT_ITERATIONS = 180_000',
  'window.crypto.getRandomValues',
  'timingSafeEqual',
  'failedAttempts',
  'lockedUntil',
  'profile.workspace',
  'profile.id',
  "key: 'local-admin'",
]) {
  if (!security.includes(fragment)) fail(`falta ${fragment}`);
}

if (/setItem\([^\n]*pin/i.test(security)) fail('parece guardarse el PIN directamente en localStorage');
if (!security.includes('15 * 60_000') || !security.includes('30_000')) fail('no existe bloqueo progresivo');

for (const fragment of [
  "type GateMode = 'loading' | 'setup' | 'confirm-setup' | 'locked' | 'reauth' | 'unlocked'",
  'BACKGROUND_LOCK_MS = 60_000',
  "document.addEventListener('visibilitychange'",
  'root.inert = locked',
  'maxLength={6}',
  'remainingAttempts',
  'clearCloudSession',
]) {
  if (!gate.includes(fragment)) fail(`la pantalla de bloqueo no contiene ${fragment}`);
}

for (const fragment of ['Cambiar PIN', 'Bloquear ahora', '[1, 5, 15, 30]', 'verifyPin(currentPin', 'createOrReplacePin(newPin']) {
  if (!center.includes(fragment)) fail(`el centro de seguridad no contiene ${fragment}`);
}

if (!main.includes('<DeviceSecurityGate />') || !main.includes('<SecurityCenter />')) fail('la seguridad no está montada en main.tsx');
if (!main.includes("./security/device-security.css")) fail('faltan los estilos de seguridad');
if (!mobileMenu.includes("id: 'security'") || !mobileMenu.includes("selector: '.security-center-trigger'")) fail('el menú móvil no incluye Seguridad');
if (!css.includes('z-index: 12000') || !css.includes('@media (max-width: 760px)')) fail('el bloqueo no tiene prioridad o adaptación móvil');
if (packageJson.version !== '2.0.0-alpha.6.0') fail(`versión inesperada: ${packageJson.version}`);
if (!serviceWorker.includes('alpha-6-0')) fail('la caché PWA no se ha renovado');

console.log('Seguridad del dispositivo preparada: PIN derivado, aislamiento por cuenta, bloqueo progresivo y autobloqueo.');
