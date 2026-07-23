import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Eye,
  KeyRound,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  TimerReset,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import { getCentralSyncClient } from '../services/centralSync/client';
import { getCentralSyncConfig } from '../services/centralSync/config';
import { resolveSyncConflict } from '../services/centralSync/conflictResolution';
import { requestCentralSync } from '../services/centralSync/engine';
import { readSyncConflicts, readSyncOutbox } from '../services/centralSync/outbox';
import type { SyncConflict, SyncQueueItem } from '../services/centralSync/types';

type SyncTab = 'account' | 'queue' | 'conflicts';

type WorkspaceMembership = {
  role: 'admin' | 'warehouse' | 'technician' | 'viewer';
  display_name?: string | null;
  technician_id?: string | null;
  active: boolean;
};

const remoteRoleLabel: Record<WorkspaceMembership['role'], string> = {
  admin: 'Administrador',
  warehouse: 'Responsable de almacén',
  technician: 'Técnico',
  viewer: 'Coordinador / consulta',
};

const entityLabel: Record<SyncQueueItem['entity'], string> = {
  tools: 'Herramienta',
  technicians: 'Técnico',
  movements: 'Movimiento',
  accessories: 'Accesorio',
  maintenance_records: 'Mantenimiento',
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no válida';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const configReason = (reason?: string) => {
  if (reason === 'missing-url') return 'Falta VITE_SUPABASE_URL.';
  if (reason === 'missing-key') return 'Falta VITE_SUPABASE_PUBLISHABLE_KEY.';
  if (reason === 'missing-workspace') return 'Falta VITE_ISIVOLT_WORKSPACE_ID.';
  return 'La sincronización central no está configurada.';
};

const itemTitle = (item: SyncQueueItem) => {
  const name = typeof item.payload.name === 'string'
    ? item.payload.name
    : typeof item.payload.code === 'string'
      ? item.payload.code
      : item.entityId;
  return `${entityLabel[item.entity]} · ${name}`;
};

const conflictTitle = (conflict: SyncConflict) => {
  const name = typeof conflict.remotePayload.name === 'string'
    ? conflict.remotePayload.name
    : typeof conflict.remotePayload.code === 'string'
      ? conflict.remotePayload.code
      : conflict.entityId;
  return `${entityLabel[conflict.entity]} · ${name}`;
};

