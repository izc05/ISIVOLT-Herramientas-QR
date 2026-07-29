import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { hashPin, validatePinFormat } from '../../security/crypto';
import { getCurrentSecurityUser } from '../../security/session';
import {
  appendAuditEntry,
  buildSecurityUser,
  ensureSecurityCache,
  getSecurityUsersSync,
  upsertSecurityUser,
} from '../../security/store';
import { loadAppData } from '../../services/storage';

const STORAGE_KEY = 'isivolt-local-registration-pilot-v1';

type PilotStatus = 'pending' | 'approved' | 'rejected';

type PilotRequest = {
  id: string;
  name: string;
  technicianCode: string;
  phone: string;
  email: string;
  pinHash: string;
  status: PilotStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewerName?: string;
  rejectionReason?: string;
  technicianId?: string;
  securityUserId?: string;
};

type RequestDraft = {
  name: string;
  technicianCode: string;
  phone: string;
  email: string;
  pin: string;
  confirmPin: string;
};

const emptyDraft = (): RequestDraft => ({
  name: '',
  technicianCode: '',
  phone: '',
  email: '',
  pin: '',
  confirmPin: '',
});

const normalizePhone = (value: string) => value.replace(/\D/g, '');
const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase('es-ES');
const normalizeCode = (value: string) => value.trim().toLocaleUpperCase('es-ES');

const readRequests = (): PilotRequest[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed as PilotRequest[] : [];
  } catch {
    return [];
  }
};

const writeRequests = (requests: PilotRequest[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent('isivolt:local-registration-updated'));
};

