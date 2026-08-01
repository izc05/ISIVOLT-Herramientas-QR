#!/usr/bin/env bash
set -Eeuo pipefail

LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:8090}"
PUBLIC_URL="${PUBLIC_URL:-}"

check_health() {
  local label="$1"
  local url="$2"
  local output
  if ! output="$(curl --silent --show-error --fail --max-time 12 "$url/api/health")"; then
    echo "[FALLO] $label no responde: $url/api/health" >&2
    return 1
  fi
  echo "[OK] $label responde: $url/api/health"
  printf '%s\n' "$output"
}

failures=0
check_health "PocketBase local" "$LOCAL_URL" || failures=$((failures + 1))

if [[ -n "$PUBLIC_URL" ]]; then
  check_health "PocketBase público" "${PUBLIC_URL%/}" || failures=$((failures + 1))
else
  echo "[PENDIENTE] Define PUBLIC_URL para comprobar Cloudflare Tunnel."
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet isivoltpro-pocketbase.service \
    && echo "[OK] Servicio systemd activo." \
    || { echo "[FALLO] Servicio systemd inactivo." >&2; failures=$((failures + 1)); }
  systemctl is-enabled --quiet isivoltpro-pocketbase-backup.timer \
    && echo "[OK] Temporizador de copias habilitado." \
    || { echo "[FALLO] Temporizador de copias no habilitado." >&2; failures=$((failures + 1)); }
fi

if [[ "$failures" -gt 0 ]]; then
  echo "$failures comprobación(es) han fallado." >&2
  exit 1
fi

echo "Despliegue preparado."
