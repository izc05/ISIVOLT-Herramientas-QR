import { useEffect } from 'react';
import { getCentralSyncClient } from '../../services/centralSync/client';
import { getCurrentSecurityUser } from '../../security/session';

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  warehouse: 'Responsable de almacén',
  coordinator: 'Coordinador',
  technician: 'Técnico',
};

const greetingForHour = (hour: number) => {
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
};

const initialsFromName = (value: string) => value
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toLocaleUpperCase('es-ES') ?? '')
  .join('') || 'IS';

const firstNameFromIdentity = (value: string) => {
  const name = value.trim().split(/\s+/)[0] ?? '';
  if (!name || name.includes('@')) return 'técnico';
  return name;
};

const setText = (element: HTMLElement | null, value: string) => {
  if (element && element.textContent !== value) element.textContent = value;
};

const resolveIdentity = () => {
  const client = getCentralSyncClient();
  const remote = client?.authStore.isValid ? client.authStore.record : null;
  const local = getCurrentSecurityUser();
  const remoteName = String(remote?.name ?? remote?.email ?? '').trim();

  if (remoteName) {
    const role = String(remote?.role ?? 'technician');
    return { name: remoteName, role, roleText: roleLabel[role] ?? role };
  }
  if (local) {
    return { name: local.name, role: local.role, roleText: roleLabel[local.role] ?? local.role };
  }
  return null;
};

const presentIdentity = () => {
  const identity = resolveIdentity();
  const displayName = identity?.name ?? 'Isi';
  const roleText = identity?.roleText ?? 'Cuenta y seguridad';
  const greeting = greetingForHour(new Date().getHours());
  const greetingText = `${greeting}, ${firstNameFromIdentity(displayName)}`;
  const initials = initialsFromName(displayName);

  document.querySelectorAll<HTMLElement>('.command-hero h1').forEach((heading) => {
    setText(heading, greetingText);
  });

  document.querySelectorAll<HTMLElement>('.profile-button span').forEach((badge) => {
    setText(badge, initials);
  });

  document.querySelectorAll<HTMLButtonElement>('.profile-button').forEach((button) => {
    const label = identity ? `Cuenta de ${displayName}` : 'Abrir cuenta y seguridad';
    if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
    button.onclick = () => document.querySelector<HTMLButtonElement>('.security-account-launcher')?.click();
  });

  document.querySelectorAll<HTMLElement>('.professional-user-card').forEach((card) => {
    setText(card.querySelector<HTMLElement>('strong'), identity?.name ?? 'Cuenta y seguridad');
    setText(card.querySelector<HTMLElement>('small'), identity ? `${roleText} · sesión activa` : 'Perfil, PIN y sesiones');
  });

  const ready = identity ? 'true' : 'false';
  if (document.body.dataset.identityReady !== ready) document.body.dataset.identityReady = ready;
};

export default function AuthenticatedIdentityPresenter() {
  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        presentIdentity();
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    const client = getCentralSyncClient();
    const unsubscribeRemote = client?.authStore.onChange(schedule, true);

    window.addEventListener('isivolt:security-session', schedule);
    window.addEventListener('isivolt:central-account-changed', schedule);
    window.addEventListener('isivolt:data-updated', schedule);
    window.addEventListener('focus', schedule);
    schedule();

    return () => {
      observer.disconnect();
      unsubscribeRemote?.();
      window.removeEventListener('isivolt:security-session', schedule);
      window.removeEventListener('isivolt:central-account-changed', schedule);
      window.removeEventListener('isivolt:data-updated', schedule);
      window.removeEventListener('focus', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
