#!/usr/bin/env bash
set -Eeuo pipefail

PB_VERSION="${PB_VERSION:-0.39.9}"
PORT="${PB_ATOMIC_TEST_PORT:-18092}"
BASE_URL="http://127.0.0.1:${PORT}"
SUPERUSER_EMAIL="atomic-superuser@isivoltpro.invalid"
SUPERUSER_PASSWORD="AtomicPocketBase!59382746"
APP_EMAIL="atomic-admin@isivoltpro.invalid"
APP_PASSWORD="AtomicIsiVoltPro!59382746"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
PB_DATA="$TMP_DIR/pb_data"
PB_LOG="$TMP_DIR/pocketbase.log"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

json_value() {
  local file="$1"
  local expression="$2"
  node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1])); const v=(${expression}); if(v===undefined||v===null||v==='') process.exit(1); process.stdout.write(String(v));" "$file"
}

curl --fail --location --retry 3 \
  --output "$TMP_DIR/pocketbase.zip" \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip -q "$TMP_DIR/pocketbase.zip" pocketbase -d "$TMP_DIR"
chmod +x "$TMP_DIR/pocketbase"
mkdir -p "$PB_DATA" "$TMP_DIR/pb_hooks"
cp "$ROOT_DIR"/pb_hooks/*.pb.js "$TMP_DIR/pb_hooks/"

"$TMP_DIR/pocketbase" migrate up \
  --dir="$PB_DATA" \
  --migrationsDir="$ROOT_DIR/pb_migrations"

"$TMP_DIR/pocketbase" superuser create "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" \
  --dir="$PB_DATA" \
  --migrationsDir="$ROOT_DIR/pb_migrations"

(
  cd "$TMP_DIR"
  ./pocketbase serve \
    --http="127.0.0.1:${PORT}" \
    --dir="$PB_DATA" \
    --migrationsDir="$ROOT_DIR/pb_migrations"
) >"$PB_LOG" 2>&1 &
SERVER_PID="$!"

for attempt in {1..40}; do
  if curl --silent --fail "$BASE_URL/api/health" >/dev/null; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$PB_LOG" >&2
    exit 1
  fi
  sleep .25
done

curl --silent --show-error --fail \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SUPERUSER_EMAIL\",\"password\":\"$SUPERUSER_PASSWORD\"}" \
  "$BASE_URL/api/collections/_superusers/auth-with-password" >"$TMP_DIR/super-auth.json"
SUPER_TOKEN="$(json_value "$TMP_DIR/super-auth.json" 'd.token')"

curl --silent --show-error --fail \
  -X POST -H "Authorization: $SUPER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$APP_EMAIL\",\"password\":\"$APP_PASSWORD\",\"passwordConfirm\":\"$APP_PASSWORD\",\"display_name\":\"Administrador Atomic\",\"role\":\"admin\",\"workspace\":\"atomic\",\"active\":true,\"verified\":true}" \
  "$BASE_URL/api/collections/isivolt_users/records" >/dev/null

curl --silent --show-error --fail \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$APP_EMAIL\",\"password\":\"$APP_PASSWORD\"}" \
  "$BASE_URL/api/collections/isivolt_users/auth-with-password" >"$TMP_DIR/app-auth.json"
APP_TOKEN="$(json_value "$TMP_DIR/app-auth.json" 'd.token')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

curl --silent --show-error --fail \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"atomic\",\"external_id\":\"tech-atomic-001\",\"code\":\"TEC-A-001\",\"name\":\"Técnico Atomic\",\"category\":\"Mantenimiento\",\"technician_status\":\"active\",\"active\":true,\"qr_payload\":\"ISIVOLTPRO:TECH:TEC-A-001\",\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_technicians/records" >/dev/null

curl --silent --show-error --fail \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"atomic\",\"external_id\":\"tool-atomic-001\",\"code\":\"TOOL-A-001\",\"name\":\"Multímetro Atomic\",\"category\":\"Medida\",\"location\":\"Almacén\",\"tool_kind\":\"measuring-equipment\",\"service_state\":\"ready\",\"qr_payload\":\"ISIVOLTPRO:TOOL:TOOL-A-001\",\"status\":\"available\",\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_tools/records" >/dev/null

FIRST_BODY="{\"operation\":\"loan\",\"technicianExternalId\":\"tech-atomic-001\",\"toolExternalIds\":[\"tool-atomic-001\"],\"operatorMode\":\"administrator\",\"identificationMethod\":\"manual\",\"scanMethod\":\"manual\",\"startedAt\":\"$NOW\",\"completedAt\":\"$NOW\",\"batchExternalId\":\"batch-atomic-first\",\"movementExternalIds\":[\"move-atomic-first\"]}"
SECOND_BODY="{\"operation\":\"loan\",\"technicianExternalId\":\"tech-atomic-001\",\"toolExternalIds\":[\"tool-atomic-001\"],\"operatorMode\":\"administrator\",\"identificationMethod\":\"manual\",\"scanMethod\":\"manual\",\"startedAt\":\"$NOW\",\"completedAt\":\"$NOW\",\"batchExternalId\":\"batch-atomic-second\",\"movementExternalIds\":[\"move-atomic-second\"]}"

curl --silent --show-error --fail \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "$FIRST_BODY" "$BASE_URL/api/isivoltpro/batch-operation" >"$TMP_DIR/first.json"

SECOND_STATUS="$(curl --silent --show-error --output "$TMP_DIR/second.json" --write-out '%{http_code}' \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "$SECOND_BODY" "$BASE_URL/api/isivoltpro/batch-operation")"
if [[ "$SECOND_STATUS" =~ ^2 ]]; then
  echo "El segundo préstamo debía ser rechazado." >&2
  cat "$TMP_DIR/second.json" >&2
  exit 1
fi

FILTER_TOOL="$(node -e 'process.stdout.write(encodeURIComponent(`workspace = "atomic" && external_id = "tool-atomic-001"`))')"
FILTER_WORKSPACE="$(node -e 'process.stdout.write(encodeURIComponent(`workspace = "atomic"`))')"

curl --silent --show-error --fail -H "Authorization: $APP_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records?filter=$FILTER_TOOL" >"$TMP_DIR/tools.json"
curl --silent --show-error --fail -H "Authorization: $APP_TOKEN" \
  "$BASE_URL/api/collections/isivolt_batches/records?filter=$FILTER_WORKSPACE&perPage=50" >"$TMP_DIR/batches.json"
curl --silent --show-error --fail -H "Authorization: $APP_TOKEN" \
  "$BASE_URL/api/collections/isivolt_movements/records?filter=$FILTER_WORKSPACE&perPage=50" >"$TMP_DIR/movements.json"

node - "$TMP_DIR/tools.json" "$TMP_DIR/batches.json" "$TMP_DIR/movements.json" <<'NODE'
const fs = require('fs');
const tools = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).items;
const batches = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).items;
const movements = JSON.parse(fs.readFileSync(process.argv[4], 'utf8')).items;
if (tools.length !== 1 || tools[0].status !== 'loaned' || tools[0].technician_external_id !== 'tech-atomic-001') {
  throw new Error('La herramienta no conserva el primer préstamo confirmado.');
}
if (batches.filter((item) => item.external_id.startsWith('batch-atomic-')).length !== 1) {
  throw new Error('Se creó más de un lote para la misma herramienta.');
}
if (movements.filter((item) => item.external_id.startsWith('move-atomic-')).length !== 1) {
  throw new Error('Se creó más de un movimiento para la misma herramienta.');
}
console.log('Colisión entre dispositivos rechazada: un lote, un movimiento y un único responsable.');
NODE
