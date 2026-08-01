#!/usr/bin/env bash
set -Eeuo pipefail

PB_VERSION="${PB_VERSION:-0.39.9}"
INSTALL_DIR="${INSTALL_DIR:-/opt/isivoltpro-pocketbase}"
DATA_DIR="${DATA_DIR:-/var/lib/isivoltpro-pocketbase}"
SERVICE_USER="${SERVICE_USER:-isivoltpro}"
SERVICE_GROUP="${SERVICE_GROUP:-isivoltpro}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este instalador como root: sudo $0" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64|amd64) PB_ARCH="linux_amd64" ;;
  aarch64|arm64) PB_ARCH="linux_arm64" ;;
  *) echo "Arquitectura no compatible automáticamente: $(uname -m)" >&2; exit 1 ;;
esac

DOWNLOAD_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl unzip

if ! getent group "$SERVICE_GROUP" >/dev/null; then
  groupadd --system "$SERVICE_GROUP"
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --gid "$SERVICE_GROUP" --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -m 0755 -o root -g root "$INSTALL_DIR"
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$DATA_DIR/pb_data" "$DATA_DIR/backups"
install -d -m 0755 -o root -g root "$INSTALL_DIR/pb_migrations"

echo "Descargando PocketBase ${PB_VERSION} (${PB_ARCH})..."
curl --fail --location --retry 3 --output "$TMP_DIR/pocketbase.zip" "$DOWNLOAD_URL"
unzip -q "$TMP_DIR/pocketbase.zip" pocketbase -d "$TMP_DIR"
install -m 0755 -o root -g root "$TMP_DIR/pocketbase" "$INSTALL_DIR/pocketbase"

find "$INSTALL_DIR/pb_migrations" -maxdepth 1 -type f -name '*.js' -delete
find "$REPO_ROOT/pb_migrations" -maxdepth 1 -type f -name '*.js' -print0 \
  | sort -z \
  | xargs -0 -r -I{} install -m 0644 -o root -g root "{}" "$INSTALL_DIR/pb_migrations/"

if ! find "$INSTALL_DIR/pb_migrations" -maxdepth 1 -type f -name '*.js' | grep -q .; then
  echo "No se encontraron migraciones en $REPO_ROOT/pb_migrations" >&2
  exit 1
fi

install -m 0644 -o root -g root "$SCRIPT_DIR/isivoltpro-pocketbase.service" /etc/systemd/system/isivoltpro-pocketbase.service
install -m 0755 -o root -g root "$SCRIPT_DIR/backup.sh" "$INSTALL_DIR/backup.sh"
install -m 0755 -o root -g root "$SCRIPT_DIR/create-admin.sh" "$INSTALL_DIR/create-admin.sh"
install -m 0644 -o root -g root "$SCRIPT_DIR/isivoltpro-pocketbase-backup.service" /etc/systemd/system/isivoltpro-pocketbase-backup.service
install -m 0644 -o root -g root "$SCRIPT_DIR/isivoltpro-pocketbase-backup.timer" /etc/systemd/system/isivoltpro-pocketbase-backup.timer

systemctl daemon-reload
systemctl enable --now isivoltpro-pocketbase.service
systemctl enable --now isivoltpro-pocketbase-backup.timer

for attempt in {1..30}; do
  if curl --silent --fail http://127.0.0.1:8090/api/health >/dev/null; then
    echo "PocketBase responde correctamente en 127.0.0.1:8090."
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "PocketBase no ha respondido. Revisa: journalctl -u isivoltpro-pocketbase -n 100" >&2
    exit 1
  fi
  sleep 1
done

cat <<EOF

Instalación completada.

Servicio:       systemctl status isivoltpro-pocketbase
API local:      http://127.0.0.1:8090/api/
Panel local:    http://127.0.0.1:8090/_/
Datos:          $DATA_DIR/pb_data
Migraciones:    $INSTALL_DIR/pb_migrations
Copias:         $DATA_DIR/backups

Siguiente paso:
  sudo $INSTALL_DIR/create-admin.sh

Después configura Cloudflare Tunnel usando deploy/cloudflare/config.yml.example.
EOF