export default function CentralSyncCenter() {
  const config = useMemo(() => getCentralSyncConfig(), []);
  const client = useMemo(() => getCentralSyncClient(), []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SyncTab>('account');
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<WorkspaceMembership | null>(null);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState<SyncQueueItem[]>(() => readSyncOutbox());
  const [conflicts, setConflicts] = useState<SyncConflict[]>(() => readSyncConflicts());

  const refreshLocalState = useCallback(() => {
    setQueue(readSyncOutbox());
    setConflicts(readSyncConflicts());
  }, []);

  const loadMembership = useCallback(async (nextSession: Session | null) => {
    setMembership(null);
    setMembershipChecked(false);
    if (!client || !config.enabled || !config.workspaceId || !nextSession) {
      setMembershipChecked(true);
      return;
    }

    const { data, error: membershipError } = await client
      .from('workspace_members')
      .select('role,display_name,technician_id,active')
      .eq('workspace_id', config.workspaceId)
      .eq('user_id', nextSession.user.id)
      .maybeSingle();

    if (membershipError) {
      setError(membershipError.message);
      setMembershipChecked(true);
      return;
    }

    setMembership((data as WorkspaceMembership | null) ?? null);
    setMembershipChecked(true);
  }, [client, config.enabled, config.workspaceId]);

  useEffect(() => {
    const openCenter = () => {
      refreshLocalState();
      setOpen(true);
    };
    window.addEventListener('isivolt:central-sync-center-open', openCenter);
    return () => window.removeEventListener('isivolt:central-sync-center-open', openCenter);
  }, [refreshLocalState]);

  useEffect(() => {
    const refresh = () => refreshLocalState();
    window.addEventListener('isivolt:central-sync-outbox', refresh);
    window.addEventListener('isivolt:central-sync-conflicts', refresh);
    window.addEventListener('isivolt:data-updated', refresh);
    return () => {
      window.removeEventListener('isivolt:central-sync-outbox', refresh);
      window.removeEventListener('isivolt:central-sync-conflicts', refresh);
      window.removeEventListener('isivolt:data-updated', refresh);
    };
  }, [refreshLocalState]);

  useEffect(() => {
    if (!client) {
      setMembershipChecked(true);
      return undefined;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      const nextSession = data.session;
      setSession(nextSession);
      void loadMembership(nextSession);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError('');
      void loadMembership(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [client, loadMembership]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('central-sync-center-open');
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('central-sync-center-open');
    };
  }, [open]);

  const signIn = async () => {
    if (!client || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      setPassword('');
      setSession(data.session);
      await loadMembership(data.session);
      requestCentralSync();
      setNotice('Sesión remota iniciada. Comprobando cambios pendientes…');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!client) return;
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await client.auth.signOut();
      if (authError) throw authError;
      setSession(null);
      setMembership(null);
      setMembershipChecked(true);
      setNotice('Sesión remota cerrada. La aplicación continúa en modo local.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido cerrar la sesión.');
    } finally {
      setBusy(false);
    }
  };

  const resolveConflict = (conflict: SyncConflict, decision: 'keep-local' | 'accept-server') => {
    setError('');
    try {
      resolveSyncConflict(conflict.id, decision);
      refreshLocalState();
      setNotice(decision === 'keep-local'
        ? 'Se conservará el cambio local y volverá a intentarse la sincronización.'
        : 'Se ha aceptado el estado del servidor y descartado el cambio local pendiente.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido resolver el conflicto.');
    }
  };

  if (!open) return null;

  return (
    <div className="central-sync-center-backdrop" onClick={() => setOpen(false)}>
      <section className="central-sync-center" role="dialog" aria-modal="true" aria-label="Centro de sincronización" onClick={(event) => event.stopPropagation()}>
        <header className="central-sync-center-header">
          <div><span><Cloud size={24} /></span><div><small>ISIVOLT Multiusuario</small><h2>Centro de sincronización</h2><p>Cuenta remota, cola offline y conflictos.</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
        </header>

        <nav className="central-sync-center-tabs">
          <button type="button" className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}><UserRound size={17} /> Cuenta</button>
          <button type="button" className={tab === 'queue' ? 'active' : ''} onClick={() => { setTab('queue'); refreshLocalState(); }}><UploadCloud size={17} /> Cola <b>{queue.length}</b></button>
          <button type="button" className={tab === 'conflicts' ? 'active' : ''} onClick={() => { setTab('conflicts'); refreshLocalState(); }}><AlertTriangle size={17} /> Conflictos <b>{conflicts.length}</b></button>
        </nav>

        <main className="central-sync-center-content">
          {tab === 'account' && (
            <section className="central-sync-account">
              {!config.enabled ? (
                <div className="central-sync-setup-card">
                  <span><Database size={30} /></span>
                  <h3>Servidor central sin configurar</h3>
                  <p>{configReason(config.reason)}</p>
                  <code>VITE_SUPABASE_URL</code>
                  <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
                  <code>VITE_ISIVOLT_WORKSPACE_ID</code>
                  <small>La aplicación continúa funcionando de forma local. Nunca introduzcas una clave secreta o service_role en el frontend.</small>
                </div>
              ) : !session ? (
                <div className="central-sync-login-card">
                  <span className="central-sync-login-icon"><KeyRound size={29} /></span>
                  <h3>Acceso al espacio central</h3>
                  <p>Utiliza la cuenta creada por el administrador del espacio de trabajo.</p>
                  <label><span>Correo</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="nombre@organizacion.es" /></label>
                  <label><span>Contraseña</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') void signIn(); }} /></label>
                  <button type="button" onClick={() => { void signIn(); }} disabled={busy || !email.trim() || !password}>
                    {busy ? <LoaderCircle className="central-sync-spin" size={18} /> : <KeyRound size={18} />}
                    {busy ? 'Comprobando…' : 'Iniciar sesión remota'}
                  </button>
                </div>
              ) : (
                <div className="central-sync-session-card">
                  <div className="central-sync-session-user"><span><UserRound size={24} /></span><div><small>Cuenta autenticada</small><strong>{session.user.email ?? session.user.id}</strong></div></div>
                  {!membershipChecked ? (
                    <p className="central-sync-membership-loading"><LoaderCircle className="central-sync-spin" size={17} /> Comprobando membresía…</p>
                  ) : membership?.active ? (
                    <div className="central-sync-membership-ok">
                      <ShieldCheck size={22} />
                      <div><small>Acceso autorizado</small><strong>{remoteRoleLabel[membership.role]}</strong><span>{membership.display_name || 'Miembro del espacio'}{membership.technician_id ? ` · ${membership.technician_id}` : ''}</span></div>
                    </div>
                  ) : (
                    <div className="central-sync-membership-error"><AlertTriangle size={22} /><div><strong>Sin acceso al espacio configurado</strong><span>La cuenta existe, pero no tiene una membresía activa en este workspace.</span></div></div>
                  )}
                  <div className="central-sync-server-facts">
                    <span><Server size={17} /><small>Servidor</small><strong>Configurado por HTTPS</strong></span>
                    <span><Database size={17} /><small>Workspace</small><strong>{config.workspaceId?.slice(0, 8)}…</strong></span>
                  </div>
                  <div className="central-sync-session-actions">
                    <button type="button" onClick={requestCentralSync} disabled={!membership?.active}><RefreshCw size={17} /> Sincronizar ahora</button>
                    <button type="button" className="secondary" onClick={() => { void signOut(); }} disabled={busy}><LogOut size={17} /> Cerrar sesión remota</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'queue' && (
            <section className="central-sync-list-section">
              <div className="central-sync-section-heading"><div><UploadCloud size={20} /><span><small>Trabajo offline protegido</small><strong>Cambios pendientes</strong></span></div><button type="button" onClick={requestCentralSync} disabled={queue.length === 0}><RefreshCw size={16} /> Reintentar</button></div>
              {queue.length === 0 ? (
                <div className="central-sync-empty"><CheckCircle2 size={34} /><strong>Cola vacía</strong><span>No hay cambios locales esperando al servidor.</span></div>
              ) : (
                <div className="central-sync-queue-list">
                  {queue.map((item) => (
                    <article key={item.id} className={item.lastError ? 'has-error' : ''}>
                      <span><UploadCloud size={18} /></span>
                      <div><strong>{itemTitle(item)}</strong><small>{item.action} · creado {formatDateTime(item.createdAt)}</small>{item.lastError && <em>{item.lastError}</em>}</div>
                      <aside><b>{item.attempts}</b><small>intentos</small>{item.nextAttemptAt && <time><TimerReset size={13} /> {formatDateTime(item.nextAttemptAt)}</time>}</aside>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'conflicts' && (
            <section className="central-sync-list-section">
              <div className="central-sync-section-heading"><div><AlertTriangle size={20} /><span><small>Decisión necesaria</small><strong>Conflictos detectados</strong></span></div></div>
              {conflicts.length === 0 ? (
                <div className="central-sync-empty"><ShieldCheck size={34} /><strong>Sin conflictos</strong><span>Los cambios locales y remotos son compatibles.</span></div>
              ) : (
                <div className="central-sync-conflict-list">
                  {conflicts.map((conflict) => (
                    <article key={conflict.id}>
                      <header><span><AlertTriangle size={19} /></span><div><strong>{conflictTitle(conflict)}</strong><small>Servidor: {conflict.remoteAction ?? 'update'} · {formatDateTime(conflict.remoteOccurredAt ?? conflict.detectedAt)}</small></div></header>
                      <p>Existe un cambio local pendiente y otro cambio posterior en el servidor para la misma entidad.</p>
                      {conflict.entity === 'movements' ? (
                        <div className="central-sync-movement-warning"><Eye size={17} /> Los movimientos no se sobrescriben. Conserva el local y registra una rectificación si fuera necesaria.</div>
                      ) : null}
                      <footer>
                        <button type="button" onClick={() => resolveConflict(conflict, 'keep-local')}><UploadCloud size={16} /> Conservar local</button>
                        {conflict.entity !== 'movements' && <button type="button" className="server" onClick={() => resolveConflict(conflict, 'accept-server')}><Server size={16} /> Aceptar servidor</button>}
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {error && <p className="central-sync-center-error"><AlertTriangle size={17} /> {error}</p>}
          {notice && <p className="central-sync-center-notice"><CheckCircle2 size={17} /> {notice}</p>}
        </main>
      </section>
    </div>
  );
}
