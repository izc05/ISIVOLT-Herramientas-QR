import { useEffect } from 'react';
import { getEffectiveTechnicianIdentity } from '../../security/effectiveTechnician';
import { loadAppData } from '../../services/storage';

const findManualTechnicianButton = (consoleElement: HTMLElement) => Array.from(
  consoleElement.querySelectorAll<HTMLButtonElement>('.native-manual-primary'),
).find((button) => (button.textContent ?? '').toLocaleLowerCase('es-ES').includes('elegir técnico')) ?? null;

const setTextElement = (parent: HTMLElement, selector: string, tag: keyof HTMLElementTagNameMap, value: string) => {
  let element = parent.querySelector<HTMLElement>(selector);
  if (!element) {
    element = document.createElement(tag);
    element.className = selector.replace('.', '');
    parent.appendChild(element);
  }
  element.textContent = value;
};

const ensureIdentityBanner = (consoleElement: HTMLElement, technicianId: string) => {
  const technician = loadAppData().technicians.find((item) => item.id === technicianId);
  if (!technician) return;
  let banner = consoleElement.querySelector<HTMLElement>('.authenticated-technician-banner');
  if (!banner) {
    banner = document.createElement('section');
    banner.className = 'authenticated-technician-banner';
    const avatar = document.createElement('span');
    avatar.className = 'authenticated-technician-avatar';
    const copy = document.createElement('div');
    copy.className = 'authenticated-technician-copy';
    banner.append(avatar, copy);
    const progress = consoleElement.querySelector('.native-progress-grid');
    progress?.before(banner);
  }

  const avatar = banner.querySelector<HTMLElement>('.authenticated-technician-avatar');
  const copy = banner.querySelector<HTMLElement>('.authenticated-technician-copy');
  if (!avatar || !copy) return;
  avatar.textContent = technician.name.split(' ').map((part) => part[0]).slice(0, 2).join('');
  setTextElement(copy, '.authenticated-technician-label', 'small', 'Sesión técnica identificada');
  setTextElement(copy, '.authenticated-technician-name', 'strong', technician.name);
  setTextElement(copy, '.authenticated-technician-meta', 'em', `${technician.code} · ${technician.specialty}`);
};

const applyAuthenticatedCopy = (consoleElement: HTMLElement, technicianId: string) => {
  consoleElement.classList.add('authenticated-technician-flow');
  consoleElement.dataset.authenticatedTechnicianId = technicianId;
  ensureIdentityBanner(consoleElement, technicianId);

  const camera = consoleElement.querySelector<HTMLElement>('.native-camera-button strong');
  const nfc = consoleElement.querySelector<HTMLElement>('.native-nfc-button strong');
  const manual = consoleElement.querySelector<HTMLElement>('.native-manual-primary strong');
  const subtitle = consoleElement.querySelector<HTMLElement>('.native-scan-header p');
  if (camera && !camera.textContent?.includes('activa')) camera.textContent = 'Escanear herramientas';
  if (nfc && !nfc.textContent?.includes('Leyendo')) nfc.textContent = 'NFC herramienta';
  if (manual) manual.textContent = 'Añadir herramienta manualmente';
  if (subtitle) subtitle.textContent = 'Tu identidad ya está vinculada. Escanea únicamente las herramientas que retiras o devuelves.';
};

export default function AuthenticatedTechnicianBridge() {
  useEffect(() => {
    let frame: number | null = null;

    const synchronizeIdentity = () => {
      frame = null;
      const identity = getEffectiveTechnicianIdentity();
      const consoleElement = document.querySelector<HTMLElement>('.rc33-fast-scan-console');
      if (!consoleElement) return;

      if (!identity) {
        consoleElement.classList.remove('authenticated-technician-flow', 'authenticated-technician-loading');
        consoleElement.querySelector('.authenticated-technician-banner')?.remove();
        delete consoleElement.dataset.authenticatedTechnicianId;
        delete consoleElement.dataset.rc51IdentityRequested;
        return;
      }

      applyAuthenticatedCopy(consoleElement, identity.technicianId);

      const step = Array.from(consoleElement.querySelectorAll<HTMLElement>('.native-progress-grid strong'))
        .find((item) => (item.textContent ?? '').toLocaleLowerCase('es-ES').includes('identificar técnico'));
      if (!step) {
        consoleElement.classList.remove('authenticated-technician-loading');
        return;
      }

      consoleElement.classList.add('authenticated-technician-loading');
      if (consoleElement.dataset.rc51IdentityRequested === identity.technicianId) return;
      const button = findManualTechnicianButton(consoleElement);
      if (!button || button.disabled) return;

      consoleElement.dataset.rc51IdentityRequested = identity.technicianId;
      button.click();
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(synchronizeIdentity);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('isivolt:security-session', schedule);
    window.addEventListener('isivolt:central-account-changed', schedule);
    window.addEventListener('isivolt:data-updated', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:security-session', schedule);
      window.removeEventListener('isivolt:central-account-changed', schedule);
      window.removeEventListener('isivolt:data-updated', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
