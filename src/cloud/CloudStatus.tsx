import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { loadData, saveData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData } from '../types';
import {
  clearCloudSession,
  getCloudProfile,
  getPocketBaseToken,
  getPocketBaseUrl,
  savePocketBaseUrl,
  type CloudProfile,
} from './config';
import { authenticate, PocketBaseRequestError, refreshAuthentication } from './pocketbaseClient';
import { synchronizeWorkspace } from './sync';

type CloudState = 'local' | 'connecting' | 'synced' | 'offline' | 'error';

const stateCopy: Record<CloudState, { label: string; detail: string }> = {
  local: { label: 'Solo local', detail: 'Los datos se guardan únicamente en este dispositivo.' },
  connecting: { label: 'Sincronizando', detail: 'Conectando con el servidor central.' },
  synced: { label: 'En la nube', detail: 'Datos sincronizados con PocketBase.' },
  offline: { label: 'Sin conexión', detail: 'Trabajas con la copia local hasta recuperar la conexión.' },
  error: { label: 'Revisar nube', detail: 'La configuración o los permisos necesitan revisión.' },
};

const statusIcon = (state: CloudState) => {
  if (state === 'connecting') return <LoaderCircle className="cloud-spin" size={17} />;
  if (state === 'synced') return <Cloud size={17} />;
  if (state === 'offline') return <WifiOff size={17} />;
  if (state === 'error') return <CloudOff size={17} />;
  return <Server size={17} />;
};

export default function CloudStatus() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CloudState>(() => getPocketBaseUrl() ? 'connecting' : 'local');
  const [profile, setProfile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [url, setUrl] = useState(() => getPocketBaseUrl());
  const [email, setEmail] = useState(() => getCloudProfile()?.email ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const syncing = useRef(false);
  const ignoreNextDataEvent = useRef(false);
  const debounceTimer = useRef<number | null>(null);

  const syncNow = async (data = loadData(), activeProfile = profile): Promise<void> => {
    if (!activeProfile || syncing.current) return;
    syncing.current = true;
    setState('connecting');
    setError('');
    try {
      const result = await synchronizeWorkspace(data, activeProfile);
      ignoreNextDataEvent.current = true;
      saveData(result.data);
      setState('synced');
      setMessage(
        result.uploaded || result.downloaded
          ? `${result.uploaded} cambios enviados · ${result.downloaded} recibidos.`
          : 'Todos los datos están actualizados.',
      );
    } catch (syncError) {
      const requestError = syncError instanceof PocketBaseRequestError ? syncError : null;
      setState(requestError?.status === 0 ? 'offline' : 'error');
      setError(syncError instanceof Error ? syncError.message : 'No se pudo sincronizar.');
    } finally {
      syncing.current = false;
    }
  };

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    const restore = async () => {
      if (!getPocketBaseUrl() || !getPocketBaseToken() || !getCloudProfile()) {
        setState(getPocketBaseUrl() ? 'error' : 'local');
        return;
      }
      try {
        setState('connecting');
        const restoredProfile = await refreshAuthentication();
        setProfile(restoredProfile);
        setEmail(restoredProfile.email);
        await syncNow(loadData(), restoredProfile);
      } catch (restoreError) {
        setState(restoreError instanceof PocketBaseRequestError && restoreError.status === 0 ? 'offline' : 'error');
        setError(restoreError instanceof Error ? restoreError.message : 'No se pudo restaurar la sesión.');
      }
    };

    void restore();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleDataChange = (event: Event) => {
      if (!profile) return;
      if (ignoreNextDataEvent.current) {
        ignoreNextDataEvent.current = false;
        return;
      }
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      const detail = (event as CustomEvent<AppData>).detail ?? loadData();
      debounceTimer.current = window.setTimeout(() => void syncNow(detail, profile), 900);
    };
    window.addEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
    return () => {
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [profile]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!url.trim() || !email.trim() || !password) {
      setError('Indica servidor, correo y contraseña.');
      return;
    }
    savePocketBaseUrl(url);
    setUrl(getPocketBaseUrl());
    setState('connecting');
    try {
      const authenticatedProfile = await authenticate(email, password);
      setProfile(authenticatedProfile);
      setPassword('');
      await syncNow(loadData(), authenticatedProfile);
    } catch (loginError) {
      setState(loginError instanceof PocketBaseRequestError && loginError.status === 0 ? 'offline' : 'error');
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.');
    }
  };

  const logout = () => {
    clearCloudSession();
    setProfile(null);
    setPassword('');
    setMessage('La copia local permanece en este dispositivo.');
    setError('');
    setState(getPocketBaseUrl() ? 'error' : 'local');
  };

  const copy = stateCopy[state];
  if (!target) return null;

  return (
    <>
      {createPortal(
        <button className={`cloud-status-trigger state-${state}`} type="button" onClick={() => setOpen(true)} aria-label={`${copy.label}. Abrir configuración de nube`}>
          {statusIcon(state)}
          <span>{copy.label}</span>
        </button>,
        target,
      )}

      {open && createPortal(
        <div className="cloud-modal-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="cloud-modal" role="dialog" aria-modal="true" aria-label="Conexión central IsiVoltPro" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span><Cloud size={22} /></span><div><small>ISIVOLTPRO CENTRAL</small><h2>Datos compartidos</h2></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <div className={`cloud-summary state-${state}`}><span>{statusIcon(state)}</span><div><strong>{copy.label}</strong><p>{copy.detail}</p></div></div>

            {profile ? (
              <div className="cloud-session">
                <div className="cloud-user-card"><span><ShieldCheck size={23} /></span><div><small>{profile.role === 'admin' ? 'ADMINISTRADOR' : profile.role === 'coordinator' ? 'COORDINADOR' : 'TÉCNICO'}</small><strong>{profile.displayName}</strong><p>{profile.email} · Espacio {profile.workspace}</p></div></div>
                <div className="cloud-session-actions"><button className="cloud-primary" type="button" disabled={state === 'connecting'} onClick={() => void syncNow()}><RefreshCw size={17} /> Sincronizar ahora</button><button type="button" onClick={logout}><LogOut size={17} /> Cerrar sesión</button></div>
              </div>
            ) : (
              <form className="cloud-login" onSubmit={login}>
                <label>Servidor PocketBase<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://datos.isivoltpro.es" /></label>
                <label>Correo electrónico<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                <button className="cloud-primary" type="submit" disabled={state === 'connecting'}>{state === 'connecting' ? <LoaderCircle className="cloud-spin" size={18} /> : <LogIn size={18} />} Conectar y sincronizar</button>
              </form>
            )}

            {message && <p className="cloud-feedback success"><CheckCircle2 size={16} /> {message}</p>}
            {error && <p className="cloud-feedback error"><CloudOff size={16} /> {error}</p>}
            <footer><p>La copia local se conserva para poder seguir trabajando si se pierde la conexión. Al recuperarla, IsiVoltPro combina los registros y sincroniza los cambios.</p></footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
