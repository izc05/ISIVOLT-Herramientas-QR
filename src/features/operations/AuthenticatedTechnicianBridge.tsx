import { useEffect } from 'react';
import { getEffectiveTechnicianId } from '../../security/effectiveTechnician';

const findManualTechnicianButton = (consoleElement: HTMLElement) => Array.from(
  consoleElement.querySelectorAll<HTMLButtonElement>('.native-manual-primary'),
).find((button) => (button.textContent ?? '').toLocaleLowerCase('es-ES').includes('elegir técnico')) ?? null;

export default function AuthenticatedTechnicianBridge() {
  useEffect(() => {
    let frame: number | null = null;

    const tryAutomaticIdentity = () => {
      frame = null;
      const technicianId = getEffectiveTechnicianId();
      if (!technicianId) return;

      const consoleElement = document.querySelector<HTMLElement>('.rc33-fast-scan-console');
      if (!consoleElement || consoleElement.dataset.rc43IdentityRequested === technicianId) return;

      const step = Array.from(consoleElement.querySelectorAll<HTMLElement>('.native-progress-grid strong'))
        .find((item) => (item.textContent ?? '').toLocaleLowerCase('es-ES').includes('identificar técnico'));
      if (!step) return;

      const button = findManualTechnicianButton(consoleElement);
      if (!button || button.disabled) return;

      consoleElement.dataset.rc43IdentityRequested = technicianId;
      button.click();
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(tryAutomaticIdentity);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('isivolt:security-session', schedule);
    window.addEventListener('isivolt:central-account-changed', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:security-session', schedule);
      window.removeEventListener('isivolt:central-account-changed', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
