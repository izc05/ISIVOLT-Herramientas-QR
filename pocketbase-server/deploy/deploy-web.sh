#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
TARGET_DIR="/opt/isivolt-pocketbase/pb_public"
WORKSPACE="${ISIVOLT_WORKSPACE:-ISIVOLT}"
SUDO=""

if [[ "${EUID}" -ne 0 ]]; then
  SUDO="sudo"
fi

cd "${REPO_DIR}"

export VITE_POCKETBASE_URL="same-origin"
export VITE_ISIVOLT_WORKSPACE_ID="${WORKSPACE}"
export VITE_ISIVOLT_STATION_MODE="${VITE_ISIVOLT_STATION_MODE:-disabled}"
export VITE_ISIVOLT_STATION_ID="${VITE_ISIVOLT_STATION_ID:-ALMACEN-PRINCIPAL}"
export VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK="${VITE_ISIVOLT_STATION_PUBLIC_KEY_JWK:-}"
export VITE_ISIVOLT_STATION_REDEEM_URL="${VITE_ISIVOLT_STATION_REDEEM_URL:-/station/api/redeem}"
export VITE_ISIVOLT_STATION_CLOCK_SKEW_SECONDS="${VITE_ISIVOLT_STATION_CLOCK_SKEW_SECONDS:-10}"
export VITE_ISIVOLT_STATION_MAX_TOKEN_SECONDS="${VITE_ISIVOLT_STATION_MAX_TOKEN_SECONDS:-90}"

npm install
npm run test
npm run build

${SUDO} install -d -m 0750 -o root -g isivolt "${TARGET_DIR}"
${SUDO} find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
${SUDO} cp -a dist/. "${TARGET_DIR}/"
${SUDO} chown -R root:isivolt "${TARGET_DIR}"
${SUDO} chmod -R u=rwX,g=rX,o= "${TARGET_DIR}"

printf 'Web desplegada en %s para el workspace %s.\n' "${TARGET_DIR}" "${WORKSPACE}"
