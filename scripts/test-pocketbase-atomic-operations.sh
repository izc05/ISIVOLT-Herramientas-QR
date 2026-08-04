#!/usr/bin/env bash
set -Eeuo pipefail

PB_VERSION="${PB_VERSION:-0.39.9}"
PORT="${PB_ATOMIC_TEST_PORT:-18092}"
BASE_URL="http://127.0.0.1:${PORT}"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
PB_DATA="$TMP_DIR/pb_data"
PB_LOG="$TMP_DIR/pocketbase.log"
SUPERUSER_EMAIL="atomic-superuser@isivoltpro.invalid"
SUPERUSER_PASSWORD="AtomicSuperuser!59382746"
ADMIN_EMAIL="atomic-admin@isivoltpro.invalid"
ADMIN_PASSWORD="AtomicAdmin!59382746"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  [[ "${KEEP_PB_TEST_DATA:-0}" == "1" ]] || rm -rf "$TMP_DIR"
}
trap cleanup EXIT

json_value() {
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1]));const v=(${2});if(v===undefined||v===null||v==='')process.exit(1);process.stdout.write(String(v));" "$1"
}

assert_http() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label: se esperaba HTTP $expected y se obtuvo $actual" >&2
    cat "$PB_LOG" >&2 || true
    exit 1
  fi
}

curl --fail --location --retry 3 \
  --output "$TMP_DIR/pocketbase.zip" \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip -q "$TMP_DIR/pocketbase.zip" pocketbase -d "$TMP_DIR"
chmod +x "$TMP_DIR/pocketbase"
mkdir -p "$PB_DATA"

"$TMP_DIR/pocketbase" migrate up --dir="$PB_DATA" --migrationsDir="$ROOT_DIR/pb_migrations"
"$TMP_DIR/pocketbase" superuser create "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" \
  --dir="$PB_DATA" --migrationsDir="$ROOT_DIR/pb_migrations"

"$TMP_DIR/pocketbase" serve \
  --http="127.0.0.1:${PORT}" \
  --dir="$PB_DATA" \
  --migrationsDir="$ROOT_DIR/pb_migrations" \
  --hooksDir="$ROOT_DIR/pb_hooks" \
  >"$PB_LOG" 2>&1 &
SERVER_PID="$!"

for attempt in {1..40}; do
  curl --silent --fail "$BASE_URL/api/health" >/dev/null && break
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$PB_LOG" >&2
    exit 1
  fi
  [[ "$attempt" -lt 40 ]] || { cat "$PB_LOG" >&2; exit 1; }
  sleep .25
done

curl --silent --show-error --fail -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SUPERUSER_EMAIL\",\"password\":\"$SUPERUSER_PASSWORD\"}" \
  "$BASE_URL/api/collections/_superusers/auth-with-password" >"$TMP_DIR/super.json"
SUPER_TOKEN="$(json_value "$TMP_DIR/super.json" 'd.token')"

curl --silent --show-error --fail -X POST \
  -H "Authorization: $SUPER_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"passwordConfirm\":\"$ADMIN_PASSWORD\",\"display_name\":\"Administrador atómico\",\"role\":\"admin\",\"workspace\":\"atomic\",\"active\":true,\"verified\":true}" \
  "$BASE_URL/api/collections/isivolt_users/records" >"$TMP_DIR/admin.json"

curl --silent --show-error --fail -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/collections/isivolt_users/auth-with-password" >"$TMP_DIR/admin-auth.json"
ADMIN_TOKEN="$(json_value "$TMP_DIR/admin-auth.json" 'd.token')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for suffix in a b; do
  curl --silent --show-error --fail -X POST \
    -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"workspace\":\"atomic\",\"external_id\":\"tech-$suffix\",\"code\":\"TEC-${suffix^^}\",\"name\":\"Técnico $suffix\",\"category\":\"Mantenimiento\",\"technician_status\":\"active\",\"active\":true,\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
    "$BASE_URL/api/collections/isivolt_technicians/records" >"$TMP_DIR/tech-$suffix.json"
done

curl --silent --show-error --fail -X POST \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"atomic\",\"external_id\":\"tool-atomic\",\"code\":\"TOOL-ATOMIC\",\"name\":\"Multímetro atómico\",\"category\":\"Medida\",\"location\":\"Almacén\",\"tool_kind\":\"returnable-tool\",\"service_state\":\"ready\",\"qr_payload\":\"ISIVOLTPRO:TOOL:TOOL-ATOMIC\",\"status\":\"available\",\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_tools/records" >"$TMP_DIR/tool.json"
TOOL_RECORD_ID="$(json_value "$TMP_DIR/tool.json" 'd.id')"

payload() {
  local suffix="$1"
  printf '{"batch_external_id":"batch-%s","operation":"loan","technician_external_id":"tech-%s","tool_ids":["tool-atomic"],"operator_mode":"administrator","identification_method":"manual","scan_method":"qr","started_at":"%s","completed_at":"%s","movements":[{"external_id":"move-%s","tool_external_id":"tool-atomic","detail":"Competición %s"}]}' \
    "$suffix" "$suffix" "$NOW" "$NOW" "$suffix" "$suffix"
}

