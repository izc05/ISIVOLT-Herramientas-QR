#!/usr/bin/env bash
set -Eeuo pipefail

PB_VERSION="${PB_VERSION:-0.39.9}"
PORT="${PB_TEST_PORT:-18090}"
BASE_URL="http://127.0.0.1:${PORT}"
SUPERUSER_EMAIL="ci-superuser@isivoltpro.invalid"
SUPERUSER_PASSWORD="CiPocketBase!59382746"
APP_EMAIL="ci-admin@isivoltpro.invalid"
APP_PASSWORD="CiIsiVoltPro!59382746"
TECH_EMAIL="ci-technician@isivoltpro.invalid"
TECH_PASSWORD="CiTechnician!59382746"
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
  if [[ "${KEEP_PB_TEST_DATA:-0}" != "1" ]]; then
    rm -rf "$TMP_DIR"
  else
    echo "Datos temporales conservados en: $TMP_DIR"
  fi
}
trap cleanup EXIT

json_value() {
  local file="$1"
  local expression="$2"
  node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1])); const v=(${expression}); if(v===undefined||v===null||v==='') process.exit(1); process.stdout.write(String(v));" "$file"
}

expect_denied() {
  local status="$1"
  local label="$2"
  if [[ "$status" =~ ^2 ]]; then
    echo "La operación debía ser rechazada: $label" >&2
    exit 1
  fi
  echo "Permiso rechazado correctamente ($status): $label"
}

curl --fail --location --retry 3 \
  --output "$TMP_DIR/pocketbase.zip" \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip -q "$TMP_DIR/pocketbase.zip" pocketbase -d "$TMP_DIR"
chmod +x "$TMP_DIR/pocketbase"
mkdir -p "$PB_DATA"

"$TMP_DIR/pocketbase" migrate up \
  --dir="$PB_DATA" \
  --migrationsDir="$ROOT_DIR/pb_migrations"

"$TMP_DIR/pocketbase" superuser create "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" \
  --dir="$PB_DATA" \
  --migrationsDir="$ROOT_DIR/pb_migrations"

"$TMP_DIR/pocketbase" serve \
  --http="127.0.0.1:${PORT}" \
  --dir="$PB_DATA" \
  --migrationsDir="$ROOT_DIR/pb_migrations" \
  --hooksDir="$ROOT_DIR/pb_hooks" \
  >"$PB_LOG" 2>&1 &
SERVER_PID="$!"

for attempt in {1..40}; do
  if curl --silent --fail "$BASE_URL/api/health" >"$TMP_DIR/health.json"; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "PocketBase terminó antes de estar preparado:" >&2
    cat "$PB_LOG" >&2
    exit 1
  fi
  if [[ "$attempt" -eq 40 ]]; then
    echo "PocketBase no respondió a tiempo:" >&2
    cat "$PB_LOG" >&2
    exit 1
  fi
  sleep .25
done

curl --silent --show-error --fail \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SUPERUSER_EMAIL\",\"password\":\"$SUPERUSER_PASSWORD\"}" \
  "$BASE_URL/api/collections/_superusers/auth-with-password" \
  >"$TMP_DIR/superuser-auth.json"

SUPERUSER_TOKEN="$(json_value "$TMP_DIR/superuser-auth.json" 'd.token')"

curl --silent --show-error --fail \
  -H "Authorization: $SUPERUSER_TOKEN" \
  "$BASE_URL/api/collections?perPage=200&sort=name" \
  >"$TMP_DIR/collections.json"

