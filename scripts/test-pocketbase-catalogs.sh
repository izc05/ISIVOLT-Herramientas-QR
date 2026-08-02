#!/usr/bin/env bash
set -Eeuo pipefail

PB_VERSION="${PB_VERSION:-0.39.9}"
PORT="${PB_CATALOG_PORT:-18091}"
BASE_URL="http://127.0.0.1:${PORT}"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
PB_DATA="$TMP_DIR/pb_data"
SERVER_PID=""
SUPER_EMAIL="catalog-super@isivoltpro.invalid"
SUPER_PASSWORD="CatalogSuper!59382746"
ADMIN_EMAIL="catalog-admin@isivoltpro.invalid"
ADMIN_PASSWORD="CatalogAdmin!59382746"
TECH_EMAIL="catalog-tech@isivoltpro.invalid"
TECH_PASSWORD="CatalogTech!59382746"

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

json_value() {
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1]));const v=(${2});if(v===undefined||v===null||v==='')process.exit(1);process.stdout.write(String(v));" "$1"
}

curl --fail --location --retry 3 --output "$TMP_DIR/pocketbase.zip" \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip -q "$TMP_DIR/pocketbase.zip" pocketbase -d "$TMP_DIR"
chmod +x "$TMP_DIR/pocketbase"
mkdir -p "$PB_DATA"

"$TMP_DIR/pocketbase" migrate up --dir="$PB_DATA" --migrationsDir="$ROOT_DIR/pb_migrations"
"$TMP_DIR/pocketbase" superuser create "$SUPER_EMAIL" "$SUPER_PASSWORD" --dir="$PB_DATA" --migrationsDir="$ROOT_DIR/pb_migrations"
"$TMP_DIR/pocketbase" serve --http="127.0.0.1:${PORT}" --dir="$PB_DATA" --migrationsDir="$ROOT_DIR/pb_migrations" >"$TMP_DIR/pb.log" 2>&1 &
SERVER_PID="$!"

for attempt in {1..40}; do
  curl --silent --fail "$BASE_URL/api/health" >/dev/null && break
  if [[ "$attempt" -eq 40 ]]; then cat "$TMP_DIR/pb.log" >&2; exit 1; fi
  sleep .25
done

curl --silent --show-error --fail -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SUPER_EMAIL\",\"password\":\"$SUPER_PASSWORD\"}" \
  "$BASE_URL/api/collections/_superusers/auth-with-password" >"$TMP_DIR/super.json"
SUPER_TOKEN="$(json_value "$TMP_DIR/super.json" 'd.token')"

create_user() {
  local email="$1" password="$2" role="$3" file="$4"
  curl --silent --show-error --fail -X POST -H "Authorization: $SUPER_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\",\"passwordConfirm\":\"$password\",\"display_name\":\"$role catálogo\",\"role\":\"$role\",\"workspace\":\"catalog-ci\",\"technician_external_id\":\"$([[ "$role" == technician ]] && echo tech-catalog || true)\",\"active\":true,\"verified\":true}" \
    "$BASE_URL/api/collections/isivolt_users/records" >"$file"
}
create_user "$ADMIN_EMAIL" "$ADMIN_PASSWORD" admin "$TMP_DIR/admin-user.json"
create_user "$TECH_EMAIL" "$TECH_PASSWORD" technician "$TMP_DIR/tech-user.json"

login() {
  local email="$1" password="$2" file="$3"
  curl --silent --show-error --fail -H 'Content-Type: application/json' \
    -d "{\"identity\":\"$email\",\"password\":\"$password\"}" \
    "$BASE_URL/api/collections/isivolt_users/auth-with-password" >"$file"
  json_value "$file" 'd.token'
}
ADMIN_TOKEN="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$TMP_DIR/admin-auth.json")"
TECH_TOKEN="$(login "$TECH_EMAIL" "$TECH_PASSWORD" "$TMP_DIR/tech-auth.json")"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

curl --silent --show-error --fail -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"catalog-ci\",\"external_id\":\"cat-electricidad\",\"name\":\"Electricidad\",\"code\":\"ELE\",\"color\":\"#0b63ce\",\"active\":true,\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_tool_categories/records" >"$TMP_DIR/category.json"

curl --silent --show-error --fail -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"catalog-ci\",\"external_id\":\"location-center\",\"name\":\"Centro\",\"code\":\"CTR\",\"active\":true,\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_locations/records" >"$TMP_DIR/location-parent.json"

curl --silent --show-error --fail -X POST -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"catalog-ci\",\"external_id\":\"location-store\",\"name\":\"Almacén\",\"code\":\"ALM\",\"parent_external_id\":\"location-center\",\"active\":true,\"source_created\":\"$NOW\",\"source_updated\":\"$NOW\"}" \
  "$BASE_URL/api/collections/isivolt_locations/records" >"$TMP_DIR/location-child.json"

curl --silent --show-error --fail -H "Authorization: $TECH_TOKEN" \
  "$BASE_URL/api/collections/isivolt_tool_categories/records?filter=workspace%3D%22catalog-ci%22" >"$TMP_DIR/tech-list.json"
node - "$TMP_DIR/tech-list.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!payload.items?.some((item) => item.external_id === 'cat-electricidad')) throw new Error('El técnico no puede leer el catálogo');
NODE

STATUS="$(curl --silent --show-error --output "$TMP_DIR/tech-create.json" --write-out '%{http_code}' \
  -X POST -H "Authorization: $TECH_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"workspace\":\"catalog-ci\",\"external_id\":\"forbidden\",\"name\":\"Prohibida\",\"active\":true}" \
  "$BASE_URL/api/collections/isivolt_tool_categories/records")"
if [[ "$STATUS" =~ ^2 ]]; then echo 'El técnico pudo crear una categoría' >&2; exit 1; fi

curl --silent --show-error --fail -H "Authorization: $ADMIN_TOKEN" \
  "$BASE_URL/api/collections/isivolt_locations/records?filter=workspace%3D%22catalog-ci%22&perPage=20" >"$TMP_DIR/locations.json"
node - "$TMP_DIR/locations.json" <<'NODE'
const fs = require('fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const child = payload.items?.find((item) => item.external_id === 'location-store');
if (!child || child.parent_external_id !== 'location-center') throw new Error('La jerarquía de ubicaciones no se conservó');
NODE

echo 'Catálogos PocketBase verificados: alta administrativa, lectura técnica, escritura técnica bloqueada y jerarquía conservada.'
