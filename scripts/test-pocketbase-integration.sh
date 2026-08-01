#!/usr/bin/env bash
set -Eeuo pipefail

PB_VERSION="${PB_VERSION:-0.39.9}"
PORT="${PB_TEST_PORT:-18090}"
BASE_URL="http://127.0.0.1:${PORT}"
SUPERUSER_EMAIL="ci-superuser@isivoltpro.invalid"
SUPERUSER_PASSWORD="CiPocketBase!59382746"
APP_EMAIL="ci-admin@isivoltpro.invalid"
APP_PASSWORD="CiIsiVoltPro!59382746"
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

SUPERUSER_TOKEN="$(node -e "const f=require('fs'); const d=JSON.parse(f.readFileSync(process.argv[1])); if(!d.token) process.exit(1); process.stdout.write(d.token)" "$TMP_DIR/superuser-auth.json")"

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
const tools = collections.get('isivolt_tools');
if (!String(tools.updateRule ?? '').includes('@request.body.workspace:changed = false')) {
  throw new Error('La regla endurecida de isivolt_tools no está aplicada');
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

node - "$TMP_DIR/app-auth.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!payload.token) throw new Error('La cuenta administradora IsiVoltPro no ha recibido token');
if (payload.record?.role !== 'admin') throw new Error('El rol de la cuenta de prueba no es admin');
if (payload.record?.workspace !== 'ci') throw new Error('El workspace de la cuenta de prueba es incorrecto');
if (payload.record?.active !== true) throw new Error('La cuenta de prueba no está activa');
console.log('Autenticación real de isivolt_users verificada.');
NODE

UNAUTHORIZED_STATUS="$(curl --silent --output /dev/null --write-out '%{http_code}' "$BASE_URL/api/collections")"
if [[ "$UNAUTHORIZED_STATUS" != "401" ]]; then
  echo "El listado de colecciones sin superusuario debería devolver 401, pero devolvió $UNAUTHORIZED_STATUS" >&2
  exit 1
fi

echo "Integración PocketBase ${PB_VERSION} superada en una base temporal."
