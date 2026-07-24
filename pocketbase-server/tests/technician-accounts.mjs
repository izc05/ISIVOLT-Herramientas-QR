import assert from 'node:assert/strict';

const baseUrl = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const adminEmail = process.env.ISIVOLT_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const adminPassword = process.env.ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeThis123!';
const workspaceId = process.env.ISIVOLT_BOOTSTRAP_WORKSPACE ?? 'ISIVOLT-CI';
const technicianId = 'tech-account-ci-1';
const technicianEmail = 'cuenta.tecnico@example.test';
const technicianPassword = 'Temporary123!';

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }
  return body;
};

const adminAuth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: adminEmail, password: adminPassword }),
});
const adminHeaders = { Authorization: adminAuth.token };
const now = new Date().toISOString();

await request('/api/isivolt/entity', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    workspaceId,
    entity: 'technicians',
    entityId: technicianId,
    action: 'upsert',
    payload: {
      id: technicianId,
      code: 'TEC-ACCOUNT-CI',
      name: 'Técnico Cuenta CI',
      specialty: 'Electricidad',
      email: technicianEmail,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  }),
});

const created = await request('/api/isivolt/technician-account', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    workspaceId,
    technicianId,
    email: technicianEmail,
    password: technicianPassword,
    name: 'Técnico Cuenta CI',
    active: true,
  }),
});
assert.equal(created.ok, true);
assert.equal(created.created, true);
assert.equal(created.account.technicianId, technicianId);
assert.equal(created.account.email, technicianEmail);

const accounts = await request(`/api/isivolt/technician-accounts?workspace=${encodeURIComponent(workspaceId)}`, {
  headers: adminHeaders,
});
assert.ok(accounts.accounts.some((account) => account.technicianId === technicianId));

const technicianAuth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: technicianEmail, password: technicianPassword }),
});
const identity = await request('/api/isivolt/me', { headers: { Authorization: technicianAuth.token } });
assert.equal(identity.role, 'technician');
assert.equal(identity.technicianId, technicianId);
assert.equal(identity.workspace, workspaceId);

let forbidden = false;
try {
  await request('/api/isivolt/technician-accounts?workspace=' + encodeURIComponent(workspaceId), {
    headers: { Authorization: technicianAuth.token },
  });
} catch (error) {
  forbidden = error.status === 403;
}
assert.equal(forbidden, true);

console.log(JSON.stringify({ ok: true, technicianId, accountCreated: true, technicianLogin: true }, null, 2));
