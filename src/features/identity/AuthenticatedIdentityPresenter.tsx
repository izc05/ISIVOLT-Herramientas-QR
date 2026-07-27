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

  document.querySelectorAll<HTMLElement>('.command-hero h1').forEach((heading) => {
    heading.textContent = `${greeting}, ${firstNameFromIdentity(displayName)}`;
  });

  document.querySelectorAll<HTMLElement>('.profile-button span').forEach((badge) => {
    badge.textContent = initialsFromName(displayName);
  });

  document.querySelectorAll<HTMLButtonElement>('.profile-button').forEach((button) => {
    button.setAttribute('aria-label', identity ? `Cuenta de ${displayName}` : 'Abrir cuenta y seguridad');
    button.onclick = () => document.querySelector<HTMLButtonElement>('.security-account-launcher')?.click();
  });

  document.querySelectorAll<HTMLElement>('.professional-user-card').forEach((card) => {
    const title = card.querySelector<HTMLElement>('strong');
    const detail = card.querySelector<HTMLElement>('small');
    if (title) title.textContent = identity?.name ?? 'Cuenta y seguridad';
    if (detail) detail.textContent = identity ? `${roleText} · sesión activa` : 'Perfil, PIN y sesiones';
  });

  document.body.dataset.identityReady = identity ? 'true' : 'false';
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
