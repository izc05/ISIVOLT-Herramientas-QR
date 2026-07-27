import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock3,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';
import type { Technician } from '../../domain/types';
import { getCurrentSecurityUser } from '../../security/session';
import { getCentralSyncClient } from '../../services/centralSync/client';
import { getCentralSyncConfig } from '../../services/centralSync/config';
import { loadAppData } from '../../services/storage';

type RequestStatus = 'pending' | 'approved' | 'rejected';

type RegistrationRequest = {
  id: string;
  userId: string;
  workspace: string;
  name: string;
  email: string;
  technicianCode: string;
  status: RequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

type RequestListResponse = { requests: RegistrationRequest[] };

const normalize = (value: string) => value.trim().toLocaleUpperCase('es-ES');
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value)) : '';

export default function RegistrationRequestManager() {
  const config = useMemo(() => getCentralSyncConfig(), []);
  const client = useMemo(() => getCentralSyncClient(), []);
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [technicians, setTechnicians] = useState<Technician[]>(() => loadAppData().technicians);

  const remoteRole = String(client?.authStore.record?.role ?? '');
  const localRole = getCurrentSecurityUser()?.role;
  const canReview = Boolean(config.enabled && client?.authStore.isValid && (remoteRole === 'admin' || localRole === 'admin'));

  const loadRequests = async () => {
    if (!client || !config.enabled || !config.workspaceId || !canReview) return;
    setBusy(true);
    setError('');
    try {
      const response = await client.send<RequestListResponse>(
        `/api/isivolt/registration-requests?workspace=${encodeURIComponent(config.workspaceId)}`,
        { method: 'GET' },
      );
      const next = response.requests ?? [];
      setRequests(next);
      setTechnicians(loadAppData().technicians.filter((technician) => technician.active));
      setSelectedId((current) => current && next.some((item) => item.id === current)
        ? current
        : next.find((item) => item.status === 'pending')?.id ?? next[0]?.id ?? '');
      window.dispatchEvent(new CustomEvent('isivolt:registration-requests-count', {
        detail: next.filter((item) => item.status === 'pending').length,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se han podido consultar las solicitudes.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const openManager = () => {
      setOpen(true);
      setError('');
      setNotice('');
      void loadRequests();
    };
    window.addEventListener('isivolt:registration-request-manager-open', openManager);
    return () => window.removeEventListener('isivolt:registration-request-manager-open', openManager);
  });

  useEffect(() => {
    if (!open) return;
    const selected = requests.find((item) => item.id === selectedId);
    if (!selected || selected.status !== 'pending') {
      setTechnicianId('');
      setReason('');
      return;
    }
    const matching = technicians.find((technician) => normalize(technician.code) === normalize(selected.technicianCode));
    setTechnicianId(matching?.id ?? '');
    setReason('');
  }, [open, requests, selectedId, technicians]);

  const selected = requests.find((item) => item.id === selectedId) ?? null;
  const needle = query.trim().toLocaleLowerCase('es-ES');
  const filtered = requests.filter((item) => !needle || [
    item.name,
    item.email,
    item.technicianCode,
    item.status,
  ].some((value) => value.toLocaleLowerCase('es-ES').includes(needle)));
  const pendingCount = requests.filter((item) => item.status === 'pending').length;

  const approve = async () => {
    if (!selected || !technicianId || !client || !config.workspaceId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await client.send('/api/isivolt/registration-request/approve', {
        method: 'POST',
        body: { workspaceId: config.workspaceId, requestId: selected.id, technicianId },
      });
      setNotice('Cuenta aprobada y vinculada. El técnico ya puede iniciar sesión.');
      await loadRequests();
      window.dispatchEvent(new CustomEvent('isivolt:central-account-changed'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido aprobar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected || reason.trim().length < 4 || !client || !config.workspaceId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await client.send('/api/isivolt/registration-request/reject', {
        method: 'POST',
        body: { workspaceId: config.workspaceId, requestId: selected.id, reason: reason.trim() },
      });
      setNotice('Solicitud rechazada. El motivo quedará visible para el solicitante.');
      await loadRequests();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido rechazar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="registration-request-manager-launcher"
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('isivolt:registration-request-manager-open'))}
        aria-label="Abrir solicitudes de acceso"
      >
        <UserCheck size={18} /> Solicitudes de acceso {pendingCount > 0 && <b>{pendingCount}</b>}
      </button>

      {open && (
        <div className="registration-manager-backdrop" onClick={() => setOpen(false)}>
          <section className="registration-manager" role="dialog" aria-modal="true" aria-label="Solicitudes de acceso" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><Users size={24} /></span><div><small>Administración de identidad</small><h2>Solicitudes de acceso</h2><p>Comprueba el código y vincula cada cuenta con una ficha existente.</p></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            {!config.enabled ? (
              <div className="registration-manager-empty"><ShieldCheck size={36} /><strong>Mini PC sin configurar</strong><span>La bandeja empezará a funcionar cuando PocketBase esté conectado.</span></div>
            ) : !canReview ? (
              <div className="registration-manager-empty"><AlertTriangle size={36} /><strong>Acceso de administrador necesario</strong><span>Inicia sesión con una cuenta administradora del mini PC.</span></div>
            ) : (
              <div className="registration-manager-layout">
                <aside>
                  <div className="registration-manager-toolbar">
                    <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o código…" /></label>
                    <button type="button" onClick={() => { void loadRequests(); }} disabled={busy} aria-label="Actualizar"><RefreshCw className={busy ? 'registration-spinner' : ''} size={18} /></button>
                  </div>
                  <div className="registration-manager-summary"><span><Clock3 size={15} /> {pendingCount} pendientes</span><small>{requests.length} solicitudes totales</small></div>
                  <div className="registration-request-list">
                    {filtered.map((item) => (
                      <button type="button" key={item.id} className={`${selectedId === item.id ? 'active' : ''} status-${item.status}`} onClick={() => setSelectedId(item.id)}>
                        <span>{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                        <div><strong>{item.name}</strong><small>{item.technicianCode} · {item.email}</small><em>{item.status === 'pending' ? 'Pendiente' : item.status === 'approved' ? 'Aprobada' : 'Rechazada'}</em></div>
                      </button>
                    ))}
                    {filtered.length === 0 && <p className="registration-list-empty">No hay solicitudes en este filtro.</p>}
                  </div>
                </aside>

                <main>
                  {!selected ? (
                    <div className="registration-manager-empty"><UserCheck size={38} /><strong>Selecciona una solicitud</strong><span>Verás los datos declarados y la ficha propuesta.</span></div>
                  ) : (
                    <>
                      <section className="registration-request-profile">
                        <div className="registration-request-avatar">{selected.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                        <div><small>{selected.status === 'pending' ? 'Pendiente de revisión' : selected.status === 'approved' ? 'Cuenta aprobada' : 'Solicitud rechazada'}</small><h3>{selected.name}</h3><p><Mail size={15} /> {selected.email}</p><p><KeyRound size={15} /> Código declarado: <strong>{selected.technicianCode}</strong></p><time><Clock3 size={14} /> {formatDate(selected.requestedAt)}</time></div>
                      </section>

                      {selected.status === 'pending' ? (
                        <section className="registration-review-form">
                          <label><span>Ficha técnica que recibirá la cuenta</span><select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}><option value="">Selecciona una ficha</option>{technicians.map((technician) => <option value={technician.id} key={technician.id}>{technician.name} · {technician.code} · {technician.specialty}</option>)}</select></label>
                          {technicianId && normalize(technicians.find((item) => item.id === technicianId)?.code ?? '') !== normalize(selected.technicianCode) && <p className="registration-warning"><AlertTriangle size={17} /> El código de la ficha seleccionada no coincide con el declarado. Revisa antes de aprobar.</p>}
                          <button className="registration-approve" type="button" onClick={() => { void approve(); }} disabled={busy || !technicianId}>{busy ? <LoaderCircle className="registration-spinner" size={18} /> : <Check size={18} />} Aprobar y vincular cuenta</button>
                          <div className="registration-reject-block"><label><span>Motivo si se rechaza</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ejemplo: el código no coincide con el directorio." /></label><button type="button" onClick={() => { void reject(); }} disabled={busy || reason.trim().length < 4}><UserRoundX size={18} /> Rechazar solicitud</button></div>
                        </section>
                      ) : (
                        <section className={`registration-reviewed status-${selected.status}`}>
                          {selected.status === 'approved' ? <UserCheck size={28} /> : <UserRoundX size={28} />}
                          <div><strong>{selected.status === 'approved' ? 'Cuenta vinculada y activa' : 'Solicitud no aprobada'}</strong><span>{selected.reviewedAt ? `Revisada ${formatDate(selected.reviewedAt)}` : 'Revisada por administración'}</span>{selected.rejectionReason && <p>{selected.rejectionReason}</p>}</div>
                        </section>
                      )}
                    </>
                  )}

                  {error && <p className="registration-feedback error"><AlertTriangle size={17} /> {error}</p>}
                  {notice && <p className="registration-feedback notice"><Check size={17} /> {notice}</p>}
                </main>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
