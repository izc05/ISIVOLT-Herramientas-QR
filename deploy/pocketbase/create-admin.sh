#!/usr/bin/env bash
set -Eeuo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/isivoltpro-pocketbase}"
DATA_DIR="${DATA_DIR:-/var/lib/isivoltpro-pocketbase}"
SERVICE_USER="${SERVICE_USER:-isivoltpro}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta como root: sudo $0" >&2
  exit 1
fi

read -r -p "Correo de la supercuenta PocketBase: " ADMIN_EMAIL
read -r -s -p "Contraseña (mínimo 10 caracteres): " ADMIN_PASSWORD
echo
read -r -s -p "Repite la contraseña: " ADMIN_PASSWORD_CONFIRM
echo

if [[ -z "$ADMIN_EMAIL" || "$ADMIN_EMAIL" != *@* ]]; then
  echo "Correo no válido." >&2
  exit 1
fi
if [[ ${#ADMIN_PASSWORD} -lt 10 ]]; then
  echo "La contraseña debe tener al menos 10 caracteres." >&2
  exit 1
fi
if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
  echo "Las contraseñas no coinciden." >&2
  exit 1
fi

was_active=0
if systemctl is-active --quiet isivoltpro-pocketbase.service; then
  was_active=1
  systemctl stop isivoltpro-pocketbase.service
fi

restore_service() {
  if [[ "$was_active" -eq 1 ]]; then
    systemctl start isivoltpro-pocketbase.service
  fi
}
trap restore_service EXIT

runuser -u "$SERVICE_USER" -- \
  "$INSTALL_DIR/pocketbase" superuser create "$ADMIN_EMAIL" "$ADMIN_PASSWORD" \
  --dir="$DATA_DIR/pb_data" \
  --migrationsDir="$INSTALL_DIR/pb_migrations"

unset ADMIN_PASSWORD ADMIN_PASSWORD_CONFIRM
restore_service
was_active=0
trap - EXIT

echo "Supercuenta creada. Accede al panel mediante un túnel SSH o Cloudflare protegido."
