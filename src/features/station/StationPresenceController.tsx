import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MapPinCheck,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { scanQrCode } from '../../services/barcodeScanner';
import {
  getStationPresenceConfig,
  type StationPresenceConfig,
} from '../../services/stationPresence/config';
import {
  verifyStationToken,
  type StationPass,
} from '../../services/stationPresence/token';

type DisabledStationReason = Extract<StationPresenceConfig, { enabled: false }>['reason'];

const configMessage = (reason: DisabledStationReason) => {
  if (reason === 'missing-station-id') return 'Falta VITE_ISIVOLT_STATION_ID.';
  if (reason === 'missing-public-key') return 'Falta la clave pública del mini PC.';
  if (reason === 'invalid-public-key') return 'La clave pública configurada no es una clave ECDSA P-256 válida.';
  return 'El modo punto de entrega está desactivado.';
};

const operationIdFromButton = (button: HTMLButtonElement): string | null => {
  const panel = button.closest('.operation-review-panel');
  const value = panel?.querySelector<HTMLElement>('.operation-review-summary > span')?.textContent?.trim();
  return value || null;
};

const passStillValid = (pass: StationPass, now = new Date()) =>
  now.getTime() <= new Date(pass.expiresAt).getTime();

export default function StationPresenceController() {
  const config = useMemo(() => getStationPresenceConfig(), []);
  const nextAllowedButtonRef = useRef<HTMLButtonElement | null>(null);
  const passesRef = useRef(new Map<string, StationPass>());
  const [pending, setPending] = useState<{
    operationId: string;
    button: HTMLButtonElement;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('Escanea el código que aparece físicamente junto al mini PC del almacén.');
  const [tone, setTone] = useState<'info' | 'success' | 'error'>('info');

  useEffect(() => {
    if (!config.enabled && config.reason === 'disabled') return undefined;

    const interceptConfirmation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('.operation-review-footer button');
      if (!button || button.disabled) return;

      const operationId = operationIdFromButton(button);
      if (!operationId) return;

      if (nextAllowedButtonRef.current === button) {
        nextAllowedButtonRef.current = null;
        passesRef.current.delete(operationId);
        return;
      }

      const storedPass = passesRef.current.get(operationId);
      if (storedPass && passStillValid(storedPass)) {
        passesRef.current.delete(operationId);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setPending({ operationId, button });
      setTone(config.enabled ? 'info' : 'error');
      setMessage(config.enabled
        ? 'Escanea el código que aparece físicamente junto al mini PC del almacén.'
        : configMessage(config.reason));
    };

    document.addEventListener('click', interceptConfirmation, true);
    return () => document.removeEventListener('click', interceptConfirmation, true);
  }, [config]);

  const close = () => {
    if (checking) return;
    setPending(null);
    setTone('info');
    setMessage('Escanea el código que aparece físicamente junto al mini PC del almacén.');
  };

  const validateStation = async () => {
    if (!pending || !config.enabled || checking) return;
    setChecking(true);
    setTone('info');
    setMessage('Abriendo la cámara para validar el punto de entrega…');
    let acceptedPass: StationPass | undefined;

    const verifyValue = async (value: string) => {
      const result = await verifyStationToken(value, config);
      if (result.valid) {
        acceptedPass = result.pass;
        setTone('success');
        setMessage(`Punto ${result.pass.stationId} validado. La operación puede continuar.`);
        return {
          action: 'finish' as const,
          title: 'Punto de entrega validado',
          message: 'Presencia física confirmada. Cerrando lector…',
          tone: 'success' as const,
        };
      }

      setTone('error');
      setMessage(result.message);
      return {
        action: 'continue' as const,
        title: 'QR no válido',
        message: result.message,
        tone: 'error' as const,
      };
    };

    const result = await scanQrCode({
      autoStart: true,
      continuous: true,
      duplicateCooldownMs: 1_000,
      title: `Punto de entrega · ${config.stationId}`,
      instruction: 'Escanea el QR rotatorio mostrado por el mini PC. No se admite introducción manual.',
      manualLabel: 'Cancelar validación',
      onDetected: async (value) => verifyValue(value),
    });

    if (result.status === 'success' && !acceptedPass) {
      await verifyValue(result.value);
    }

    setChecking(false);
    if (!acceptedPass) {
      if (result.status === 'permission-denied' || result.status === 'error' || result.status === 'unsupported') {
        setTone('error');
        setMessage(result.message);
      } else if (result.status === 'cancelled' || result.status === 'manual-requested') {
        setTone('info');
        setMessage('Validación cancelada. La operación sigue sin confirmar.');
      }
      return;
    }

    const currentPending = pending;
    passesRef.current.set(currentPending.operationId, acceptedPass);
    window.setTimeout(() => {
      nextAllowedButtonRef.current = currentPending.button;
      setPending(null);
      currentPending.button.click();
    }, 350);
  };

  if (!pending) return null;

  return (
    <div className="station-presence-backdrop" role="presentation" onClick={close}>
      <section
        className={`station-presence-card station-presence-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label="Validar punto de entrega"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="station-presence-close" type="button" onClick={close} disabled={checking} aria-label="Cerrar">
          <X size={20} />
        </button>
        <span className="station-presence-emblem">
          {tone === 'success' ? <CheckCircle2 size={34} /> : tone === 'error' ? <AlertTriangle size={34} /> : <MapPinCheck size={34} />}
        </span>
        <small><ShieldCheck size={14} /> Confirmación presencial</small>
        <h2>Valida el punto de almacén</h2>
        <p>{message}</p>
        <div className="station-presence-facts">
          <span><strong>Operación</strong><code>{pending.operationId}</code></span>
          <span><strong>Punto autorizado</strong><code>{config.stationId ?? 'Sin configurar'}</code></span>
        </div>
        <button
          className="station-presence-scan"
          type="button"
          disabled={checking || !config.enabled}
          onClick={() => { void validateStation(); }}
        >
          <QrCode size={22} /> {checking ? 'Comprobando…' : 'Escanear QR del mini PC'}
        </button>
        <p className="station-presence-note">
          El código cambia con frecuencia, está firmado digitalmente y no puede sustituirse por un código escrito manualmente.
        </p>
      </section>
    </div>
  );
}