node - "$TMP_DIR/collections.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const collections = new Map(payload.items.map((item) => [item.name, item]));
const required = [
  'isivolt_users',
  'isivolt_technicians',
  'isivolt_tools',
  'isivolt_batches',
  'isivolt_movements',
];
for (const name of required) {
  if (!collections.has(name)) throw new Error(`Falta la colección ${name}`);
}
if (collections.get('isivolt_users').type !== 'auth') {
  throw new Error('isivolt_users no es una colección de autenticación');
}
for (const name of ['isivolt_batches', 'isivolt_movements']) {
  const collection = collections.get(name);
  if (collection.updateRule !== null || collection.deleteRule !== null) {
    throw new Error(`${name} debe ser inmutable`);
  }
}
if (collections.get('isivolt_batches').createRule !== null) {
  throw new Error('Los lotes operativos solo deben crearse mediante la ruta atómica');
}
const tools = collections.get('isivolt_tools');
const toolRule = String(tools.updateRule ?? '');
if (!toolRule.includes('@request.body.workspace:changed = false')) {
  throw new Error('La regla endurecida de isivolt_tools no está aplicada');
}
if (!toolRule.includes('@request.body.status:changed = false') || !toolRule.includes('@request.body.technician_external_id:changed = false')) {
  throw new Error('La API genérica todavía permite cambiar el estado operativo');
}
const movements = collections.get('isivolt_movements');
const movementCreateRule = String(movements.createRule ?? '');
if (!movementCreateRule.includes('@request.body.type != "loan"') || !movementCreateRule.includes('@request.body.type != "return"')) {
  throw new Error('La API genérica todavía permite movimientos de préstamo o devolución');
}
const users = collections.get('isivolt_users');
if (users.authRule !== 'active = true') {
  throw new Error('La regla de autenticación activa no está aplicada');
}
console.log(`Colecciones reales verificadas: ${required.join(', ')}`);
NODE

curl --silent --show-error --fail \
  -X POST \
  -H "Authorization: $SUPERUSER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$APP_EMAIL\",\"password\":\"$APP_PASSWORD\",\"passwordConfirm\":\"$APP_PASSWORD\",\"display_name\":\"Administrador CI\",\"role\":\"admin\",\"workspace\":\"ci\",\"active\":true,\"verified\":true}" \
  "$BASE_URL/api/collections/isivolt_users/records" \
  >"$TMP_DIR/app-admin.json"

curl --silent --show-error --fail \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$APP_EMAIL\",\"password\":\"$APP_PASSWORD\"}" \
  "$BASE_URL/api/collections/isivolt_users/auth-with-password" \
  >"$TMP_DIR/app-auth.json"

APP_TOKEN="$(json_value "$TMP_DIR/app-auth.json" 'd.token')"
node - "$TMP_DIR/app-auth.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (payload.record?.role !== 'admin') throw new Error('El rol de la cuenta de prueba no es admin');
if (payload.record?.workspace !== 'ci') throw new Error('El workspace de la cuenta de prueba es incorrecto');
if (payload.record?.active !== true) throw new Error('La cuenta de prueba no está activa');
console.log('Autenticación real de isivolt_users verificada.');
NODE

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

curl --silent --show-error --fail \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"ci\",\"external_id\":\"tech-ci-001\",\"code\":\"TEC-CI-001\",\"name\":\"Técnico CI\",\"category\":\"Mantenimiento\",\"technician_status\":\"active\",\"active\":true,\"qr_payload\":\"ISIVOLTPRO:TECH:TEC-CI-001\",\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_technicians/records" >"$TMP_DIR/technician.json"

curl --silent --show-error --fail \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"ci\",\"external_id\":\"tool-ci-001\",\"code\":\"TOOL-CI-001\",\"name\":\"Multímetro CI\",\"category\":\"Medida\",\"location\":\"Almacén\",\"tool_kind\":\"returnable-tool\",\"service_state\":\"ready\",\"qr_payload\":\"ISIVOLTPRO:TOOL:TOOL-CI-001\",\"status\":\"available\",\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_tools/records" >"$TMP_DIR/tool.json"
TOOL_RECORD_ID="$(json_value "$TMP_DIR/tool.json" 'd.id')"

curl --silent --show-error --fail \
  -X POST -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TECH_EMAIL\",\"password\":\"$TECH_PASSWORD\",\"passwordConfirm\":\"$TECH_PASSWORD\",\"display_name\":\"Técnico CI\",\"role\":\"technician\",\"workspace\":\"ci\",\"technician_external_id\":\"tech-ci-001\",\"active\":true,\"verified\":true}" \
  "$BASE_URL/api/collections/isivolt_users/records" >"$TMP_DIR/tech-user.json"
TECH_USER_RECORD_ID="$(json_value "$TMP_DIR/tech-user.json" 'd.id')"

