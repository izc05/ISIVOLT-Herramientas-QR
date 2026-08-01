import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { PWA_UPDATE_EVENT } from './registerServiceWorker';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleUpdate = (event: Event) => {
      setUpdateRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
      setDismissed(false);
    };
    window.addEventListener('beforeinstallprompt', handleInstall);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  };

  const update = () => {
    updateRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  };

  if (dismissed || (!updateRegistration && (!installPrompt || standalone))) return null;

  return (
    <aside className="pwa-prompt" role="status">
      <span>{updateRegistration ? <RefreshCw size={20} /> : <Download size={20} />}</span>
      <div>
        <strong>{updateRegistration ? 'Nueva versión disponible' : 'Instalar IsiVoltPro'}</strong>
        <small>{updateRegistration ? 'Actualiza para cargar las últimas mejoras.' : 'Ábrela como una aplicación desde el móvil o el ordenador.'}</small>
      </div>
      <button type="button" className="pwa-primary" onClick={updateRegistration ? update : install}>
        {updateRegistration ? 'Actualizar' : 'Instalar'}
      </button>
      <button type="button" className="pwa-close" onClick={() => setDismissed(true)} aria-label="Cerrar aviso"><X size={17} /></button>
    </aside>
  );
}
