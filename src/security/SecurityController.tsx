import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Clock3,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { loadAppData } from '../services/storage';
import { hashPin, validatePinFormat, verifyPin } from './crypto';
import { hasPermission } from './permissions';
import {
  getCurrentSecuritySession,
  getCurrentSecurityUser,
  lockSession,
  logoutSession,
  registerSessionActivity,
  unlockSession,
} from './session';
import {
  appendAuditEntry,
  buildSecurityUser,
  ensureSecurityCache,
  getSecurityUsersSync,
  loadAuditEntries,
  loadSecurityUsers,
  saveSecurityUsers,
  upsertSecurityUser,
} from './store';
import type { AuditEntry, SecurityUser, UserRole } from './types';

const INACTIVITY_MS = 5 * 60_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  warehouse: 'Responsable de almacén',
  coordinator: 'Coordinador',
  technician: 'Técnico',
};

const formatTime = (value?: string) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
};

type UserDraft = {
  id?: string;
  name: string;
  role: UserRole;
  technicianId?: string;
  pin: string;
  confirmPin: string;
  active: boolean;
};

const emptyDraft = (): UserDraft => ({
  name: '',
  role: 'warehouse',
  pin: '',
  confirmPin: '',
  active: true,
});

export default function SecurityController() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SecurityUser[]>([]);
  const [currentUser, setCurrentUser] = useState<SecurityUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pin, setPin] = useState('');
  const [setupName, setSetupName] = useState('Administrador');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'audit'>('users');
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const lastTouchRef = useRef(0);
  const knownMovementsRef = useRef(new Set<string>());

  const technicians = useMemo(() => loadAppData().technicians, [adminOpen, users.length]);
  const activeUsers = users.filter((user) => user.active);
  const locked = !currentUser;
  const firstSetup = users.length === 0;

  const applyBodyRole = (user: SecurityUser | null) => {
    if (user) {
      document.body.dataset.role = user.role;
      document.body.dataset.userId = user.id;
    } else {
      delete document.body.dataset.role;
      delete document.body.dataset.userId;
    }
  };

  useEffect(() => {
    void (async () => {
      const loadedUsers = await loadSecurityUsers();
      setUsers(loadedUsers);
      const session = getCurrentSecuritySession();
      const user = session
        ? loadedUsers.find((item) => item.id === session.userId && item.active) ?? null
        : null;
      setCurrentUser(user);
      setSelectedUserId(user?.id ?? loadedUsers.find((item) => item.active)?.id ?? '');
      applyBodyRole(user);
      knownMovementsRef.current = new Set(loadAppData().movements.map((movement) => movement.id));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const onSession = () => {
      const user = getCurrentSecurityUser();
      setCurrentUser(user);
      applyBodyRole(user);
    };
    window.addEventListener('isivolt:security-session', onSession);
    return () => window.removeEventListener('isivolt:security-session', onSession);
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;

    const register = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < 15_000) return;
      lastTouchRef.current = now;
      void registerSessionActivity();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, register, { passive: true }));
    const interval = window.setInterval(() => {
      const session = getCurrentSecuritySession();
      if (!session) return;
      if (Date.now() - new Date(session.lastActivityAt).getTime() >= INACTIVITY_MS) {
        void lockSession('Bloqueo automático tras cinco minutos de inactividad.');
      }
    }, 15_000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, register));
      window.clearInterval(interval);
    };
  }, [currentUser]);

  useEffect(() => {
    const onDataUpdated = (event: Event) => {
      const data = (event as CustomEvent<ReturnType<typeof loadAppData>>).detail;
      if (!data?.movements) return;
      const fresh = data.movements.filter((movement) => !knownMovementsRef.current.has(movement.id));
      fresh.forEach((movement) => {
        knownMovementsRef.current.add(movement.id);
        void appendAuditEntry({
          eventType: 'movement.created',
          entityType: 'movement',
          entityId: movement.id,
          operatorName: movement.operatorName,
          detail: `${movement.type} · herramienta ${movement.toolId} · ${movement.previousStatus} → ${movement.nextStatus}`,
        });
      });
    };
    const onAudit = () => setAuditEntries(loadAuditEntries());
    window.addEventListener('isivolt:data-updated', onDataUpdated);
    window.addEventListener('isivolt:audit-recorded', onAudit);
    return () => {
      window.removeEventListener('isivolt:data-updated', onDataUpdated);
      window.removeEventListener('isivolt:audit-recorded', onAudit);
    };
  }, []);

  const setupAdministrator = async () => {
    setError('');
    if (!setupName.trim()) return setError('Escribe el nombre del administrador.');
    if (!validatePinFormat(setupPin)) return setError('El PIN debe contener entre 4 y 8 números.');
    if (setupPin !== setupConfirm) return setError('Los dos PIN no coinciden.');

    setBusy(true);
    try {
      const user = buildSecurityUser({
        name: setupName,
        role: 'admin',
        pinHash: await hashPin(setupPin),
      });
      await saveSecurityUsers([user]);
      await appendAuditEntry({
        eventType: 'security.setup',
        operatorUserId: user.id,
        operatorName: user.name,
        detail: 'Administrador local creado y seguridad inicial activada.',
      });
      setUsers([user]);
      await unlockSession(user);
      setCurrentUser(user);
      setSetupPin('');
      setSetupConfirm('');
      applyBodyRole(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido activar la seguridad.');
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    setError('');
    await ensureSecurityCache();
    const user = getSecurityUsersSync().find((item) => item.id === selectedUserId);
    if (!user || !user.active) return setError('Selecciona un usuario activo.');
    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil).getTime() : 0;
    if (lockedUntil > Date.now()) {
      return setError(`Usuario bloqueado temporalmente hasta ${formatTime(user.lockedUntil)}.`);
    }

    setBusy(true);
    try {
      const valid = await verifyPin(pin, user.pinHash);
      if (!valid) {
        const attempts = (user.failedAttempts ?? 0) + 1;
        const next = {
          ...user,
          failedAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
          lockedUntil: attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MS).toISOString()
            : undefined,
          updatedAt: new Date().toISOString(),
        };
        await upsertSecurityUser(next);
        const refreshed = await loadSecurityUsers();
        setUsers(refreshed);
        await appendAuditEntry({
          eventType: 'security.failed-login',
          operatorUserId: user.id,
          operatorName: user.name,
          detail: attempts >= MAX_FAILED_ATTEMPTS
            ? 'Usuario bloqueado durante un minuto por cinco intentos fallidos.'
            : `Intento de acceso incorrecto ${attempts}/${MAX_FAILED_ATTEMPTS}.`,
        });
        setPin('');
        return setError(attempts >= MAX_FAILED_ATTEMPTS
          ? 'Demasiados intentos. El usuario queda bloqueado durante un minuto.'
          : `PIN incorrecto. Quedan ${MAX_FAILED_ATTEMPTS - attempts} intentos.`);
      }

      const logged = {
        ...user,
        failedAttempts: 0,
        lockedUntil: undefined,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await upsertSecurityUser(logged);
      const refreshed = await loadSecurityUsers();
      setUsers(refreshed);
      await unlockSession(logged);
      setCurrentUser(logged);
      setPin('');
      applyBodyRole(logged);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido comprobar el PIN.');
    } finally {
      setBusy(false);
    }
  };

  const openAdministration = () => {
    setAuditEntries(loadAuditEntries());
    setDraft(null);
    setAdminOpen(true);
  };

  const editUser = (user?: SecurityUser) => {
    setError('');
    setDraft(user ? {
      id: user.id,
      name: user.name,
      role: user.role,
      technicianId: user.technicianId,
      pin: '',
      confirmPin: '',
      active: user.active,
    } : emptyDraft());
  };

  const saveUser = async () => {
    if (!draft) return;
    setError('');
    if (!draft.name.trim()) return setError('Escribe el nombre del usuario.');
    if (!draft.id && !validatePinFormat(draft.pin)) return setError('El nuevo usuario necesita un PIN de 4 a 8 números.');
    if (draft.pin && (!validatePinFormat(draft.pin) || draft.pin !== draft.confirmPin)) {
      return setError('Revisa el PIN y su confirmación.');
    }

    const existing = draft.id ? users.find((item) => item.id === draft.id) : undefined;
    if (existing?.id === currentUser?.id && !draft.active) return setError('No puedes desactivar tu propia sesión.');
    const activeAdmins = users.filter((item) => item.active && item.role === 'admin' && item.id !== existing?.id);
    if (existing?.role === 'admin' && draft.role !== 'admin' && activeAdmins.length === 0) {
      return setError('Debe permanecer al menos un administrador activo.');
    }

    if (draft.role === 'technician') {
      if (!draft.technicianId) return setError('Selecciona la ficha técnica que utilizará este usuario.');
      const linkedTechnician = technicians.find((item) => item.id === draft.technicianId && item.active);
      if (!linkedTechnician) return setError('La ficha técnica seleccionada no existe o está inactiva.');
      const duplicatedLink = users.some((item) =>
        item.id !== existing?.id
        && item.active
        && item.role === 'technician'
        && item.technicianId === draft.technicianId,
      );
      if (draft.active && duplicatedLink) {
        return setError('Esta ficha técnica ya está vinculada a otro usuario técnico activo.');
      }
    }

    setBusy(true);
    try {
      const pinHash = draft.pin ? await hashPin(draft.pin) : existing?.pinHash;
      if (!pinHash) throw new Error('No se ha podido preparar el PIN.');
      const timestamp = new Date().toISOString();
      const user: SecurityUser = existing ? {
        ...existing,
        name: draft.name.trim(),
        role: draft.role,
        technicianId: draft.role === 'technician' ? draft.technicianId : undefined,
        pinHash,
        active: draft.active,
        failedAttempts: draft.pin ? 0 : existing.failedAttempts,
        lockedUntil: draft.pin ? undefined : existing.lockedUntil,
        updatedAt: timestamp,
      } : buildSecurityUser({
        name: draft.name,
        role: draft.role,
        technicianId: draft.role === 'technician' ? draft.technicianId : undefined,
        pinHash,
      });
      await upsertSecurityUser(user);
      await appendAuditEntry({
        eventType: existing ? 'user.updated' : 'user.created',
        entityType: 'security-user',
        entityId: user.id,
        operatorUserId: currentUser?.id,
        operatorName: currentUser?.name,
        detail: `${user.name} · ${roleLabel[user.role]} · ${user.active ? 'activo' : 'inactivo'}.`,
      });
      const refreshed = await loadSecurityUsers();
      setUsers(refreshed);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar el usuario.');
    } finally {
      setBusy(false);
    }
  };

  const removeInactiveUser = async (user: SecurityUser) => {
    if (user.active || user.id === currentUser?.id) return;
    const confirmed = window.confirm(`¿Eliminar el usuario inactivo ${user.name}?`);
    if (!confirmed) return;
    const next = users.filter((item) => item.id !== user.id);
    await saveSecurityUsers(next);
    setUsers(next);
    await appendAuditEntry({
      eventType: 'admin.action',
      entityType: 'security-user',
      entityId: user.id,
      operatorUserId: currentUser?.id,
      operatorName: currentUser?.name,
      detail: `Usuario inactivo eliminado: ${user.name}.`,
    });
  };

  if (loading) {
    return <div className="security-loading"><ShieldCheck size={34} /><strong>Preparando acceso seguro…</strong></div>;
  }

  return (
    <>
      <AnimatePresence>
        {locked && (
          <motion.div className="security-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="security-card" initial={{ y: 40, scale: 0.94 }} animate={{ y: 0, scale: 1 }}>
              <div className="security-emblem"><Lock size={34} /></div>
              <span className="security-kicker"><ShieldCheck size={14} /> Acceso local protegido</span>
              <h1>{firstSetup ? 'Activa la seguridad' : 'ISIVOLT bloqueado'}</h1>
              <p>{firstSetup
                ? 'Crea el administrador inicial. El PIN quedará derivado mediante PBKDF2 y no se guardará en texto.'
                : 'Selecciona tu usuario e introduce el PIN para continuar.'}</p>

              {firstSetup ? (
                <div className="security-form">
                  <label>Nombre del administrador<input value={setupName} onChange={(event) => setSetupName(event.target.value)} autoComplete="name" /></label>
                  <label>PIN<input type="password" inputMode="numeric" maxLength={8} value={setupPin} onChange={(event) => setSetupPin(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></label>
                  <label>Repetir PIN<input type="password" inputMode="numeric" maxLength={8} value={setupConfirm} onChange={(event) => setSetupConfirm(event.target.value.replace(/\D/g, ''))} autoComplete="new-password" /></label>
                  <button onClick={() => { void setupAdministrator(); }} disabled={busy}><KeyRound size={18} /> {busy ? 'Protegiendo…' : 'Crear administrador'}</button>
                </div>
              ) : (
                <div className="security-form">
                  <label>Usuario<select value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setError(''); }}>{activeUsers.map((user) => <option value={user.id} key={user.id}>{user.name} · {roleLabel[user.role]}</option>)}</select></label>
                  <label>PIN<input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} onKeyDown={(event) => { if (event.key === 'Enter') void login(); }} autoFocus autoComplete="current-password" /></label>
                  <button onClick={() => { void login(); }} disabled={busy || !selectedUserId}><KeyRound size={18} /> {busy ? 'Comprobando…' : 'Desbloquear'}</button>
                </div>
              )}

              {error && <p className="security-error"><AlertTriangle size={17} /> {error}</p>}
              <small className="security-note">El acceso se bloqueará automáticamente tras cinco minutos sin actividad.</small>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {currentUser && (
        <div className="security-session-bar">
          <span><UserRound size={15} /><strong>{currentUser.name}</strong><small>{roleLabel[currentUser.role]}</small></span>
          {hasPermission('security.manage', currentUser) && <button onClick={openAdministration} aria-label="Administrar usuarios"><UserCog size={18} /></button>}
          <button onClick={() => { void lockSession('Bloqueo manual desde la barra de sesión.'); }} aria-label="Bloquear"><Lock size={18} /></button>
          <button onClick={() => { void logoutSession(); }} aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      )}

      <AnimatePresence>
        {adminOpen && currentUser && hasPermission('security.manage', currentUser) && (
          <motion.div className="security-admin-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAdminOpen(false)}>
            <motion.section className="security-admin" initial={{ opacity: 0, y: 38, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} onClick={(event) => event.stopPropagation()}>
              <header><div><Users size={23} /><span><small>Administración protegida</small><strong>Usuarios y auditoría</strong></span></div><button onClick={() => setAdminOpen(false)}><X size={21} /></button></header>
              <nav><button className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}><Users size={17} /> Usuarios</button><button className={adminTab === 'audit' ? 'active' : ''} onClick={() => { setAdminTab('audit'); setAuditEntries(loadAuditEntries()); }}><Clock3 size={17} /> Auditoría</button></nav>

              <main>
                {adminTab === 'users' ? (
                  <section className="security-users-section">
                    <div className="security-section-heading"><h2>Usuarios locales</h2><button onClick={() => editUser()}><Plus size={17} /> Nuevo usuario</button></div>
                    <div className="security-user-list">
                      {users.map((user) => <article key={user.id} className={user.active ? '' : 'inactive'}><span className={`security-role role-${user.role}`}>{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{user.name}</strong><small>{roleLabel[user.role]} · {user.active ? 'Activo' : 'Inactivo'}</small><time>{user.lastLoginAt ? `Último acceso: ${formatTime(user.lastLoginAt)}` : 'Sin accesos registrados'}</time></div><button onClick={() => editUser(user)}><UserCog size={18} /></button>{!user.active && user.id !== currentUser.id && <button className="security-delete-user" onClick={() => { void removeInactiveUser(user); }}><Trash2 size={17} /></button>}</article>)}
                    </div>
                  </section>
                ) : (
                  <section className="security-audit-section">
                    <h2>Registro de auditoría local</h2>
                    <div className="security-audit-list">{auditEntries.length === 0 ? <p>Sin eventos registrados.</p> : auditEntries.slice(0, 150).map((entry) => <article key={entry.id}><strong>{entry.eventType}</strong><span>{entry.detail || 'Sin detalle'}</span><small>{entry.operatorName || 'Sistema'} · {formatTime(entry.occurredAt)}</small></article>)}</div>
                  </section>
                )}
              </main>

              {draft && (
                <div className="security-user-editor">
                  <div className="security-section-heading"><h2>{draft.id ? 'Editar usuario' : 'Nuevo usuario'}</h2><button onClick={() => setDraft(null)}><X size={18} /></button></div>
                  <div className="security-user-grid">
                    <label>Nombre<input value={draft.name} onChange={(event) => setDraft((current) => current && ({ ...current, name: event.target.value }))} /></label>
                    <label>Rol<select value={draft.role} onChange={(event) => {
                      const role = event.target.value as UserRole;
                      setDraft((current) => current && ({ ...current, role, technicianId: role === 'technician' ? current.technicianId : undefined }));
                    }}>{Object.entries(roleLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                    {draft.role === 'technician' && <label className="wide">Técnico vinculado<select value={draft.technicianId ?? ''} onChange={(event) => setDraft((current) => current && ({ ...current, technicianId: event.target.value || undefined }))}><option value="">Selecciona técnico</option>{technicians.filter((technician) => technician.active).map((technician) => <option value={technician.id} key={technician.id}>{technician.name} · {technician.code}</option>)}</select></label>}
                    <label>PIN {draft.id && <small>(vacío = conservar)</small>}<input type="password" inputMode="numeric" maxLength={8} value={draft.pin} onChange={(event) => setDraft((current) => current && ({ ...current, pin: event.target.value.replace(/\D/g, '') }))} /></label>
                    <label>Repetir PIN<input type="password" inputMode="numeric" maxLength={8} value={draft.confirmPin} onChange={(event) => setDraft((current) => current && ({ ...current, confirmPin: event.target.value.replace(/\D/g, '') }))} /></label>
                    <label className="security-active-toggle wide"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => current && ({ ...current, active: event.target.checked }))} /><span>Usuario activo</span></label>
                  </div>
                  {error && <p className="security-error"><AlertTriangle size={17} /> {error}</p>}
                  <button className="security-save-user" onClick={() => { void saveUser(); }} disabled={busy}><Check size={18} /> Guardar usuario</button>
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
