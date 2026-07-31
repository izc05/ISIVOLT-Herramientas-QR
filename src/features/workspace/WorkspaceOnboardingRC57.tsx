import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Circle,
  Radio,
  ScanLine,
  Sparkles,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import type { AppData } from '../../domain/types';
import { getCurrentSecurityUser } from '../../security/session';
import { loadAppData } from '../../services/storage';

const DISMISS_KEY = 'isivolt:rc57-onboarding-dismissed';

const triggerClick = (selector: string) => {
  document.querySelector<HTMLButtonElement>(selector)?.click();
};

export default function WorkspaceOnboardingRC57() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [role, setRole] = useState(() => getCurrentSecurityUser()?.role ?? null);
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    const refreshData = (event?: Event) => {
      const detail = (event as CustomEvent<AppData> | undefined)?.detail;
      setData(detail ?? loadAppData());
      if (window.localStorage.getItem(DISMISS_KEY) !== '1') setDismissed(false);
    };
    const refreshRole = () => setRole(getCurrentSecurityUser()?.role ?? null);

    window.addEventListener('isivolt:data-updated', refreshData);
    window.addEventListener('isivolt:management-refresh', refreshData);
    window.addEventListener('isivolt:app-refresh', refreshData);
    window.addEventListener('isivolt:security-session', refreshRole);
    window.addEventListener('isivolt:central-account-changed', refreshRole);
    return () => {
      window.removeEventListener('isivolt:data-updated', refreshData);
      window.removeEventListener('isivolt:management-refresh', refreshData);
      window.removeEventListener('isivolt:app-refresh', refreshData);
      window.removeEventListener('isivolt:security-session', refreshRole);
      window.removeEventListener('isivolt:central-account-changed', refreshRole);
    };
  }, []);

  const progress = useMemo(() => {
    const technicianReady = data.technicians.some((item) => item.active);
    const toolReady = data.tools.some((item) => item.active !== false && item.status !== 'retired');
    const firstMovementReady = data.movements.length > 0;
    return { technicianReady, toolReady, firstMovementReady };
  }, [data]);

  const allowed = role === 'admin' || role === 'warehouse';
  const completed = progress.technicianReady && progress.toolReady && progress.firstMovementReady;
  if (!allowed || dismissed || completed) return null;

  const currentStep = !progress.technicianReady
    ? 'technician'
    : !progress.toolReady
      ? 'tool'
      : 'movement';

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const primaryAction = () => {
    if (currentStep === 'technician') {
      window.dispatchEvent(new CustomEvent('isivolt:technician-create-open'));
      return;
    }
    if (currentStep === 'tool') {
      window.dispatchEvent(new CustomEvent('isivolt:management-open', {
        detail: { tab: 'tools', create: 'tool' },
      }));
      return;
    }
    triggerClick('.nav-scan-button, .scan-main-button');
  };

  const primaryCopy = currentStep === 'technician'
    ? 'Crear primer técnico'
    : currentStep === 'tool'
      ? 'Registrar herramienta'
      : 'Registrar primer movimiento';

  return (
    <aside className="workspace-onboarding" aria-label="Guía de configuración inicial">
      <header>
        <span><Sparkles size={20} /></span>
        <div>
          <small>Inicio guiado</small>
          <strong>Prepara Herramientas QR</strong>
          <p>Tres pasos para dejar el almacén operativo con datos reales.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Ocultar guía"><X size={18} /></button>
      </header>

      <div className="workspace-onboarding-steps">
        <article className={progress.technicianReady ? 'done' : currentStep === 'technician' ? 'active' : ''}>
          <span>{progress.technicianReady ? <Check size={17} /> : <UserPlus size={17} />}</span>
          <div><strong>1. Técnico</strong><small>Responsable y categoría</small></div>
        </article>
        <article className={progress.toolReady ? 'done' : currentStep === 'tool' ? 'active' : ''}>
          <span>{progress.toolReady ? <Check size={17} /> : <Wrench size={17} />}</span>
          <div><strong>2. Herramienta</strong><small>Ficha, ubicación y QR</small></div>
        </article>
        <article className={progress.firstMovementReady ? 'done' : currentStep === 'movement' ? 'active' : ''}>
          <span>{progress.firstMovementReady ? <Check size={17} /> : <ScanLine size={17} />}</span>
          <div><strong>3. Movimiento</strong><small>Entrega o devolución</small></div>
        </article>
      </div>

      <div className="workspace-onboarding-progress" aria-label="Progreso de configuración">
        {[progress.technicianReady, progress.toolReady, progress.firstMovementReady].map((ready, index) => (
          ready ? <Check size={13} key={index} /> : <Circle size={11} key={index} />
        ))}
        <span>{[progress.technicianReady, progress.toolReady, progress.firstMovementReady].filter(Boolean).length}/3 completados</span>
      </div>

      <footer>
        {progress.toolReady && (
          <button type="button" className="secondary" onClick={() => triggerClick('.nfc-management-launcher')}>
            <Radio size={17} /> Vincular NFC
          </button>
        )}
        <button type="button" className="primary" onClick={primaryAction}>
          {primaryCopy} <ArrowRight size={17} />
        </button>
      </footer>
    </aside>
  );
}