const generateId = () => `local-request-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

const downloadJson = (value: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const suggestTechnicianId = (request: PilotRequest) => {
  const technicians = loadAppData().technicians;
  const code = normalizeCode(request.technicianCode);
  const email = normalizeEmail(request.email);
  const phone = normalizePhone(request.phone);
  return technicians.find((technician) => normalizeCode(technician.code) === code)?.id
    ?? technicians.find((technician) => normalizeEmail(technician.email ?? '') === email)?.id
    ?? technicians.find((technician) => normalizePhone(technician.phone ?? '') === phone)?.id
    ?? '';
};

export default function LocalRegistrationPilot() {
  const [revision, setRevision] = useState(0);
  const [requestOpen, setRequestOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [requests, setRequests] = useState<PilotRequest[]>(() => readRequests());
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasLocalUsers, setHasLocalUsers] = useState(false);
  const currentUser = getCurrentSecurityUser();
  const isAdmin = currentUser?.role === 'admin';
  const technicians = useMemo(() => loadAppData().technicians.filter((technician) => technician.active), [revision, managerOpen]);
  const pendingCount = requests.filter((request) => request.status === 'pending').length;

  useEffect(() => {
    const refresh = () => {
      setRequests(readRequests());
      setRevision((value) => value + 1);
    };
    window.addEventListener('isivolt:security-session', refresh);
    window.addEventListener('isivolt:local-registration-updated', refresh);
    window.addEventListener('isivolt:data-updated', refresh);
    return () => {
      window.removeEventListener('isivolt:security-session', refresh);
      window.removeEventListener('isivolt:local-registration-updated', refresh);
      window.removeEventListener('isivolt:data-updated', refresh);
    };
  }, []);

  useEffect(() => {
    void ensureSecurityCache().then(() => setHasLocalUsers(getSecurityUsersSync().length > 0));
  }, [revision]);

  useEffect(() => {
    const openRequest = () => {
      setError('');
      setMessage('');
      setRequestOpen(true);
    };
    const openManager = () => {
      setError('');
      setMessage('');
      const nextSelection: Record<string, string> = {};
      readRequests().forEach((request) => {
        if (request.status === 'pending') nextSelection[request.id] = request.technicianId ?? suggestTechnicianId(request);
      });
      setSelection(nextSelection);
      setManagerOpen(true);
    };
    window.addEventListener('isivolt:local-registration-request-open', openRequest);
    window.addEventListener('isivolt:local-registration-manager-open', openManager);
    return () => {
      window.removeEventListener('isivolt:local-registration-request-open', openRequest);
      window.removeEventListener('isivolt:local-registration-manager-open', openManager);
    };
  }, []);

  const submitRequest = async () => {
    setError('');
    setMessage('');
    const name = draft.name.trim();
    const technicianCode = normalizeCode(draft.technicianCode);
    const phone = normalizePhone(draft.phone);
    const email = normalizeEmail(draft.email);
    if (name.length < 3) return setError('Escribe el nombre y apellidos.');
    if (technicianCode.length < 2) return setError('Escribe el código interno del técnico.');
    if (phone.length < 7 || phone.length > 15) return setError('Revisa el número de teléfono.');
    if (!email.includes('@')) return setError('Revisa el correo electrónico.');
    if (!validatePinFormat(draft.pin)) return setError('El PIN local debe tener entre 4 y 8 números.');
    if (draft.pin !== draft.confirmPin) return setError('Los dos PIN no coinciden.');

    const existing = readRequests().find((request) => request.status !== 'rejected' && (
      normalizeCode(request.technicianCode) === technicianCode
      || normalizePhone(request.phone) === phone
      || normalizeEmail(request.email) === email
    ));
    if (existing) return setError(`Ya existe una solicitud ${existing.status === 'pending' ? 'pendiente' : 'aprobada'} con esos datos.`);

    setBusy(true);
    try {
      const request: PilotRequest = {
        id: generateId(),
        name,
        technicianCode,
        phone,
        email,
        pinHash: await hashPin(draft.pin),
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      writeRequests([request, ...readRequests()]);
      setDraft(emptyDraft());
      setMessage('Solicitud local enviada. El administrador debe aprobarla y vincularla con tu ficha.');
    } finally {
      setBusy(false);
    }
  };

  const approve = async (request: PilotRequest) => {
    if (!isAdmin) return;
    const technicianId = selection[request.id] || suggestTechnicianId(request);
    const technician = technicians.find((item) => item.id === technicianId);
    if (!technician) return setError('Selecciona una ficha técnica activa.');
    await ensureSecurityCache();
    const users = getSecurityUsersSync();
    const duplicate = users.find((user) => user.active && user.role === 'technician' && user.technicianId === technicianId);
    if (duplicate) return setError(`La ficha ya está vinculada al usuario local ${duplicate.name}.`);

    setBusy(true);
    setError('');
    try {
      const user = buildSecurityUser({
        name: technician.name,
        role: 'technician',
        technicianId,
        pinHash: request.pinHash,
      });
      await upsertSecurityUser(user);
      const updated = readRequests().map((item) => item.id === request.id ? {
        ...item,
        status: 'approved' as const,
        reviewedAt: new Date().toISOString(),
        reviewerName: currentUser?.name,
        technicianId,
        securityUserId: user.id,
      } : item);
      writeRequests(updated);
      await appendAuditEntry({
        eventType: 'user.created',
        entityType: 'local-registration',
        entityId: request.id,
        operatorUserId: currentUser?.id,
        operatorName: currentUser?.name,
        detail: `Solicitud local aprobada y vinculada con ${technician.name} (${technician.code}).`,
      });
      setMessage(`Cuenta local aprobada para ${technician.name}. Ya puede entrar con su usuario y PIN.`);
    } finally {
      setBusy(false);
    }
  };

  const reject = async (request: PilotRequest) => {
    if (!isAdmin) return;
    const reason = window.prompt('Motivo del rechazo:', 'Datos pendientes de comprobar.');
    if (reason === null) return;
    const updated = readRequests().map((item) => item.id === request.id ? {
      ...item,
      status: 'rejected' as const,
      reviewedAt: new Date().toISOString(),
      reviewerName: currentUser?.name,
      rejectionReason: reason.trim() || 'Solicitud rechazada por el administrador.',
    } : item);
    writeRequests(updated);
    await appendAuditEntry({
      eventType: 'admin.action',
      entityType: 'local-registration',
      entityId: request.id,
      operatorUserId: currentUser?.id,
      operatorName: currentUser?.name,
      detail: `Solicitud local rechazada: ${request.name}.`,
    });
  };

  const exportRequests = () => {
    const safe = readRequests().map(({ pinHash: _pinHash, ...request }) => request);
    downloadJson({
      format: 'ISIVOLT-LOCAL-REGISTRATION-PILOT',
      exportedAt: new Date().toISOString(),
      requests: safe,
    }, `isivolt-solicitudes-locales-${new Date().toISOString().slice(0, 10)}.json`);
  };

  return (
    <>
      {!currentUser && hasLocalUsers && (
        <button className="local-registration-public-launcher" type="button" onClick={() => setRequestOpen(true)}>
          <UserPlus size={18} /> Solicitar acceso local de prueba
        </button>
      )}

      <button className="local-registration-manager-launcher" type="button" onClick={() => setManagerOpen(true)} aria-label="Abrir solicitudes locales">
        Solicitudes locales
      </button>

      {requestOpen && (
        <div className="local-registration-backdrop" onClick={() => setRequestOpen(false)}>
          <section className="local-registration-modal request" onClick={(event) => event.stopPropagation()}>
            <header><div><span><Smartphone size={23} /></span><div><small>Piloto sin mini PC</small><h2>Solicitar acceso local</h2><p>Esta cuenta solo funcionará en este dispositivo hasta activar PocketBase.</p></div></div><button type="button" onClick={() => setRequestOpen(false)}><X size={20} /></button></header>
            <main>
              <label>Nombre y apellidos<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></label>
              <div className="local-registration-grid"><label>Código interno<input value={draft.technicianCode} onChange={(event) => setDraft((current) => ({ ...current, technicianCode: event.target.value.toUpperCase() }))} placeholder="TEC-001" /></label><label>Teléfono<input type="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" /></label></div>
              <label>Correo corporativo<input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></label>
              <div className="local-registration-grid"><label>PIN local<input type="password" inputMode="numeric" maxLength={8} value={draft.pin} onChange={(event) => setDraft((current) => ({ ...current, pin: event.target.value.replace(/\D/g, '') }))} /></label><label>Repetir PIN<input type="password" inputMode="numeric" maxLength={8} value={draft.confirmPin} onChange={(event) => setDraft((current) => ({ ...current, confirmPin: event.target.value.replace(/\D/g, '') }))} /></label></div>
              <aside><ShieldCheck size={17} /> El PIN se guarda derivado, nunca en texto. Esta solicitud es una prueba local y no crea todavía una cuenta central.</aside>
              {error && <p className="local-registration-error">{error}</p>}
              {message && <p className="local-registration-success"><CheckCircle2 size={17} /> {message}</p>}
            </main>
            <footer><button type="button" onClick={() => setRequestOpen(false)}>Cancelar</button><button className="primary" type="button" onClick={() => void submitRequest()} disabled={busy}><UserPlus size={18} /> {busy ? 'Enviando…' : 'Enviar solicitud local'}</button></footer>
          </section>
        </div>
      )}

      {managerOpen && isAdmin && (
        <div className="local-registration-backdrop" onClick={() => setManagerOpen(false)}>
          <section className="local-registration-modal manager" onClick={(event) => event.stopPropagation()}>
            <header><div><span><Users size={23} /></span><div><small>Administración local</small><h2>Solicitudes del piloto</h2><p>{pendingCount} pendiente{pendingCount === 1 ? '' : 's'} · preparación para el futuro alta central.</p></div></div><button type="button" onClick={() => setManagerOpen(false)}><X size={20} /></button></header>
            <main>
              <div className="local-registration-toolbar"><span><ShieldCheck size={17} /> Solo afecta a este dispositivo</span><button type="button" onClick={exportRequests}><Download size={17} /> Exportar sin credenciales</button></div>
              {requests.length === 0 ? <div className="local-registration-empty"><UserPlus size={30} /><strong>Sin solicitudes locales</strong><span>Cierra la sesión y utiliza “Solicitar acceso local de prueba”.</span></div> : (
                <div className="local-registration-list">{requests.map((request) => (
                  <article key={request.id} className={`status-${request.status}`}>
                    <div className="local-registration-profile"><span>{request.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span><div><strong>{request.name}</strong><small>{request.technicianCode} · {request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : 'Rechazada'}</small><p><Phone size={14} /> {request.phone}<br /><Mail size={14} /> {request.email}</p></div></div>
                    {request.status === 'pending' ? <div className="local-registration-review"><label>Vincular con ficha<select value={selection[request.id] ?? suggestTechnicianId(request)} onChange={(event) => setSelection((current) => ({ ...current, [request.id]: event.target.value }))}><option value="">Selecciona técnico</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name} · {technician.code}</option>)}</select></label><div><button type="button" onClick={() => void reject(request)}>Rechazar</button><button className="approve" type="button" onClick={() => void approve(request)} disabled={busy}><UserCheck size={17} /> Aprobar</button></div></div> : <div className="local-registration-result"><strong>{request.status === 'approved' ? 'Cuenta local creada' : request.rejectionReason}</strong><small>{request.reviewedAt ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.reviewedAt)) : ''}</small></div>}
                  </article>
                ))}</div>
              )}
              {error && <p className="local-registration-error">{error}</p>}
              {message && <p className="local-registration-success"><CheckCircle2 size={17} /> {message}</p>}
            </main>
          </section>
        </div>
      )}
    </>
  );
}
