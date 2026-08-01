#!/usr/bin/env bash
set -Eeuo pipefail

POCKETBASE_VERSION="${POCKETBASE_VERSION:-0.39.8}"
SERVICE_USER="isivolt"
INSTALL_DIR="/opt/isivolt-pocketbase"
DATA_DIR="/var/lib/isivolt-pocketbase"
BACKUP_DIR="/var/backups/isivolt-pocketbase"
ENV_FILE="/etc/isivolt-pocketbase.env"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ARCH="$(dpkg --print-architecture)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este instalador con sudo." >&2
  exit 1
fi

case "${ARCH}" in
  amd64) PB_ARCH="linux_amd64" ;;
  arm64) PB_ARCH="linux_arm64" ;;
  *) echo "Arquitectura no soportada por este instalador: ${ARCH}" >&2; exit 1 ;;
esac

ADMIN_EMAIL="${ISIVOLT_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ISIVOLT_ADMIN_PASSWORD:-}"
ADMIN_NAME="${ISIVOLT_ADMIN_NAME:-Administrador ISIVOLT}"
WORKSPACE="${ISIVOLT_WORKSPACE:-ISIVOLT}"

if [[ -z "${ADMIN_EMAIL}" ]]; then
  read -r -p "Correo del administrador inicial: " ADMIN_EMAIL
fi
if [[ ! "${ADMIN_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "El correo del administrador no tiene un formato válido." >&2
  exit 1
fi

if [[ -z "${ADMIN_PASSWORD}" ]]; then
  ADMIN_PASSWORD="$(openssl rand -hex 16)"
  GENERATED_PASSWORD=true
else
  GENERATED_PASSWORD=false
fi
if [[ ! "${ADMIN_PASSWORD}" =~ ^[A-Za-z0-9._~!@#%^+=-]{12,128}$ ]]; then
  echo "La contraseña debe tener entre 12 y 128 caracteres y usar letras, números o ._~!@#%^+=-" >&2
  exit 1
fi
if [[ ! "${WORKSPACE}" =~ ^[A-Za-z0-9._-]{2,64}$ ]]; then
  echo "El workspace debe tener entre 2 y 64 caracteres alfanuméricos, punto, guion o guion bajo." >&2
  exit 1
fi
if [[ "${ADMIN_NAME}" == *$'\n'* || "${ADMIN_NAME}" == *'"'* || "${ADMIN_NAME}" == *'\'* ]]; then
  echo "El nombre del administrador contiene caracteres no permitidos." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl unzip openssl

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --home "${DATA_DIR}" --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

install -d -m 0750 -o root -g "${SERVICE_USER}" "${INSTALL_DIR}"
install -d -m 0750 -o "${SERVICE_USER}" -g "${SERVICE_USER}" "${DATA_DIR}"
install -d -m 0700 -o root -g root "${BACKUP_DIR}"
install -d -m 0750 -o root -g "${SERVICE_USER}" "${INSTALL_DIR}/pb_hooks" "${INSTALL_DIR}/pb_migrations" "${INSTALL_DIR}/pb_public"

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

DOWNLOAD_URL="https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_${PB_ARCH}.zip"
curl --fail --location --silent --show-error "${DOWNLOAD_URL}" --output "${TMP_DIR}/pocketbase.zip"
unzip -q "${TMP_DIR}/pocketbase.zip" pocketbase -d "${TMP_DIR}"
install -m 0755 -o root -g root "${TMP_DIR}/pocketbase" "${INSTALL_DIR}/pocketbase"

sync_source() {
  local source="$1"
  local target="$2"
  find "${target}" -mindepth 1 -maxdepth 1 -type f -delete
  cp -a "${source}/." "${target}/"
  chown -R root:"${SERVICE_USER}" "${target}"
  chmod -R u=rwX,g=rX,o= "${target}"
}

sync_source "${SOURCE_DIR}/pb_hooks" "${INSTALL_DIR}/pb_hooks"
sync_source "${SOURCE_DIR}/pb_migrations" "${INSTALL_DIR}/pb_migrations"

cat > "${ENV_FILE}" <<EOF
ISIVOLT_BOOTSTRAP_ADMIN_EMAIL="${ADMIN_EMAIL}"
ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD="${ADMIN_PASSWORD}"
ISIVOLT_BOOTSTRAP_ADMIN_NAME="${ADMIN_NAME}"
ISIVOLT_BOOTSTRAP_WORKSPACE="${WORKSPACE}"
ISIVOLT_REQUIRE_STATION=false
EOF
chmod 0600 "${ENV_FILE}"
chown root:root "${ENV_FILE}"

install -m 0644 "${SCRIPT_DIR}/isivolt-pocketbase.service" /etc/systemd/system/isivolt-pocketbase.service
install -m 0750 "${SCRIPT_DIR}/backup-isivolt-pocketbase.sh" /usr/local/sbin/backup-isivolt-pocketbase
install -m 0644 "${SCRIPT_DIR}/isivolt-pocketbase-backup.service" /etc/systemd/system/isivolt-pocketbase-backup.service
install -m 0644 "${SCRIPT_DIR}/isivolt-pocketbase-backup.timer" /etc/systemd/system/isivolt-pocketbase-backup.timer

systemctl daemon-reload
systemctl enable --now isivolt-pocketbase.service
systemctl enable --now isivolt-pocketbase-backup.timer

healthy=false
for _ in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:8090/api/isivolt/health >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "${healthy}" != "true" ]]; then
  journalctl -u isivolt-pocketbase.service --no-pager -n 80 >&2 || true
  echo "PocketBase no ha respondido correctamente." >&2
  exit 1
fi

# La contraseña inicial solo se necesita durante la primera migración.
sed -i 's/^ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD=.*/ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD=/' "${ENV_FILE}"
systemctl restart isivolt-pocketbase.service

cat <<EOF

ISIVOLT PocketBase instalado correctamente.
Servicio: systemctl status isivolt-pocketbase
Datos: ${DATA_DIR}
Copias: ${BACKUP_DIR}
Panel local: http://127.0.0.1:8090/_/
Workspace: ${WORKSPACE}
Administrador: ${ADMIN_EMAIL}
EOF

if [[ "${GENERATED_PASSWORD}" == "true" ]]; then
  printf 'Contraseña inicial (guárdala ahora): %s\n' "${ADMIN_PASSWORD}"
fi

cat <<'EOF'

Siguiente paso: configurar Caddy con HTTPS y copiar la aplicación compilada a /opt/isivolt-pocketbase/pb_public.
EOF
