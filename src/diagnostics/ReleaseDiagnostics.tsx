import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  CheckCircle2,
  Clipboard,
  Cloud,
  Database,
  HardDrive,
  HeartPulse,
  LoaderCircle,
  Nfc,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getPocketBaseUrl } from '../cloud/config';

const VERSION = '2.0.0-alpha.5.8';

type CheckState = 'ok' | 'warning' | 'unavailable' | 'neutral';

type DeviceCheck = {
  id: string;
  label: string;
  detail: string;
  state: CheckState;
  Icon: LucideIcon;
  required?: boolean;
};

type StorageInfo = {
  usage?: number;
  quota?: number;
  persisted?: boolean;
};

const formatBytes = (value?: number) => {
  if (!value || value < 1) return 'Sin datos';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(amount >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const canUseLocalStorage = () => {
  try {
    const key = 'isivoltpro:diagnostics';
    localStorage.setItem(key, 'ok');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const isStandalone = () => {
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
};

export default function ReleaseDiagnostics() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [storage, setStorage] = useState<StorageInfo>({});
  const [cameraResult, setCameraResult] = useState('');
  const [cameraTesting, setCameraTesting] = useState(false);
  const [serverResult, setServerResult] = useState('');
  const [serverTesting, setServerTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const readStorage = async () => {
      const manager = navigator.storage;
      if (!manager) return;
      try {
        const estimate = await manager.estimate();
        const persisted = manager.persisted ? await manager.persisted() : undefined;
        setStorage({ usage: estimate.usage, quota: estimate.quota, persisted });
      } catch {
        setStorage({});
      }
    };
    void readStorage();

    return () => {
      observer.disconnect();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pocketBaseUrl = getPocketBaseUrl();
  const secure = window.isSecureContext;
  const cameraApi = Boolean(navigator.mediaDevices?.getUserMedia);
  const barcodeApi = 'BarcodeDetector' in window;
  const nfcApi = 'NDEFReader' in window;
  const serviceWorker = 'serviceWorker' in navigator;
  const localStorageReady = canUseLocalStorage();
  const installed = isStandalone();

  const checks = useMemo<DeviceCheck[]>(() => [
    {
      id: 'secure',
      label: 'Conexión segura',
      detail: secure ? 'HTTPS activo; cámara y funciones protegidas disponibles.' : 'Se necesita HTTPS para cámara, NFC y PWA.',
      state: secure ? 'ok' : 'unavailable',
      Icon: ShieldCheck,
      required: true,
    },
    {
      id: 'online',
      label: 'Conexión de red',
      detail: online ? 'El dispositivo está conectado.' : 'Modo offline; se utilizará la caché local.',
      state: online ? 'ok' : 'warning',
      Icon: online ? Wifi : WifiOff,
    },
    {
      id: 'camera',
      label: 'Cámara',
      detail: cameraApi ? (barcodeApi ? 'Cámara y detector QR nativo disponibles.' : 'Cámara disponible; lectura QR mediante compatibilidad web.') : 'El navegador no expone acceso a la cámara.',
      state: cameraApi && secure ? 'ok' : 'unavailable',
      Icon: Camera,
      required: true,
    },
    {
      id: 'nfc',
      label: 'NFC web',
      detail: nfcApi ? 'Web NFC disponible en este dispositivo.' : 'No disponible; QR y entrada manual siguen funcionando.',
      state: nfcApi ? 'ok' : 'neutral',
      Icon: Nfc,
    },
    {
      id: 'pwa',
      label: 'Aplicación instalable',
      detail: installed ? 'IsiVoltPro se está ejecutando como aplicación instalada.' : serviceWorker ? 'Compatible; puede instalarse desde el navegador.' : 'Service Worker no disponible en este navegador.',
      state: serviceWorker ? 'ok' : 'unavailable',
      Icon: Smartphone,
      required: true,
    },
    {
      id: 'storage',
      label: 'Almacenamiento local',
      detail: localStorageReady
        ? `${formatBytes(storage.usage)} utilizados de ${formatBytes(storage.quota)}${storage.persisted === true ? ' · persistente' : ''}.`
        : 'No se pueden guardar datos en este navegador.',
      state: localStorageReady ? 'ok' : 'unavailable',
      Icon: HardDrive,
      required: true,
    },
    {
      id: 'server',
      label: 'Servidor central',
      detail: pocketBaseUrl ? `Configurado: ${pocketBaseUrl}` : 'Pendiente de configurar PocketBase; la aplicación trabaja en modo local.',
      state: pocketBaseUrl ? 'ok' : 'neutral',
      Icon: Cloud,
    },
  ], [barcodeApi, cameraApi, installed, localStorageReady, nfcApi, online, pocketBaseUrl, secure, serviceWorker, storage]);

  const blocking = checks.filter((check) => check.required && check.state === 'unavailable');
  const ready = blocking.length === 0;

  const testCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraResult('La cámara no está disponible en este navegador.');
      return;
    }
    setCameraTesting(true);
    setCameraResult('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      setCameraResult('Cámara autorizada y preparada para escanear.');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      setCameraResult(name === 'NotAllowedError' ? 'Permiso de cámara denegado.' : 'No se ha podido abrir la cámara.');
    } finally {
      setCameraTesting(false);
    }
  };

  const testServer = async () => {
    if (!pocketBaseUrl) {
      setServerResult('PocketBase todavía no está configurado.');
      return;
    }
    setServerTesting(true);
    setServerResult('');
    try {
      const response = await fetch(`${pocketBaseUrl}/api/health`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setServerResult('PocketBase responde correctamente.');
    } catch {
      setServerResult('No se ha podido contactar con PocketBase desde este dispositivo.');
    } finally {
      setServerTesting(false);
    }
  };

  const copyReport = async () => {
    const report = {
      application: 'IsiVoltPro Herramientas',
      version: VERSION,
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      standalone: installed,
      checks: checks.map(({ id, label, detail, state, required }) => ({ id, label, detail, state, required: Boolean(required) })),
      cameraTest: cameraResult || null,
      serverTest: serverResult || null,
    };
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  if (!target) return null;

  return (
    <>
      {createPortal(
        <button className={`diagnostics-trigger ${ready ? 'ready' : 'attention'}`} type="button" onClick={() => setOpen(true)} title="Diagnóstico del dispositivo" aria-label="Abrir diagnóstico del dispositivo">
          <HeartPulse size={18} />
          <span>{ready ? 'Sistema' : 'Revisar'}</span>
        </button>,
        target,
      )}

      {open && createPortal(
        <div className="diagnostics-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="diagnostics-panel" role="dialog" aria-modal="true" aria-label="Diagnóstico IsiVoltPro">
            <header>
              <div><span><HeartPulse size={23} /></span><div><small>ISIVOLTPRO · {VERSION}</small><h2>Diagnóstico del dispositivo</h2><p>Comprueba que el móvil u ordenador está preparado antes de utilizarlo.</p></div></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <div className={`diagnostics-summary ${ready ? 'ready' : 'attention'}`}>
              {ready ? <CheckCircle2 size={25} /> : <TriangleAlert size={25} />}
              <div><strong>{ready ? 'Dispositivo preparado' : `${blocking.length} requisito${blocking.length === 1 ? '' : 's'} por revisar`}</strong><p>{ready ? 'Las funciones esenciales están disponibles.' : blocking.map((check) => check.label).join(' · ')}</p></div>
            </div>

            <div className="diagnostics-grid">
              {checks.map(({ id, label, detail, state, Icon }) => (
                <article className={`diagnostic-card state-${state}`} key={id}>
                  <span><Icon size={20} /></span>
                  <div><strong>{label}</strong><p>{detail}</p></div>
                  <i>{state === 'ok' ? 'Correcto' : state === 'warning' ? 'Offline' : state === 'unavailable' ? 'No disponible' : 'Opcional'}</i>
                </article>
              ))}
            </div>

            <section className="diagnostics-tests">
              <article>
                <div><Camera size={20} /><span><strong>Prueba de cámara</strong><p>Solicita permiso, abre la cámara y la cierra inmediatamente.</p></span></div>
                <button type="button" disabled={cameraTesting || !cameraApi} onClick={() => void testCamera()}>{cameraTesting ? <LoaderCircle className="diagnostics-spin" size={17} /> : <RefreshCw size={17} />} Probar</button>
                {cameraResult && <small>{cameraResult}</small>}
              </article>
              <article>
                <div><Database size={20} /><span><strong>Prueba de PocketBase</strong><p>No inicia sesión ni modifica datos; consulta únicamente el estado del servidor.</p></span></div>
                <button type="button" disabled={serverTesting || !pocketBaseUrl} onClick={() => void testServer()}>{serverTesting ? <LoaderCircle className="diagnostics-spin" size={17} /> : <RefreshCw size={17} />} Probar</button>
                {serverResult && <small>{serverResult}</small>}
              </article>
            </section>

            <footer>
              <p>El NFC web es opcional: cuando no esté disponible se puede trabajar con QR, lector externo o código manual.</p>
              <button type="button" onClick={() => void copyReport()}><Clipboard size={17} /> {copied ? 'Informe copiado' : 'Copiar informe'}</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
