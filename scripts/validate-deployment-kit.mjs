import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const files = {
  install: read('deploy/pocketbase/install.sh'),
  service: read('deploy/pocketbase/isivoltpro-pocketbase.service'),
  admin: read('deploy/pocketbase/create-admin.sh'),
  backup: read('deploy/pocketbase/backup.sh'),
  backupService: read('deploy/pocketbase/isivoltpro-pocketbase-backup.service'),
  backupTimer: read('deploy/pocketbase/isivoltpro-pocketbase-backup.timer'),
  tunnel: read('deploy/cloudflare/config.yml.example'),
  check: read('deploy/check-deployment.sh'),
  guide: read('deploy/README.md'),
};

const errors = [];
const requireFragment = (file, fragment, label) => {
  if (!files[file].includes(fragment)) errors.push(`${label}: falta ${fragment}`);
};
const forbidFragment = (file, fragment, label) => {
  if (files[file].includes(fragment)) errors.push(`${label}: no debe contener ${fragment}`);
};

requireFragment('service', '--http=127.0.0.1:8090', 'Servicio');
requireFragment('service', '--migrationsDir=/opt/isivoltpro-pocketbase/pb_migrations', 'Servicio');
requireFragment('service', 'NoNewPrivileges=true', 'Servicio');
requireFragment('service', 'ProtectSystem=strict', 'Servicio');
requireFragment('service', 'ReadWritePaths=/var/lib/isivoltpro-pocketbase', 'Servicio');
forbidFragment('service', '0.0.0.0:8090', 'Servicio');
forbidFragment('service', '--http=:8090', 'Servicio');

requireFragment('install', 'pb_migrations', 'Instalador');
requireFragment('install', 'enable --now isivoltpro-pocketbase.service', 'Instalador');
requireFragment('install', 'enable --now isivoltpro-pocketbase-backup.timer', 'Instalador');
requireFragment('install', '/api/health', 'Instalador');
requireFragment('install', 'PB_VERSION="${PB_VERSION:-0.39.9}"', 'Instalador');

requireFragment('admin', 'read -r -s', 'Creación de supercuenta');
requireFragment('admin', 'superuser create', 'Creación de supercuenta');
requireFragment('admin', 'unset ADMIN_PASSWORD ADMIN_PASSWORD_CONFIRM', 'Creación de supercuenta');
forbidFragment('admin', 'ADMIN_PASSWORD="', 'Creación de supercuenta');

requireFragment('backup', 'trap restart_service EXIT', 'Copia');
requireFragment('backup', 'RETENTION_DAYS="${RETENTION_DAYS:-14}"', 'Copia');
requireFragment('backup', 'chmod 0600', 'Copia');
forbidFragment('backupService', 'Requires=isivoltpro-pocketbase.service', 'Servicio de copia');
requireFragment('backupTimer', 'Persistent=true', 'Temporizador');

requireFragment('tunnel', 'service: http://127.0.0.1:8090', 'Cloudflare Tunnel');
requireFragment('tunnel', 'service: http_status:404', 'Cloudflare Tunnel');
forbidFragment('tunnel', 'token:', 'Cloudflare Tunnel');
forbidFragment('tunnel', 'password:', 'Cloudflare Tunnel');

requireFragment('check', 'PUBLIC_URL', 'Diagnóstico');
requireFragment('check', '/api/health', 'Diagnóstico');
requireFragment('guide', 'No publiques el panel', 'Guía');
requireFragment('guide', 'Cloudflare Access', 'Guía');

const combined = Object.values(files).join('\n');
const suspicious = [
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:^|\n)\s*(?:password|contraseña)\s*:\s*["'][^"']{8,}["']/i,
  /(?:^|\n)\s*(?:password|contraseña)\s*=\s*["'](?!\$)[^"']{8,}["']/i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json/i,
];
for (const pattern of suspicious) {
  if (pattern.test(combined)) errors.push(`Posible secreto incluido: ${pattern}`);
}

if (errors.length) {
  console.error('El kit de despliegue no supera la validación:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Kit de despliegue validado: enlace local, migraciones, systemd, copias, túnel y ausencia de secretos.');
