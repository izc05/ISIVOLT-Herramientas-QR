import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const MODAL_SELECTORS = [
  '.operation-celebration',
  '.native-tool-alert-backdrop',
  '.native-scan-backdrop',
  '.advanced-history-backdrop',
  '.technician-barcode-backdrop',
  '.greeting-settings-backdrop',
  '.management-editor-backdrop',
  '.management-backdrop',
  '.management-files-backdrop',
  '.maintenance-board-backdrop',
  '.diagnostics-backdrop',
  '.tool-photo-backdrop',
  '.technician-detail-backdrop',
  '.tool-detail-backdrop',
  '.report-backdrop',
  '.rectification-backdrop',
  '.commissioning-backdrop',
  '.experience-settings-backdrop',
  '.modal-backdrop',
] as const;

const isVisible = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && Number(style.opacity || '1') > 0
    && element.getBoundingClientRect().height > 0;
};

const findTopModal = () => {
  const candidates = MODAL_SELECTORS.flatMap((selector) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)),
  ).filter(isVisible);

  return candidates.sort((a, b) => {
    const aZ = Number(window.getComputedStyle(a).zIndex || 0);
    const bZ = Number(window.getComputedStyle(b).zIndex || 0);
    return bZ - aZ;
  })[0];
};

const closeTopModal = () => {
  const modal = findTopModal();
  if (!modal) return false;

  const closeButton = modal.querySelector<HTMLButtonElement>([
    'button[aria-label="Cerrar"]',
    'button[aria-label*="Cerrar"]',
    '.native-scan-close',
    '.tool-photo-close',
    '.experience-settings-close',
    '.technician-detail-close',
    '.modal-close',
  ].join(','));

  if (closeButton && !closeButton.disabled) {
    closeButton.click();
    return true;
  }

  modal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};

const activeNavigationLabel = () => {
  const active = document.querySelector<HTMLElement>('.bottom-nav button.active, .core-bottom-nav button.active, .game-bottom-nav button.active');
  return active?.textContent?.trim().toLocaleLowerCase('es-ES') ?? '';
};

const goHome = () => {
  if (activeNavigationLabel().includes('inicio')) return false;
  const home = Array.from(document.querySelectorAll<HTMLButtonElement>('.bottom-nav button, .core-bottom-nav button, .game-bottom-nav button'))
    .find((button) => button.textContent?.trim().toLocaleLowerCase('es-ES').includes('inicio'));
  if (!home) return false;
  home.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
};

export default function NativeBackController() {
  const [exitWarning, setExitWarning] = useState(false);
  const lastBackAt = useRef(0);
  const ignoreNextPop = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const pushGuard = () => {
      window.history.pushState({ isivoltBackGuard: true }, '', window.location.href);
    };

    pushGuard();

    const onPopState = () => {
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        return;
      }

      if (closeTopModal()) {
        pushGuard();
        return;
      }

      if (goHome()) {
        pushGuard();
        return;
      }

      const now = Date.now();
      if (now - lastBackAt.current > 1_800) {
        lastBackAt.current = now;
        setExitWarning(true);
        window.setTimeout(() => setExitWarning(false), 1_800);
        pushGuard();
        navigator.vibrate?.(70);
        return;
      }

      setExitWarning(false);
      ignoreNextPop.current = true;
      window.history.back();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!exitWarning) return null;

  return (
    <aside className="native-back-exit-warning" role="status">
      <span><ArrowLeft size={20} /></span>
      <div><strong>Pulsa Atrás otra vez para salir</strong><small>La primera pulsación protege la navegación.</small></div>
      <LogOut size={19} />
    </aside>
  );
}
