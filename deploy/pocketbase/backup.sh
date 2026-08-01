#!/usr/bin/env bash
set -Eeuo pipefail

DATA_DIR="${DATA_DIR:-/var/lib/isivoltpro-pocketbase}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
SERVICE="isivoltpro-pocketbase.service"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/isivoltpro-pocketbase-$TIMESTAMP.tar.gz"

if [[ "${EUID}" -ne 0 ]]; then
  echo "La copia debe ejecutarse como root." >&2
  exit 1
fi

install -d -m 0750 -o isivoltpro -g isivoltpro "$BACKUP_DIR"
was_active=0
if systemctl is-active --quiet "$SERVICE"; then
  was_active=1
  systemctl stop "$SERVICE"
fi

restart_service() {
  if [[ "$was_active" -eq 1 ]]; then
    systemctl start "$SERVICE"
  fi
}
trap restart_service EXIT

tar --create --gzip --file "$ARCHIVE" --directory "$DATA_DIR" pb_data
chown isivoltpro:isivoltpro "$ARCHIVE"
chmod 0600 "$ARCHIVE"

restart_service
was_active=0
trap - EXIT

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'isivoltpro-pocketbase-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Copia creada: $ARCHIVE"
