import assert from 'node:assert/strict';

const baseUrl = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const adminEmail = process.env.ISIVOLT_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const adminPassword = process.env.ISIVOLT_BOOTSTRAP_ADMIN_PASSWORD ?? 'ChangeThis123!';
const workspaceId = process.env.ISIVOLT_BOOTSTRAP_WORKSPACE ?? 'ISIVOLT-CI';
const approvedTechnicianId = 'tech-registration-ci-approved';
const approvedEmail = 'solicitud.aprobada@example.test';
const rejectedEmail = 'solicitud.rechazada@example.test';
const password = 'Registration123!';

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
    entityId: approvedTechnicianId,
    action: 'upsert',
    payload: {
      id: approvedTechnicianId,
      code: 'TEC-REG-CI',
      name: 'Técnico Registro CI',
      specialty: 'Electricidad',
      email: approvedEmail,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  }),
});

const submitted = await request('/api/isivolt/register-request', {
  method: 'POST',
  body: JSON.stringify({
    workspaceId,
    name: 'Técnico Registro CI',
    email: approvedEmail,
    technicianCode: 'TEC-REG-CI',
    password,
  }),
});
assert.equal(submitted.ok, true);
assert.equal(submitted.status, 'pending');

let loginBlocked = false;
try {
  await request('/api/collections/isivolt_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: approvedEmail, password }),
  });
} catch (error) {
  loginBlocked = error.status >= 400;
}
assert.equal(loginBlocked, true);

const listed = await request(`/api/isivolt/registration-requests?workspace=${encodeURIComponent(workspaceId)}`, {
  headers: adminHeaders,
});
const pending = listed.requests.find((item) => item.email === approvedEmail);
assert.ok(pending);
assert.equal(pending.status, 'pending');
assert.equal(pending.technicianCode, 'TEC-REG-CI');

const approved = await request('/api/isivolt/registration-request/approve', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ workspaceId, requestId: pending.id, technicianId: approvedTechnicianId }),
});
assert.equal(approved.ok, true);
assert.equal(approved.request.status, 'approved');

const technicianAuth = await request('/api/collections/isivolt_users/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: approvedEmail, password }),
});
const identity = await request('/api/isivolt/me', { headers: { Authorization: technicianAuth.token } });
assert.equal(identity.role, 'technician');
assert.equal(identity.technicianId, approvedTechnicianId);

await request('/api/isivolt/register-request', {
  method: 'POST',
  body: JSON.stringify({
    workspaceId,
    name: 'Solicitud Rechazada CI',
    email: rejectedEmail,
    technicianCode: 'TEC-NO-EXISTE',
    password,
  }),
});
const withRejectedPending = await request(`/api/isivolt/registration-requests?workspace=${encodeURIComponent(workspaceId)}`, {
  headers: adminHeaders,
});
const rejectedPending = withRejectedPending.requests.find((item) => item.email === rejectedEmail);
assert.ok(rejectedPending);

const rejected = await request('/api/isivolt/registration-request/reject', {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({ workspaceId, requestId: rejectedPending.id, reason: 'El código interno no coincide con el directorio.' }),
});
assert.equal(rejected.ok, true);
assert.equal(rejected.request.status, 'rejected');

const status = await request('/api/isivolt/register-status', {
  method: 'POST',
  body: JSON.stringify({ workspaceId, email: rejectedEmail }),
});
assert.equal(status.found, true);
assert.equal(status.status, 'rejected');
assert.match(status.rejectionReason, /código interno/i);

console.log(JSON.stringify({
  ok: true,
  pendingBlocked: true,
  approvedLogin: true,
  rejectedStatusVisible: true,
}, null, 2));
