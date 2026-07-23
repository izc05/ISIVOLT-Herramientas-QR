import assert from 'node:assert/strict';

const baseUrl = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const email = process.env.ISIVOLT_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const password = process.env.ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeThis123!';
const technicianEmail = process.env.ISIVOLT_BOOTSTRAP_TECH_EMAIL ?? 'tecnico@example.test';
const technicianPassword = process.env.ISIVOLT_BOOTSTRAP_TECH_PASSWORD ?? 'Technician123!';
const linkedTechnicianId = process.env.ISIVOLT_BOOTSTRAP_TECHNICIAN_ID ?? 'tech-ci-1';
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
    const error = new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
};

const expectStatus = async (status, operation) => {
  try {
    await operation();
    assert.fail(`La operación debía responder con ${status}.`);
  } catch (error) {
    assert.equal(error.status, status, error.message);
    return error.body;
  }
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

const adminAuth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: email, password }),
});
assert.ok(adminAuth.token);
assert.equal(adminAuth.record.workspace, workspaceId);
assert.equal(adminAuth.record.role, 'admin');

const adminHeaders = { Authorization: adminAuth.token };
const adminIdentity = await request('/api/isivolt/me', { headers: adminHeaders });
assert.equal(adminIdentity.workspace, workspaceId);
assert.equal(adminIdentity.role, 'admin');

const now = new Date().toISOString();
await request('/api/isivolt/entity', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    workspaceId,
    entity: 'technicians',
    entityId: linkedTechnicianId,
    action: 'upsert',
    payload: {
      id: linkedTechnicianId,
      code: 'TEC-CI-1',
      name: 'Técnico CI',
      specialty: 'Electricidad',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  }),
});

const createTool = async (id, code, name) => request('/api/isivolt/entity', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    workspaceId,
    entity: 'tools',
    entityId: id,
    action: 'upsert',
    payload: {
      id,
      code,
      qrCode: `ISIVOLT:TOOL:${code}`,
      name,
      category: 'Medición',
      location: 'Almacén CI',
      status: 'available',
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  }),
});

await createTool('tool-ci-1', 'ELE-CI-1', 'Multímetro CI');
await createTool('tool-ci-2', 'ELE-CI-2', 'Pinza CI');

const adminMovement = {
  id: 'mov-ci-1',
  operationId: 'op-ci-1',
  type: 'delivery',
  toolId: 'tool-ci-1',
  technicianId: linkedTechnicianId,
  operatorName: 'Administrador CI',
  occurredAt: now,
  previousStatus: 'available',
  nextStatus: 'loaned',
  deviceId: 'device-admin-ci',
  deviceName: 'Chrome Admin CI',
  platform: 'linux',
};

const first = await request('/api/isivolt/movement', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ workspaceId, payload: adminMovement }),
});
assert.equal(first.ok, true);
assert.equal(first.duplicate, false);
assert.equal(first.tool.status, 'loaned');

const duplicate = await request('/api/isivolt/movement', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ workspaceId, payload: adminMovement }),
});
assert.equal(duplicate.ok, true);
assert.equal(duplicate.duplicate, true);

const technicianAuth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: technicianEmail, password: technicianPassword }),
});
assert.ok(technicianAuth.token);
assert.equal(technicianAuth.record.role, 'technician');
assert.equal(technicianAuth.record.technician_id, linkedTechnicianId);
const technicianHeaders = { Authorization: technicianAuth.token };

const technicianIdentity = await request('/api/isivolt/me', { headers: technicianHeaders });
assert.equal(technicianIdentity.role, 'technician');
assert.equal(technicianIdentity.technicianId, linkedTechnicianId);

const technicianMovement = {
  id: 'mov-ci-2',
  operationId: 'op-ci-2',
  type: 'delivery',
  toolId: 'tool-ci-2',
  technicianId: linkedTechnicianId,
  operatorName: 'Técnico CI',
  occurredAt: new Date(Date.now() + 1_000).toISOString(),
  previousStatus: 'available',
  nextStatus: 'loaned',
  deviceId: 'device-tech-ci',
  deviceName: 'Android Técnico CI',
  platform: 'android-web',
};

await expectStatus(403, () => request('/api/isivolt/movement', {
  method: 'POST',
  headers: technicianHeaders,
  body: JSON.stringify({
    workspaceId,
    payload: { ...technicianMovement, technicianId: 'tech-ci-ajeno' },
  }),
}));

const ownMovement = await request('/api/isivolt/movement', {
  method: 'POST',
  headers: technicianHeaders,
  body: JSON.stringify({ workspaceId, payload: technicianMovement }),
});
assert.equal(ownMovement.ok, true);
assert.equal(ownMovement.duplicate, false);
assert.equal(ownMovement.tool.holderTechnicianId, linkedTechnicianId);

const sync = await request(`/api/isivolt/sync?workspace=${encodeURIComponent(workspaceId)}&cursor=0`, { headers: adminHeaders });
assert.ok(Array.isArray(sync.events));
assert.ok(sync.events.length >= 7);
assert.ok(sync.events.some((event) => event.entity === 'movements' && event.entity_id === 'mov-ci-1'));
assert.ok(sync.events.some((event) => event.entity === 'movements' && event.entity_id === 'mov-ci-2'));
assert.ok(sync.events.some((event) => event.entity === 'tools' && event.entity_id === 'tool-ci-2' && event.payload.status === 'loaned'));
assert.ok(sync.cursor > 0);

console.log(JSON.stringify({
  ok: true,
  admin: adminIdentity.id,
  technician: technicianIdentity.id,
  events: sync.events.length,
  cursor: sync.cursor,
  duplicateProtected: duplicate.duplicate,
  foreignIdentityRejected: true,
  ownIdentityAccepted: ownMovement.tool.holderTechnicianId === linkedTechnicianId,
}, null, 2));
