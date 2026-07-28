import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { getCurrentSecurityUser } from '../../security/session';
import { getCentralSyncClient } from '../../services/centralSync/client';
import { getCentralSyncConfig } from '../../services/centralSync/config';

type AccessMode = 'login' | 'request';
type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'missing';

type StatusResponse = {
  found: boolean;
  status: RegistrationStatus;
  requestedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
};

const normalizePhone = (value: string) => {
  const compact = value.trim().replace(/[()\s.-]/g, '');
  if (compact.startsWith('00')) return `+${compact.slice(2).replace(/\D/g, '')}`;
  if (compact.startsWith('+')) return `+${compact.slice(1).replace(/\D/g, '')}`;
  return compact.replace(/\D/g, '');
};

const normalizeIdentity = (value: string) => value.includes('@')
  ? value.trim().toLowerCase()
  : normalizePhone(value);

const validPhone = (value: string) => {
  const digits = normalizePhone(value).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

const messageFromError = (cause: unknown, fallback: string) => {
  if (!(cause instanceof Error)) return fallback;
  const message = cause.message.trim();
  if (/failed to fetch|network|load failed/i.test(message)) {
    return 'No se puede contactar con el mini PC. Comprueba la red y vuelve a intentarlo.';
  }
  if (/400|401|auth|identity|credentials/i.test(message)) {
    return 'Teléfono, correo o contraseña incorrectos, o la cuenta todavía no ha sido aprobada.';
  }
  return message || fallback;
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export default function CentralAccessGateway() {
  const config = useMemo(() => getCentralSyncConfig(), []);
  const client = useMemo(() => getCentralSyncClient(), []);
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<AccessMode>('login');
  const [identity, setIdentity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [technicianCode, setTechnicianCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const unsubscribe = client?.authStore.onChange(refresh, true);
    window.addEventListener('isivolt:security-session', refresh);
    window.addEventListener('isivolt:central-account-changed', refresh);
    return () => {
      unsubscribe?.();
      window.removeEventListener('isivolt:security-session', refresh);
      window.removeEventListener('isivolt:central-account-changed', refresh);
    };
  }, [client]);

  if (!config.enabled || !client || !config.workspaceId) return null;

  const remote = client.authStore.isValid ? client.authStore.record : null;
  const local = getCurrentSecurityUser();
  const centralLocalId = remote?.id ? `central-${remote.id}` : '';
  if (remote?.active === true && local?.id === centralLocalId) return null;

  const signIn = async () => {
    const loginIdentity = normalizeIdentity(identity);
    if (!loginIdentity || !password) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await client.collection('isivolt_users').authWithPassword(loginIdentity, password);
      setPassword('');
      window.dispatchEvent(new CustomEvent('isivolt:central-account-changed'));
    } catch (cause) {
      client.authStore.clear();
      setError(messageFromError(cause, 'No se ha podido iniciar sesión.'));
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async () => {
    if (!name.trim() || !email.trim() || !validPhone(phone) || !technicianCode.trim() || password.length < 8) return;
    setBusy(true);
    setError('');
    setNotice('');
    setStatus(null);
    try {
      await client.send('/api/isivolt/register-request', {
        method: 'POST',
        body: {
          workspaceId: config.workspaceId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: normalizePhone(phone),
          technicianCode: technicianCode.trim().toUpperCase(),
          password,
        },
      });
      setPassword('');
      setIdentity(email.trim().toLowerCase());
      setNotice('Solicitud enviada. Un administrador debe comprobarla y vincularla con tu ficha técnica.');
      setStatus({ found: true, status: 'pending', requestedAt: new Date().toISOString() });
    } catch (cause) {
      setError(messageFromError(cause, 'No se ha podido enviar la solicitud.'));
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    const statusIdentity = normalizeIdentity(identity || email || phone);
    if (!statusIdentity) return;
    setBusy(true);
    setError('');
    try {
      const response = await client.send<StatusResponse>('/api/isivolt/register-status', {
        method: 'POST',
        body: { workspaceId: config.workspaceId, identity: statusIdentity },
      });
      setStatus(response);
      if (response.status === 'approved') {
        setNotice('Tu cuenta ha sido aprobada. Ya puedes iniciar sesión con tu teléfono o correo.');
      } else if (response.status === 'rejected') {
        setNotice('La solicitud fue revisada y no se ha aprobado.');
      } else if (response.status === 'missing') {
        setNotice('No se ha encontrado ninguna solicitud con esos datos.');
      } else {
        setNotice('La solicitud sigue pendiente de revisión.');
      }
    } catch (cause) {
      setError(messageFromError(cause, 'No se ha podido consultar el estado.'));
    } finally {
      setBusy(false);
    }
  };

  if (remote?.active === true && local?.id !== centralLocalId) {
    return (
      <div className="central-access-gate">
        <section className="central-access-preparing">
          <LoaderCircle className="central-access-spinner" size={36} />
          <strong>Preparando tu espacio personal</strong>
          <span>Aplicando permisos y vinculando la identidad de la cuenta…</span>
        </section>
      </div>
    );
  }

  const requestReady = name.trim().length >= 3
    && email.includes('@')
    && validPhone(phone)
    && technicianCode.trim().length >= 2
    && password.length >= 8;

  return (
    <div className="central-access-gate" data-revision={revision}>
      <section className="central-access-card" aria-label="Acceso a ISIVOLT">
        <header>
          <span className="central-access-logo"><Wrench size={30} /></span>
          <div><small><ShieldCheck size={14} /> Acceso personal protegido</small><h1>ISIVOLT Herramientas QR</h1><p>Cada operación quedará registrada con la identidad del usuario.</p></div>
        </header>

        <nav aria-label="Tipo de acceso">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setNotice(''); }}><KeyRound size={18} /> Iniciar sesión</button>
          <button type="button" className={mode === 'request' ? 'active' : ''} onClick={() => { setMode('request'); setError(''); setNotice(''); }}><UserPlus size={18} /> Solicitar cuenta</button>
        </nav>

        {mode === 'login' ? (
          <main className="central-access-form">
            <div className="central-access-heading"><LockKeyhole size={25} /><span><small>Cuenta aprobada</small><strong>Accede a tu espacio</strong></span></div>
            <label><span>Teléfono o correo</span><div><Phone size={17} /><input type="text" inputMode="email" value={identity} onChange={(event) => setIdentity(event.target.value)} autoComplete="username" placeholder="697958917 o nombre@organizacion.es" /></div></label>
            <label><span>Contraseña</span><div><KeyRound size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') void signIn(); }} /></div></label>
            <button className="central-access-primary" type="button" onClick={() => { void signIn(); }} disabled={busy || !normalizeIdentity(identity) || !password}>{busy ? <LoaderCircle className="central-access-spinner" size={19} /> : <KeyRound size={19} />}{busy ? 'Comprobando…' : 'Entrar en la aplicación'}</button>
            <button className="central-access-status-button" type="button" onClick={() => { void checkStatus(); }} disabled={busy || !normalizeIdentity(identity)}><ShieldCheck size={17} /> Consultar solicitud con este teléfono o correo</button>
          </main>
        ) : (
          <main className="central-access-form central-registration-form">
            <div className="central-access-heading"><UserPlus size={25} /><span><small>Alta controlada</small><strong>Solicita tu cuenta técnica</strong></span></div>
            <p className="central-access-explanation">La solicitud no permite entrar inmediatamente. Un administrador comprobará tu código y la vinculará con tu ficha.</p>
            <label><span>Nombre y apellidos</span><div><UserPlus size={17} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Nombre completo" /></div></label>
            <div className="central-access-two-columns">
              <label><span>Código interno</span><div><ShieldCheck size={17} /><input value={technicianCode} onChange={(event) => setTechnicianCode(event.target.value.toUpperCase())} placeholder="TEC-001" /></div></label>
              <label><span>Teléfono</span><div><Phone size={17} /><input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="697958917" /></div></label>
            </div>
            <label><span>Correo corporativo</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="nombre@organizacion.es" /></div></label>
            <label><span>Contraseña</span><div><KeyRound size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" /></div></label>
            <button className="central-access-primary" type="button" onClick={() => { void submitRequest(); }} disabled={busy || !requestReady}>{busy ? <LoaderCircle className="central-access-spinner" size={19} /> : <UserPlus size={19} />}{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
            <button className="central-access-status-button" type="button" onClick={() => { setIdentity(email || phone); void checkStatus(); }} disabled={busy || (!email.trim() && !phone.trim())}><ShieldCheck size={17} /> Consultar estado con teléfono o correo</button>
          </main>
        )}

        {error && <p className="central-access-message error"><AlertTriangle size={18} /> {error}</p>}
        {notice && <p className="central-access-message notice"><CheckCircle2 size={18} /> {notice}</p>}
        {status?.found && (
          <aside className={`central-access-status status-${status.status}`}>
            <strong>{status.status === 'approved' ? 'Cuenta aprobada' : status.status === 'rejected' ? 'Solicitud rechazada' : 'Pendiente de aprobación'}</strong>
            {status.requestedAt && <span>Enviada: {formatDate(status.requestedAt)}</span>}
            {status.reviewedAt && <span>Revisada: {formatDate(status.reviewedAt)}</span>}
            {status.rejectionReason && <small>{status.rejectionReason}</small>}
            {status.status === 'approved' && <button type="button" onClick={() => { setMode('login'); setNotice(''); }}>Ir a iniciar sesión</button>}
          </aside>
        )}

        <footer><ShieldCheck size={16} /> Las contraseñas se procesan en PocketBase y nunca se guardan en el repositorio.</footer>
      </section>
    </div>
  );
}
