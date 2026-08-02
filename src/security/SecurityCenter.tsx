import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  LoaderCircle,
  Lock,
  LockKeyhole,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CLOUD_PROFILE_EVENT } from '../cloud/config';
import {
  createOrReplacePin,
  DEVICE_SECURITY_CHANGED_EVENT,
  getSecurityIdentity,
  readSecurityRecord,
  requestDeviceLock,
  updateAutoLockMinutes,
  verifyPin,
  type SecurityIdentity,
} from './deviceSecurity';

const cleanPin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export default function SecurityCenter() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<SecurityIdentity>(() => getSecurityIdentity());
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => readSecurityRecord()?.autoLockMinutes ?? 5);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setIdentity(getSecurityIdentity());
    setAutoLockMinutes(readSecurityRecord()?.autoLockMinutes ?? 5);
  };

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener(CLOUD_PROFILE_EVENT, refresh);
    window.addEventListener(DEVICE_SECURITY_CHANGED_EVENT, refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener(CLOUD_PROFILE_EVENT, refresh);
      window.removeEventListener(DEVICE_SECURITY_CHANGED_EVENT, refresh);
    };
  }, []);

  const resetForm = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setMessage('');
    setError('');
  };

  const changePin = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6) {
      setError('Los tres campos deben contener seis cifras.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('El PIN nuevo y su confirmación no coinciden.');
      return;
    }
    if (newPin === currentPin) {
      setError('El PIN nuevo debe ser diferente al actual.');
      return;
    }
    setBusy(true);
    try {
      const verification = await verifyPin(currentPin, identity);
      if (!verification.ok) {
        setError(verification.lockedUntil
          ? 'La verificación está bloqueada temporalmente por demasiados intentos.'
          : 'El PIN actual no es correcto.');
        return;
      }
      await createOrReplacePin(newPin, autoLockMinutes, identity);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setMessage('PIN actualizado correctamente.');
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'No se ha podido cambiar el PIN.');
    } finally {
      setBusy(false);
    }
  };

  const changeAutoLock = (minutes: number) => {
    setAutoLockMinutes(minutes);
    updateAutoLockMinutes(minutes, identity);
    setMessage(`Bloqueo automático configurado a ${minutes} minuto${minutes === 1 ? '' : 's'}.`);
    setError('');
  };

  const close = () => {
    setOpen(false);
    resetForm();
  };

  const launcher = target ? createPortal(
    <button
      className="security-center-trigger"
      type="button"
      title="Seguridad y PIN"
      aria-label="Abrir seguridad y PIN"
      onClick={() => { refresh(); resetForm(); setOpen(true); }}
    >
      <LockKeyhole size={18} />
      <span>Seguridad</span>
    </button>,
    target,
  ) : null;

  return (
    <>
      {launcher}
      {open && createPortal(
        <div className="security-center-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="security-center-panel" role="dialog" aria-modal="true" aria-label="Seguridad del dispositivo">
            <header>
              <div><span><ShieldCheck size={23} /></span><div><small>ISIVOLTPRO</small><h2>Seguridad del dispositivo</h2><p>PIN personal y bloqueo automático.</p></div></div>
              <button type="button" onClick={close} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <div className="security-center-identity">
              <span><Lock size={22} /></span>
              <div><small>PROTECCIÓN ACTIVA</small><strong>{identity.label}</strong><p>{identity.detail}</p></div>
              <CheckCircle2 size={21} />
            </div>

            <section className="security-center-section">
              <div className="security-center-heading"><span><Clock3 size={20} /></span><div><strong>Bloqueo automático</strong><p>Se activa después de un periodo sin actividad. También se bloquea tras un minuto en segundo plano.</p></div></div>
              <div className="security-time-options">
                {[1, 5, 15, 30].map((minutes) => (
                  <button className={autoLockMinutes === minutes ? 'active' : ''} type="button" key={minutes} onClick={() => changeAutoLock(minutes)}>{minutes} min</button>
                ))}
              </div>
              <button className="security-lock-now" type="button" onClick={() => { close(); requestDeviceLock('manual'); }}><LockKeyhole size={18} /> Bloquear ahora</button>
            </section>

            <section className="security-center-section">
              <div className="security-center-heading"><span><KeyRound size={20} /></span><div><strong>Cambiar PIN</strong><p>El PIN nuevo debe contener exactamente seis cifras.</p></div></div>
              <form className="security-change-pin" onSubmit={changePin}>
                <label>PIN actual<input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="off" value={currentPin} onChange={(event) => setCurrentPin(cleanPin(event.target.value))} /></label>
                <label>PIN nuevo<input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(cleanPin(event.target.value))} /></label>
                <label>Repetir PIN<input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="new-password" value={confirmPin} onChange={(event) => setConfirmPin(cleanPin(event.target.value))} /></label>
                <button type="submit" disabled={busy}>{busy ? <LoaderCircle className="device-security-spin" size={18} /> : <ShieldCheck size={18} />} Actualizar PIN</button>
              </form>
            </section>

            {message && <p className="security-center-feedback success" role="status">{message}</p>}
            {error && <p className="security-center-feedback error" role="alert">{error}</p>}

            <footer>El PIN se deriva mediante PBKDF2 y Web Crypto. La huella, el reconocimiento facial y las passkeys se incorporarán sobre esta base.</footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