curl --silent --show-error --fail \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$TECH_EMAIL\",\"password\":\"$TECH_PASSWORD\"}" \
  "$BASE_URL/api/collections/isivolt_users/auth-with-password" >"$TMP_DIR/tech-auth.json"
TECH_TOKEN="$(json_value "$TMP_DIR/tech-auth.json" 'd.token')"

curl --silent --show-error --fail \
  -H "Authorization: $TECH_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records?perPage=50" >"$TMP_DIR/tech-tools-before.json"
node - "$TMP_DIR/tech-tools-before.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!payload.items.some((item) => item.external_id === 'tool-ci-001' && item.status === 'available')) {
  throw new Error('El técnico no puede consultar la herramienta disponible');
}
NODE

DIRECT_LOAN_STATUS="$(curl --silent --show-error --output "$TMP_DIR/direct-loan.json" --write-out '%{http_code}' \
  -X PATCH -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"status\":\"loaned\",\"technician_external_id\":\"tech-ci-001\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID")"
expect_denied "$DIRECT_LOAN_STATUS" 'el estado operativo no puede cambiarse mediante PATCH'

BATCH_ID="batch-ci-001"
LOAN_PAYLOAD="{\"batch_external_id\":\"$BATCH_ID\",\"operation\":\"loan\",\"technician_external_id\":\"tech-ci-001\",\"tool_ids\":[\"tool-ci-001\"],\"operator_mode\":\"self-service\",\"identification_method\":\"authenticated\",\"scan_method\":\"qr\",\"started_at\":\"$NOW\",\"completed_at\":\"$NOW\",\"movements\":[{\"external_id\":\"move-ci-001\",\"tool_external_id\":\"tool-ci-001\",\"detail\":\"Préstamo CI\"}]}"
curl --silent --show-error --fail \
  -X POST -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d "$LOAN_PAYLOAD" \
  "$BASE_URL/api/isivolt/operations" >"$TMP_DIR/atomic-loan.json"
node - "$TMP_DIR/atomic-loan.json" <<'NODE'
const fs = require('fs');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (result.ok !== true || result.duplicate !== false || result.batch_external_id !== 'batch-ci-001') {
  throw new Error('La ruta atómica no confirmó el préstamo técnico');
}
NODE

curl --silent --show-error --fail \
  -H "Authorization: $TECH_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID" >"$TMP_DIR/tool-loaned.json"
node - "$TMP_DIR/tool-loaned.json" <<'NODE'
const fs = require('fs');
const tool = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (tool.status !== 'loaned' || tool.technician_external_id !== 'tech-ci-001') {
  throw new Error('La operación atómica no asignó la herramienta al técnico autenticado');
}
NODE

FORBIDDEN_EDIT_STATUS="$(curl --silent --show-error --output "$TMP_DIR/forbidden-edit.json" --write-out '%{http_code}' \
  -X PATCH -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Nombre manipulado"}' \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID")"
expect_denied "$FORBIDDEN_EDIT_STATUS" 'el técnico no puede editar el nombre de la herramienta'

DIRECT_BATCH_STATUS="$(curl --silent --show-error --output "$TMP_DIR/direct-batch.json" --write-out '%{http_code}' \
  -X POST -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"ci\",\"external_id\":\"bypass-ci\",\"operation\":\"loan\",\"technician_external_id\":\"tech-ci-001\",\"tool_ids\":[\"tool-ci-001\"],\"operator_mode\":\"self-service\",\"identification_method\":\"authenticated\",\"scan_method\":\"qr\",\"started_at\":\"$NOW\",\"completed_at\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_batches/records")"
expect_denied "$DIRECT_BATCH_STATUS" 'los lotes operativos no pueden crearse por la API genérica'

curl --silent --show-error --fail --get \
  -H "Authorization: $TECH_TOKEN" \
  --data-urlencode 'perPage=10' \
  --data-urlencode 'filter=external_id = "batch-ci-001"' \
  "$BASE_URL/api/collections/isivolt_batches/records" >"$TMP_DIR/batches-after-loan.json"
BATCH_RECORD_ID="$(json_value "$TMP_DIR/batches-after-loan.json" 'd.items?.[0]?.id')"

