import assert from 'node:assert/strict';

const baseUrl = process.env.POCKETBASE_RESTORE_URL ?? 'http://127.0.0.1:8091';
const email = process.env.ISIVOLT_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const password = process.env.ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeThis123!';
const workspaceId = process.env.ISIVOLT_BOOTSTRAP_WORKSPACE ?? 'ISIVOLT-CI';

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
};

let health = null;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    health = await request('/api/isivolt/health');
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
assert.equal(health?.ok, true, 'La base restaurada no ha arrancado correctamente.');

const auth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: email, password }),
});
assert.ok(auth.token);

const sync = await request(`/api/isivolt/sync?workspace=${encodeURIComponent(workspaceId)}&cursor=0`, {
  headers: { Authorization: auth.token },
});
assert.ok(sync.events.some((event) => event.entity === 'movements' && event.entity_id === 'mov-ci-1'));
assert.ok(sync.events.some((event) => event.entity === 'movements' && event.entity_id === 'mov-ci-2'));

console.log(JSON.stringify({
  ok: true,
  restoredEvents: sync.events.length,
  cursor: sync.cursor,
}, null, 2));
