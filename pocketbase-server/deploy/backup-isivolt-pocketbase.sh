#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="isivolt-pocketbase.service"
DATA_DIR="/var/lib/isivolt-pocketbase"
BACKUP_DIR="/var/backups/isivolt-pocketbase"
RETENTION_DAYS="${ISIVOLT_BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${BACKUP_DIR}/isivolt-pocketbase-${STAMP}.tar.gz"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Esta copia debe ejecutarse como root." >&2
  exit 1
fi

install -d -m 0700 -o root -g root "${BACKUP_DIR}"

was_active=false
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  was_active=true
  systemctl stop "${SERVICE_NAME}"
fi

restore_service() {
  if [[ "${was_active}" == "true" ]]; then
    systemctl start "${SERVICE_NAME}" || true
  fi
}
trap restore_service EXIT

if [[ ! -d "${DATA_DIR}" ]]; then
  echo "No existe ${DATA_DIR}; no se ha creado ninguna copia." >&2
  exit 1
fi

tar --create --gzip --numeric-owner --file "${ARCHIVE}" --directory "$(dirname "${DATA_DIR}")" "$(basename "${DATA_DIR}")"
chmod 0600 "${ARCHIVE}"

find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'isivolt-pocketbase-*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete

printf 'Copia creada: %s\n' "${ARCHIVE}"
