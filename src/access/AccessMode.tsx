import { useEffect } from 'react';
import { CLOUD_PROFILE_EVENT, getCloudProfile, type CloudProfile } from '../cloud/config';

const applyRole = (profile: CloudProfile | null) => {
  const role = profile?.role ?? 'local-admin';
  document.body.dataset.accessRole = role;

  if (role !== 'technician') return;

  const activeNavigation = document.querySelector<HTMLButtonElement>('.sidebar nav button.active');
  const activeLabel = activeNavigation?.querySelector('span')?.textContent?.trim();
  if (activeLabel === 'Técnicos') {
    const home = [...document.querySelectorAll<HTMLButtonElement>('.sidebar nav > button')]
      .find((button) => button.querySelector('span')?.textContent?.trim() === 'Inicio');
    home?.click();
  }

  document.querySelector<HTMLButtonElement>('.admin-tools-panel > header > button')?.click();
  const openModal = document.querySelector<HTMLButtonElement>('.modal-header .icon-button');
  if (openModal) openModal.click();
};

export default function AccessMode() {
  useEffect(() => {
    applyRole(getCloudProfile());
    const handleProfile = (event: Event) => {
      applyRole((event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile());
    };
    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    return () => {
      window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
      delete document.body.dataset.accessRole;
    };
  }, []);

  return null;
}
