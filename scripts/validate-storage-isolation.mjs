import { readFileSync } from 'node:fs';

const storage = readFileSync('src/storage.ts', 'utf8');
const cloudStatus = readFileSync('src/cloud/CloudStatus.tsx', 'utf8');

const storageRequirements = [
  "const LOCAL_STORAGE_KEY = 'isivoltpro-herramientas-v2:data'",
  "const CLOUD_STORAGE_PREFIX = 'isivoltpro-herramientas-v2:data:cloud'",
  'encodeURIComponent(profile.workspace)',
  'encodeURIComponent(profile.id)',
  'profile ? accountStorageKey(profile) : LOCAL_STORAGE_KEY',
  'export const announceActiveData',
];

const sessionRequirements = [
  'const dataBeforeLogin = loadData()',
  "authenticatedProfile.role !== 'technician'",
  'hasStoredData(authenticatedProfile)',
  'clearCloudSession()',
  'announceActiveData()',
];

const missing = [
  ...storageRequirements.filter((fragment) => !storage.includes(fragment)).map((fragment) => `storage.ts: ${fragment}`),
  ...sessionRequirements.filter((fragment) => !cloudStatus.includes(fragment)).map((fragment) => `CloudStatus.tsx: ${fragment}`),
];

if (missing.length > 0) {
  console.error('El aislamiento de caché ha perdido requisitos críticos:');
  for (const requirement of missing) console.error(`- ${requirement}`);
  process.exit(1);
}

console.log(`Aislamiento de caché validado: ${storageRequirements.length + sessionRequirements.length} requisitos presentes.`);
