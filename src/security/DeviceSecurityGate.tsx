import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { clearCloudSession, CLOUD_PROFILE_EVENT } from '../cloud/config';
import {
  createOrReplacePin,
  DEVICE_LOCK_REQUEST_EVENT,
  DEVICE_REAUTH_REQUEST_EVENT,
  getSecurityIdentity,
  hasConfiguredPin,
  readSecurityRecord,
  type ReauthRequestDetail,
  type SecurityIdentity,
  verifyPin,
} from './deviceSecurity';

type GateMode = 'loading' | 'setup' | 'confirm-setup' | 'locked' | 'reauth' | 'unlocked';

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'];
const BACKGROUND_LOCK_MS = 60_000;

const sanitizePin = (value: string): string => value.replace(/\D/g, '').slice(0, 6);

const formatWait = (lockedUntil?: number): string => {
  if (!lockedUntil) return '';
  const seconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
  return `${seconds} s`;
};

export default function DeviceSecurityGate() {
  const [identity, setIdentity] = useState<SecurityIdentity>(() => getSecurityIdentity());
  const [mode, setMode] = useState<GateMode>('loading');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | undefined>();
  const [clock, setClock] = useState(Date.now());
  const [reauthRequest, setReauthRequest] = useState<ReauthRequestDetail | null>(null);
  const lastActivity = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);

  const record = useMemo(() => readSecurityRecord(identity), [identity, clock]);
  const waitLabel = formatWait(lockedUntil ?? record?.lockedUntil);
  const isBlocked = Boolean((lockedUntil ?? record?.lockedUntil) && (lockedUntil ?? record?.lockedUntil ?? 0) > clock);

  const activateIdentity = (nextIdentity = getSecurityIdentity()) => {
    if (reauthRequest) reauthRequest.resolve(false);
    setReauthRequest(null);
    setIdentity(nextIdentity);
    setPin('');
    setFirstPin('');
    setMessage('');
    const configured = hasConfiguredPin(nextIdentity);
    const nextRecord = readSecurityRecord(nextIdentity);
    setLockedUntil(nextRecord?.lockedUntil);
    setMode(configured ? 'locked' : 'setup');
  };

  const lock = (reason = 'manual') => {
    if (!hasConfiguredPin(identity)) {
      setMode('setup');
      return;
    }
    if (reauthRequest) reauthRequest.resolve(false);
    setReauthRequest(null);
    setPin('');
    setMessage(reason === 'background' ? 'IsiVoltPro se ha bloqueado al quedar en segundo plano.' : '');
    setMode('locked');
  };

  useEffect(() => {
    activateIdentity();
    const handleProfile = () => activateIdentity(getSecurityIdentity());
    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    return () => window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
  }, []);

  useEffect(() => {
    const handleLock = (event: Event) => lock((event as CustomEvent<{ reason?: string }>).detail?.reason ?? 'manual');
    const handleReauth = (event: Event) => {
      const detail = (event as CustomEvent<ReauthRequestDetail>).detail;
      if (!detail) return;
      if (!hasConfiguredPin(identity)) {
        detail.resolve(false);
        return;
      }
      setPin('');
      setMessage('Confirma tu PIN para continuar.');
      setReauthRequest(detail);
      setMode('reauth');
    };
    window.addEventListener(DEVICE_LOCK_REQUEST_EVENT, handleLock);
    window.addEventListener(DEVICE_REAUTH_REQUEST_EVENT, handleReauth);
    return () => {
      window.removeEventListener(DEVICE_LOCK_REQUEST_EVENT, handleLock);
      window.removeEventListener(DEVICE_REAUTH_REQUEST_EVENT, handleReauth);
    };
  }, [identity, reauthRequest]);

  useEffect(() => {
    const root = document.getElementById('root') as (HTMLElement & { inert?: boolean }) | null;
    const locked = mode !== 'unlocked';
    document.body.dataset.deviceLocked = locked ? 'true' : 'false';
    if (root) root.inert = locked;
    return () => {
      delete document.body.dataset.deviceLocked;
      if (root) root.inert = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'unlocked') return;
    const markActivity = () => { lastActivity.current = Date.now(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      if (hiddenAt.current && Date.now() - hiddenAt.current >= BACKGROUND_LOCK_MS) lock('background');
      hiddenAt.current = null;
      markActivity();
    };
    const interval = window.setInterval(() => {
      const minutes = readSecurityRecord(identity)?.autoLockMinutes ?? 5;
      if (Date.now() - lastActivity.current >= minutes * 60_000) lock('inactivity');
    }, 10_000);
    for (const eventName of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      for (const eventName of ['pointerdown', 'keydown', 'touchstart'] as const) {
        window.removeEventListener(eventName, markActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [identity, mode]);

  useEffect(() => {
    if (!isBlocked) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isBlocked]);

  const addDigit = (digit: string) => {
    if (busy || isBlocked || !digit) return;
    setPin((current) => sanitizePin(`${current}${digit}`));
    setMessage('');
  };

  const erase = () => {
    if (busy || isBlocked) return;
    setPin((current) => current.slice(0, -1));
    setMessage('');
  };

  const unlock = async () => {
    if (pin.length !== 6 || busy || isBlocked) return;
    setBusy(true);
    try {
      const result = await verifyPin(pin, identity);
      if (result.ok) {
        setPin('');
        setLockedUntil(undefined);
        lastActivity.current = Date.now();
        if (mode === 'reauth') {
          reauthRequest?.resolve(true);
          setReauthRequest(null);
        }
        setMode('unlocked');
        setMessage('');
        return;
      }
      setPin('');
      setLockedUntil(result.lockedUntil);
      if (result.lockedUntil) setMessage(`Demasiados intentos. Espera ${formatWait(result.lockedUntil)}.`);
      else setMessage(`PIN incorrecto. Quedan ${result.remainingAttempts} intentos antes del bloqueo temporal.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se ha podido verificar el PIN.');
    } finally {
      setBusy(false);
      setClock(Date.now());
    }
  };

  const continueSetup = () => {
    if (pin.length !== 6) return;
    setFirstPin(pin);
    setPin('');
    setMessage('Vuelve a introducir las seis cifras.');
    setMode('confirm-setup');
  };

  const finishSetup = async () => {
    if (pin.length !== 6 || busy) return;
    if (pin !== firstPin) {
      setPin('');
      setFirstPin('');
      setMessage('Los PIN no coinciden. Empieza de nuevo.');
      setMode('setup');
      return;
    }
    setBusy(true);
    try {
      await createOrReplacePin(pin, 5, identity);
      setPin('');
      setFirstPin('');
      lastActivity.current = Date.now();
      setMode('unlocked');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se ha podido proteger el dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'setup') continueSetup();
    else if (mode === 'confirm-setup') void finishSetup();
    else void unlock();
  };

  const cancelReauth = () => {
    reauthRequest?.resolve(false);
    setReauthRequest(null);
    setPin('');
    setMessage('');
    setMode('unlocked');
  };

  const logout = () => {
    if (reauthRequest) reauthRequest.resolve(false);
    setReauthRequest(null);
    clearCloudSession();
  };

  if (mode === 'unlocked') return null;

  const setup = mode === 'setup' || mode === 'confirm-setup';
  const heading = mode === 'loading'
    ? 'Preparando seguridad'
    : mode === 'setup'
      ? 'Crea tu PIN personal'
      : mode === 'confirm-setup'
        ? 'Confirma tu PIN'
        : mode === 'reauth'
          ? 'Confirmación de seguridad'
          : 'IsiVoltPro bloqueado';
  const description = mode === 'setup'
    ? 'Este PIN de seis cifras protege esta cuenta únicamente en este dispositivo.'
    : mode === 'confirm-setup'
      ? 'Repite el PIN para comprobar que lo recuerdas correctamente.'
      : mode === 'reauth'
        ? reauthRequest?.reason ?? 'Confirma tu identidad para continuar.'
        : 'Introduce tu PIN personal para continuar.';

  return createPortal(
    <div className="device-security-gate" role="presentation">
      <section className={`device-security-card mode-${mode}`} role="dialog" aria-modal="true" aria-label={heading}>
        <header>
          <span className="device-security-logo">IZ</span>
          <div><small>ISIVOLTPRO HERRAMIENTAS</small><strong>{heading}</strong></div>
        </header>

        {mode === 'loading' ? (
          <div className="device-security-loading"><LoaderCircle size={30} /><p>Comprobando la protección de este dispositivo.</p></div>
        ) : (
          <form onSubmit={submit}>
            <div className="device-security-identity">
              <span>{setup ? <ShieldCheck size={22} /> : <LockKeyhole size={22} />}</span>
              <div><strong>{identity.label}</strong><small>{identity.detail}</small></div>
            </div>

            <div className="device-security-copy">
              <h1>{heading}</h1>
              <p>{description}</p>
            </div>

            <label className="device-security-pin-field">
              <span className="sr-only">PIN de seis cifras</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={pin}
                onChange={(event) => { setPin(sanitizePin(event.target.value)); setMessage(''); }}
                maxLength={6}
                autoFocus
                disabled={busy || isBlocked}
              />
              <span className="device-security-dots" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => <i className={index < pin.length ? 'filled' : ''} key={index} />)}
              </span>
            </label>

            <div className="device-security-keypad" aria-label="Teclado numérico">
              {digits.map((digit, index) => digit ? (
                <button type="button" key={`${digit}-${index}`} onClick={() => addDigit(digit)} disabled={busy || isBlocked}>{digit}</button>
              ) : <span key={`empty-${index}`} />)}
              <button className="erase" type="button" onClick={erase} disabled={busy || isBlocked} aria-label="Borrar última cifra"><span aria-hidden="true">⌫</span></button>
            </div>

            {message && <p className="device-security-message" role="status">{message}</p>}
            {isBlocked && <p className="device-security-wait" role="timer">Vuelve a intentarlo dentro de {waitLabel}.</p>}

            <button className="device-security-primary" type="submit" disabled={pin.length !== 6 || busy || isBlocked}>
              {busy ? <LoaderCircle className="device-security-spin" size={19} /> : setup ? <ShieldCheck size={19} /> : <KeyRound size={19} />}
              {mode === 'setup' ? 'Continuar' : mode === 'confirm-setup' ? 'Crear PIN' : 'Desbloquear'}
            </button>

            <div className="device-security-secondary-actions">
              {mode === 'confirm-setup' && <button type="button" onClick={() => { setMode('setup'); setPin(''); setFirstPin(''); setMessage(''); }}><ArrowLeft size={16} /> Volver</button>}
              {mode === 'reauth' && <button type="button" onClick={cancelReauth}><ArrowLeft size={16} /> Cancelar</button>}
              {identity.profile && mode !== 'setup' && mode !== 'confirm-setup' && <button type="button" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>}
            </div>
          </form>
        )}

        <footer><Smartphone size={16} /><span>El PIN no se envía al servidor ni se guarda como texto. Protege el acceso local a esta cuenta.</span></footer>
      </section>
    </div>,
    document.body,
  );
}