curl --silent --show-error --fail --get \
  -H "Authorization: $TECH_TOKEN" \
  --data-urlencode 'perPage=10' \
  --data-urlencode 'filter=external_id = "move-ci-001"' \
  "$BASE_URL/api/collections/isivolt_movements/records" >"$TMP_DIR/movements-after-loan.json"
MOVEMENT_RECORD_ID="$(json_value "$TMP_DIR/movements-after-loan.json" 'd.items?.[0]?.id')"

FORBIDDEN_BATCH_STATUS="$(curl --silent --show-error --output "$TMP_DIR/forbidden-batch.json" --write-out '%{http_code}' \
  -X PATCH -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"scan_method":"manual"}' \
  "$BASE_URL/api/collections/isivolt_batches/records/$BATCH_RECORD_ID")"
expect_denied "$FORBIDDEN_BATCH_STATUS" 'los lotes son inmutables'

FORBIDDEN_MOVEMENT_STATUS="$(curl --silent --show-error --output "$TMP_DIR/forbidden-movement.json" --write-out '%{http_code}' \
  -X PATCH -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"detail":"Alterado"}' \
  "$BASE_URL/api/collections/isivolt_movements/records/$MOVEMENT_RECORD_ID")"
expect_denied "$FORBIDDEN_MOVEMENT_STATUS" 'los movimientos son inmutables'

FORBIDDEN_DELETE_STATUS="$(curl --silent --show-error --output "$TMP_DIR/forbidden-delete.json" --write-out '%{http_code}' \
  -X DELETE -H "Authorization: $TECH_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID")"
expect_denied "$FORBIDDEN_DELETE_STATUS" 'el técnico no puede eliminar herramientas'

RETURN_BATCH_ID="batch-ci-return"
RETURN_PAYLOAD="{\"batch_external_id\":\"$RETURN_BATCH_ID\",\"operation\":\"return\",\"technician_external_id\":\"tech-ci-001\",\"tool_ids\":[\"tool-ci-001\"],\"operator_mode\":\"self-service\",\"identification_method\":\"authenticated\",\"scan_method\":\"qr\",\"started_at\":\"$NOW\",\"completed_at\":\"$NOW\",\"movements\":[{\"external_id\":\"move-ci-return\",\"tool_external_id\":\"tool-ci-001\",\"detail\":\"Devolución CI\"}]}"
curl --silent --show-error --fail \
  -X POST -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d "$RETURN_PAYLOAD" \
  "$BASE_URL/api/isivolt/operations" >"$TMP_DIR/atomic-return.json"

curl --silent --show-error --fail \
  -H "Authorization: $TECH_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tools/records/$TOOL_RECORD_ID" >"$TMP_DIR/tool-returned.json"
node - "$TMP_DIR/tool-returned.json" <<'NODE'
const fs = require('fs');
const tool = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (tool.status !== 'available' || tool.technician_external_id !== '') {
  throw new Error('La devolución atómica no dejó la herramienta disponible');
}
NODE

curl --silent --show-error --fail \
  -X PATCH -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \
  -d '{"active":false}' \
  "$BASE_URL/api/collections/isivolt_users/records/$TECH_USER_RECORD_ID" >"$TMP_DIR/tech-disabled.json"

DISABLED_AUTH_STATUS="$(curl --silent --show-error --output "$TMP_DIR/disabled-auth.json" --write-out '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$TECH_EMAIL\",\"password\":\"$TECH_PASSWORD\"}" \
  "$BASE_URL/api/collections/isivolt_users/auth-with-password")"
expect_denied "$DISABLED_AUTH_STATUS" 'una cuenta desactivada no puede autenticarse'

UNAUTHORIZED_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/collections")"
if [[ "$UNAUTHORIZED_STATUS" != "401" ]]; then
  echo "El listado de colecciones sin superusuario debería devolver 401, pero devolvió $UNAUTHORIZED_STATUS" >&2
  exit 1
fi

echo "Reglas reales verificadas: alta, ruta atómica, bloqueos, lote, movimiento, devolución y desactivación."
echo "Integración PocketBase ${PB_VERSION} superada en una base temporal."
