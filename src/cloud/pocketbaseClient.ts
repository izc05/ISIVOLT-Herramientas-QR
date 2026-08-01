import {
  clearCloudSession,
  getPocketBaseToken,
  getPocketBaseUrl,
  saveCloudProfile,
  savePocketBaseToken,
  type CloudProfile,
} from './config';

export type PocketBaseRecord = Record<string, unknown> & {
  id: string;
  created?: string;
  updated?: string;
};

type ListResponse<T> = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
};

type AuthResponse = {
  token: string;
  record: PocketBaseRecord;
};

export class PocketBaseRequestError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'PocketBaseRequestError';
    this.status = status;
    this.details = details;
  }
}

const profileFromRecord = (record: PocketBaseRecord): CloudProfile => ({
  id: record.id,
  email: String(record.email ?? ''),
  displayName: String(record.display_name ?? record.name ?? record.email ?? 'Usuario IsiVoltPro'),
  role: (record.role === 'admin' || record.role === 'coordinator' || record.role === 'technician')
    ? record.role
    : 'technician',
  workspace: String(record.workspace ?? 'default'),
  technicianExternalId: record.technician_external_id ? String(record.technician_external_id) : undefined,
});

async function request<T>(path: string, options: RequestInit = {}, token = getPocketBaseToken()): Promise<T> {
  const baseUrl = getPocketBaseUrl();
  if (!baseUrl) throw new PocketBaseRequestError('PocketBase no está configurado.', 0);

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', token);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  } catch (error) {
    throw new PocketBaseRequestError(
      error instanceof Error ? error.message : 'No se pudo conectar con PocketBase.',
      0,
      error,
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: unknown }).message ?? `Error ${response.status}`)
      : `Error ${response.status}`;
    if (response.status === 401) clearCloudSession();
    throw new PocketBaseRequestError(message, response.status, payload);
  }

  return payload as T;
}

export async function authenticate(email: string, password: string): Promise<CloudProfile> {
  const result = await request<AuthResponse>('/api/collections/isivolt_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email.trim(), password }),
  }, '');
  const profile = profileFromRecord(result.record);
  savePocketBaseToken(result.token);
  saveCloudProfile(profile);
  return profile;
}

export async function refreshAuthentication(): Promise<CloudProfile> {
  const result = await request<AuthResponse>('/api/collections/isivolt_users/auth-refresh', { method: 'POST' });
  const profile = profileFromRecord(result.record);
  savePocketBaseToken(result.token);
  saveCloudProfile(profile);
  return profile;
}

export async function listRecords(collection: string, workspace: string): Promise<PocketBaseRecord[]> {
  const records: PocketBaseRecord[] = [];
  let page = 1;
  let totalPages = 1;
  const filter = `workspace = "${workspace.replaceAll('"', '\\"')}"`;

  do {
    const params = new URLSearchParams({
      page: String(page),
      perPage: '500',
      sort: '-updated',
      filter,
    });
    const response = await request<ListResponse<PocketBaseRecord>>(
      `/api/collections/${encodeURIComponent(collection)}/records?${params.toString()}`,
    );
    records.push(...response.items);
    totalPages = Math.max(response.totalPages, 1);
    page += 1;
  } while (page <= totalPages);

  return records;
}

export async function createRecord(collection: string, data: Record<string, unknown>): Promise<PocketBaseRecord> {
  return request<PocketBaseRecord>(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRecord(
  collection: string,
  recordId: string,
  data: Record<string, unknown>,
): Promise<PocketBaseRecord> {
  return request<PocketBaseRecord>(
    `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(recordId)}`,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export async function deleteRecord(collection: string, recordId: string): Promise<void> {
  await request<unknown>(
    `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(recordId)}`,
    { method: 'DELETE' },
  );
}
