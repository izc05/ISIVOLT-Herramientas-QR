import assert from 'node:assert/strict';

const baseUrl = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
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
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
};

const waitForHealth = async () => {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const health = await request('/api/isivolt/health');
      assert.equal(health.ok, true);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError;
};

await waitForHealth();

const auth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: email, password }),
});
assert.ok(auth.token);
assert.equal(auth.record.workspace, workspaceId);
assert.equal(auth.record.role, 'admin');

const headers = { Authorization: auth.token };
const me = await request('/api/isivolt/me', { headers });
assert.equal(me.workspace, workspaceId);
assert.equal(me.role, 'admin');

const now = new Date().toISOString();
await request('/api/isivolt/entity', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    workspaceId,
    entity: 'technicians',
    entityId: 'tech-ci-1',
    action: 'upsert',
    payload: {
      id: 'tech-ci-1',
      code: 'TEC-CI-1',
      name: 'Técnico CI',
      specialty: 'Electricidad',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  }),
});

await request('/api/isivolt/entity', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    workspaceId,
    entity: 'tools',
    entityId: 'tool-ci-1',
    action: 'upsert',
    payload: {
      id: 'tool-ci-1',
      code: 'ELE-CI-1',
      qrCode: 'ISIVOLT:TOOL:ELE-CI-1',
      name: 'Multímetro CI',
      category: 'Medición',
      location: 'Almacén CI',
      status: 'available',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  }),
});

const movementPayload = {
  id: 'mov-ci-1',
  operationId: 'op-ci-1',
  type: 'delivery',
  toolId: 'tool-ci-1',
  technicianId: 'tech-ci-1',
  operatorName: 'Administrador CI',
  occurredAt: now,
  previousStatus: 'available',
  nextStatus: 'loaned',
  deviceId: 'device-ci-1',
  deviceName: 'Chrome CI',
  platform: 'linux',
};

const first = await request('/api/isivolt/movement', {
  method: 'POST',
  headers,
  body: JSON.stringify({ workspaceId, payload: movementPayload }),
});
assert.equal(first.ok, true);
assert.equal(first.duplicate, false);
assert.equal(first.tool.status, 'loaned');

const duplicate = await request('/api/isivolt/movement', {
  method: 'POST',
  headers,
  body: JSON.stringify({ workspaceId, payload: movementPayload }),
});
assert.equal(duplicate.ok, true);
assert.equal(duplicate.duplicate, true);

const sync = await request(`/api/isivolt/sync?workspace=${encodeURIComponent(workspaceId)}&cursor=0`, { headers });
assert.ok(Array.isArray(sync.events));
assert.ok(sync.events.length >= 4);
assert.ok(sync.events.some((event) => event.entity === 'movements' && event.entity_id === 'mov-ci-1'));
assert.ok(sync.events.some((event) => event.entity === 'tools' && event.entity_id === 'tool-ci-1' && event.payload.status === 'loaned'));
assert.ok(sync.cursor > 0);

console.log(JSON.stringify({
  ok: true,
  user: me.id,
  events: sync.events.length,
  cursor: sync.cursor,
  duplicateProtected: duplicate.duplicate,
}, null, 2));
