import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const path = 'scripts/test-pocketbase-integration.sh';
const source = readFileSync(path, 'utf8');
const oldBlock = `curl --silent --show-error --fail \\
  -X PATCH -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"active":false}' \\
  "$BASE_URL/api/collections/isivolt_users/records/$TECH_USER_RECORD_ID" >"$TMP_DIR/tech-disabled.json"`;
const newBlock = `DISABLE_STATUS="$(curl --silent --show-error --output "$TMP_DIR/tech-disabled.json" --write-out '%{http_code}' \\
  -X PATCH -H "Authorization: $APP_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"display_name":"Técnico CI","role":"technician","technician_external_id":"tech-ci-001","active":false}' \\
  "$BASE_URL/api/collections/isivolt_users/records/$TECH_USER_RECORD_ID")"
if [[ "$DISABLE_STATUS" != "200" ]]; then
  echo "La cuenta técnica no pudo desactivarse con el payload real del panel: HTTP $DISABLE_STATUS" >&2
  cat "$TMP_DIR/tech-disabled.json" >&2 || true
  exit 1
fi`;
if (!source.includes(oldBlock)) throw new Error('No se encontró el bloque de desactivación actual.');
writeFileSync(path, source.replace(oldBlock, newBlock));
rmSync('scripts/apply-user-deactivation-diagnostic.mjs');
console.log('Diagnóstico de desactivación aplicado.');
