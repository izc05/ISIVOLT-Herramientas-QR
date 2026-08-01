import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Eye,
  HardDrive,
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
import type {
  PocketBaseIdentity,
  SyncConflict,
  SyncQueueItem,
} from '../services/centralSync/types';

type SyncTab = 'account' | 'queue' | 'conflicts';

const remoteRoleLabel: Record<PocketBaseIdentity['role'], string> = {
  admin: 'Administrador',
  warehouse: 'Responsable de almacén',
  technician: 'Técnico',
  coordinator: 'Coordinador / consulta',
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
  if (reason === 'missing-url') return 'Falta VITE_POCKETBASE_URL.';
  if (reason === 'insecure-url') return 'La URL del mini PC debe utilizar HTTPS. Solo localhost admite HTTP durante desarrollo.';
  if (reason === 'missing-workspace') return 'Falta VITE_ISIVOLT_WORKSPACE_ID.';
  return 'La sincronización con el mini PC no está configurada.';
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
  const [identity, setIdentity] = useState<PocketBaseIdentity | null>(null);
  const [identityChecked, setIdentityChecked] = useState(false);
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

  const loadIdentity = useCallback(async () => {
    setIdentity(null);
    setIdentityChecked(false);
    if (!client || !config.enabled || !client.authStore.isValid) {
      setIdentityChecked(true);
      return;
    }

    try {
      const nextIdentity = await client.send<PocketBaseIdentity>('/api/isivolt/me', { method: 'GET' });
      if (config.workspaceId && nextIdentity.workspace !== config.workspaceId) {
        client.authStore.clear();
        throw new Error('La cuenta pertenece a otro espacio de trabajo.');
      }
      setIdentity(nextIdentity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido validar la cuenta del mini PC.');
    } finally {
      setIdentityChecked(true);
    }
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
    void loadIdentity();
  }, [loadIdentity]);

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
      await client.collection('users').authWithPassword(email.trim(), password);
      setPassword('');
      await loadIdentity();
      requestCentralSync();
      setNotice('Sesión iniciada en el mini PC. Comprobando cambios pendientes…');
    } catch (cause) {
      client.authStore.clear();
      setIdentity(null);
      setError(cause instanceof Error ? cause.message : 'No se ha podido iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    if (!client) return;
    client.authStore.clear();
    setIdentity(null);
    setIdentityChecked(true);
    setError('');
    setNotice('Sesión del mini PC cerrada. La aplicación continúa en modo local.');
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
          <div><span><Cloud size={24} /></span><div><small>ISIVOLT Multiusuario</small><h2>Centro de sincronización</h2><p>Mini PC, cola offline y conflictos.</p></div></div>
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
                  <h3>Mini PC sin configurar</h3>
                  <p>{configReason(config.reason)}</p>
                  <code>VITE_POCKETBASE_URL</code>
                  <code>VITE_ISIVOLT_WORKSPACE_ID</code>
                  <small>La aplicación continúa funcionando localmente. El navegador nunca necesita una clave de administrador de PocketBase.</small>
                </div>
              ) : !client?.authStore.isValid ? (
                <div className="central-sync-login-card">
                  <span className="central-sync-login-icon"><KeyRound size={29} /></span>
                  <h3>Acceso al servidor del almacén</h3>
                  <p>Utiliza la cuenta creada por el administrador en el mini PC.</p>
                  <label><span>Correo</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="nombre@organizacion.es" /></label>
                  <label><span>Contraseña</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') void signIn(); }} /></label>
                  <button type="button" onClick={() => { void signIn(); }} disabled={busy || !email.trim() || !password}>
                    {busy ? <LoaderCircle className="central-sync-spin" size={18} /> : <KeyRound size={18} />}
                    {busy ? 'Comprobando…' : 'Iniciar sesión'}
                  </button>
                </div>
              ) : (
                <div className="central-sync-session-card">
                  <div className="central-sync-session-user"><span><UserRound size={24} /></span><div><small>Cuenta autenticada</small><strong>{identity?.name ?? client.authStore.record?.email ?? client.authStore.record?.id}</strong></div></div>
                  {!identityChecked ? (
                    <p className="central-sync-membership-loading"><LoaderCircle className="central-sync-spin" size={17} /> Comprobando permisos…</p>
                  ) : identity ? (
                    <div className="central-sync-membership-ok">
                      <ShieldCheck size={22} />
                      <div><small>Acceso autorizado</small><strong>{remoteRoleLabel[identity.role]}</strong><span>{identity.workspace}{identity.technicianId ? ` · ${identity.technicianId}` : ''}</span></div>
                    </div>
                  ) : (
                    <div className="central-sync-membership-error"><AlertTriangle size={22} /><div><strong>Cuenta no validada</strong><span>Revisa que siga activa y pertenezca al espacio configurado.</span></div></div>
                  )}
                  <div className="central-sync-server-facts">
                    <span><Server size={17} /><small>Servidor</small><strong>PocketBase local</strong></span>
                    <span><HardDrive size={17} /><small>Base central</small><strong>SQLite en mini PC</strong></span>
                    <span><Database size={17} /><small>Workspace</small><strong>{config.workspaceId}</strong></span>
                  </div>
                  <div className="central-sync-session-actions">
                    <button type="button" onClick={requestCentralSync} disabled={!identity}><RefreshCw size={17} /> Sincronizar ahora</button>
                    <button type="button" className="secondary" onClick={signOut} disabled={busy}><LogOut size={17} /> Cerrar sesión</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'queue' && (
            <section className="central-sync-list-section">
              <div className="central-sync-section-heading"><div><UploadCloud size={20} /><span><small>Trabajo offline protegido</small><strong>Cambios pendientes</strong></span></div><button type="button" onClick={requestCentralSync} disabled={queue.length === 0}><RefreshCw size={16} /> Reintentar</button></div>
              {queue.length === 0 ? (
                <div className="central-sync-empty"><CheckCircle2 size={34} /><strong>Cola vacía</strong><span>No hay cambios locales esperando al mini PC.</span></div>
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
                <div className="central-sync-empty"><ShieldCheck size={34} /><strong>Sin conflictos</strong><span>Los cambios locales y centrales son compatibles.</span></div>
              ) : (
                <div className="central-sync-conflict-list">
                  {conflicts.map((conflict) => (
                    <article key={conflict.id}>
                      <header><span><AlertTriangle size={19} /></span><div><strong>{conflictTitle(conflict)}</strong><small>Servidor: {conflict.remoteAction ?? 'update'} · {formatDateTime(conflict.remoteOccurredAt ?? conflict.detectedAt)}</small></div></header>
                      <p>Existe un cambio local pendiente y otro cambio posterior en el mini PC para la misma entidad.</p>
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