(
  curl --silent --show-error --output "$TMP_DIR/loan-a.json" --write-out '%{http_code}' \
    -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "$(payload a)" "$BASE_URL/api/isivolt/operations" >"$TMP_DIR/status-a"
) &
PID_A="$!"
(
  curl --silent --show-error --output "$TMP_DIR/loan-b.json" --write-out '%{http_code}' \
    -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "$(payload b)" "$BASE_URL/api/isivolt/operations" >"$TMP_DIR/status-b"
) &
PID_B="$!"
wait "$PID_A"
wait "$PID_B"

STATUS_A="$(cat "$TMP_DIR/status-a")"
STATUS_B="$(cat "$TMP_DIR/status-b")"
if [[ "$STATUS_A" == "200" && "$STATUS_B" == "409" ]]; then
  WINNER="a"
elif [[ "$STATUS_B" == "200" && "$STATUS_A" == "409" ]]; then
  WINNER="b"
else
  echo "La carrera debía producir un 200 y un 409; resultados: A=$STATUS_A B=$STATUS_B" >&2
  cat "$TMP_DIR/loan-a.json" >&2 || true
  cat "$TMP_DIR/loan-b.json" >&2 || true
  cat "$PB_LOG" >&2 || true
  exit 1
fi

curl --silent --show-error --fail -H "Authorization: $ADMIN_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID" >"$TMP_DIR/tool-winner.json"
node - "$TMP_DIR/tool-winner.json" "$WINNER" <<'NODE'
const fs = require('fs');
const tool = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const winner = process.argv[3];
if (tool.status !== 'loaned' || tool.technician_external_id !== `tech-${winner}`) {
  throw new Error('La herramienta no quedó asignada al único ganador');
}
NODE

for collection in isivolt_batches isivolt_movements; do
  curl --silent --show-error --fail -H "Authorization: $ADMIN_TOKEN" \
    "$BASE_URL/api/collections/$collection/records?perPage=50" >"$TMP_DIR/$collection.json"
done
node - "$TMP_DIR/isivolt_batches.json" "$TMP_DIR/isivolt_movements.json" <<'NODE'
const fs = require('fs');
const batches = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const movements = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
if (batches.totalItems !== 1) throw new Error(`Se esperaban 1 lote y hay ${batches.totalItems}`);
if (movements.totalItems !== 1) throw new Error(`Se esperaba 1 movimiento y hay ${movements.totalItems}`);
NODE

RETRY_STATUS="$(curl --silent --show-error --output "$TMP_DIR/retry.json" --write-out '%{http_code}' \
  -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "$(payload "$WINNER")" "$BASE_URL/api/isivolt/operations")"
assert_http "$RETRY_STATUS" "200" 'reintento idempotente'
node - "$TMP_DIR/retry.json" <<'NODE'
const fs = require('fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.duplicate !== true) throw new Error('El reintento no se identificó como duplicado');
NODE

PATCH_STATUS="$(curl --silent --show-error --output "$TMP_DIR/direct-patch.json" --write-out '%{http_code}' \
  -X PATCH -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"available","technician_external_id":""}' \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID")"
if [[ "$PATCH_STATUS" =~ ^2 ]]; then
  echo 'La API genérica permitió cambiar el estado operativo' >&2
  exit 1
fi

DIRECT_BATCH_STATUS="$(curl --silent --show-error --output "$TMP_DIR/direct-batch.json" --write-out '%{http_code}' \
  -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"atomic\",\"external_id\":\"bypass\",\"operation\":\"loan\",\"technician_external_id\":\"tech-$WINNER\",\"tool_ids\":[\"tool-atomic\"],\"operator_mode\":\"administrator\",\"identification_method\":\"manual\",\"scan_method\":\"manual\",\"started_at\":\"$NOW\",\"completed_at\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_batches/records")"
if [[ "$DIRECT_BATCH_STATUS" =~ ^2 ]]; then
  echo 'La API genérica permitió crear un lote operativo' >&2
  exit 1
fi

RETURN_PAYLOAD="{\"batch_external_id\":\"return-$WINNER\",\"operation\":\"return\",\"technician_external_id\":\"tech-$WINNER\",\"tool_ids\":[\"tool-atomic\"],\"operator_mode\":\"administrator\",\"identification_method\":\"manual\",\"scan_method\":\"qr\",\"started_at\":\"$NOW\",\"completed_at\":\"$NOW\",\"movements\":[{\"external_id\":\"return-move-$WINNER\",\"tool_external_id\":\"tool-atomic\",\"detail\":\"Devolución atómica\"}]}"
RETURN_STATUS="$(curl --silent --show-error --output "$TMP_DIR/return.json" --write-out '%{http_code}' \
  -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "$RETURN_PAYLOAD" "$BASE_URL/api/isivolt/operations")"
assert_http "$RETURN_STATUS" "200" 'devolución atómica'

curl --silent --show-error --fail -H "Authorization: $ADMIN_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID" >"$TMP_DIR/tool-returned.json"
node - "$TMP_DIR/tool-returned.json" <<'NODE'
const fs = require('fs');
const tool = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (tool.status !== 'available' || tool.technician_external_id) {
  throw new Error('La devolución atómica no liberó la herramienta');
}
NODE

echo "Concurrencia atómica superada: ganó $WINNER, el rival recibió 409 y el reintento fue idempotente."
