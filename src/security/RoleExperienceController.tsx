import { useEffect, useMemo, useState } from 'react';
import { Eye, ShieldCheck, UserRound, Warehouse } from 'lucide-react';
import { loadAppData } from '../services/storage';
import { hasPermission } from './permissions';
import { getCurrentSecurityUser } from './session';
import type { SecurityUser, UserRole } from './types';

const roleMeta: Record<UserRole, { label: string; detail: string; icon: typeof ShieldCheck }> = {
  admin: { label: 'Administrador', detail: 'Control completo, seguridad y auditoría', icon: ShieldCheck },
  warehouse: { label: 'Responsable de almacén', detail: 'Operaciones, inventario y mantenimiento', icon: Warehouse },
  coordinator: { label: 'Coordinador', detail: 'Consulta, filtros, historial e informes', icon: Eye },
  technician: { label: 'Técnico', detail: 'Préstamos y devoluciones con identidad propia', icon: UserRound },
};

const showRoleToast = (title: string, detail: string) => {
  document.querySelector('.role-access-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'role-access-toast';
  toast.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add('visible'), 10);
  window.setTimeout(() => {
    toast.classList.remove('visible');
    window.setTimeout(() => toast.remove(), 220);
  }, 3_200);
};

const linkedTechnicianFor = (user: SecurityUser | null) => {
  if (!user?.active || user.role !== 'technician' || !user.technicianId) return null;
  return loadAppData().technicians.find((technician) => technician.id === user.technicianId && technician.active) ?? null;
};

const toolCodeFromCard = (card: Element) => card.querySelector('.tool-code')?.textContent?.trim() ?? '';

export default function RoleExperienceController() {
  const [revision, setRevision] = useState(0);
  const user = useMemo(() => getCurrentSecurityUser(), [revision]);
  const linkedTechnician = useMemo(() => linkedTechnicianFor(user), [user, revision]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('isivolt:security-session', refresh);
    window.addEventListener('isivolt:data-updated', refresh);
    window.addEventListener('isivolt:management-refresh', refresh);
    return () => {
      window.removeEventListener('isivolt:security-session', refresh);
      window.removeEventListener('isivolt:data-updated', refresh);
      window.removeEventListener('isivolt:management-refresh', refresh);
    };
  }, []);

  useEffect(() => {
    const handleScanIntent = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const scanButton = target?.closest('.nav-scan-button, .scan-main-button');
      if (!scanButton) return;

      const currentUser = getCurrentSecurityUser();
      if (!hasPermission('operations.execute', currentUser)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showRoleToast('Perfil de consulta', 'El coordinador puede consultar y exportar, pero no registrar movimientos.');
        return;
      }

      if (currentUser?.role === 'technician' && !linkedTechnicianFor(currentUser)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showRoleToast('Falta la vinculación', 'Un administrador debe vincular tu usuario a una ficha técnica activa.');
      }
    };

    document.addEventListener('click', handleScanIntent, true);
    return () => document.removeEventListener('click', handleScanIntent, true);
  }, []);

  useEffect(() => {
    let frame: number | null = null;
    const applyScope = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const currentUser = getCurrentSecurityUser();
        const data = loadAppData();
        const linked = linkedTechnicianFor(currentUser);

        document.querySelectorAll<HTMLElement>('.role-scope-hidden').forEach((element) => {
          element.classList.remove('role-scope-hidden');
        });

        if (currentUser?.role === 'technician' && linked) {
          document.querySelectorAll<HTMLElement>('.tool-card').forEach((card) => {
            const code = toolCodeFromCard(card);
            const tool = data.tools.find((item) => item.code === code);
            if (tool?.status === 'loaned' && tool.holderTechnicianId !== linked.id) {
              card.classList.add('role-scope-hidden');
            }
          });

          document.querySelectorAll<HTMLElement>('.technician-card').forEach((card) => {
            const name = card.querySelector('h3')?.textContent?.trim();
            if (name && name !== linked.name) card.classList.add('role-scope-hidden');
          });

          document.querySelectorAll<HTMLElement>('.movement').forEach((movement) => {
            const operation = movement.querySelector('.movement-main span')?.textContent ?? '';
            if (!operation.includes(linked.name)) movement.classList.add('role-scope-hidden');
          });

          const console = document.querySelector<HTMLElement>('.rc33-fast-scan-console');
          const firstStep = console?.querySelector<HTMLElement>('.native-progress-grid article:first-child');
          const alreadyLinked = firstStep?.classList.contains('completed')
            && firstStep.textContent?.includes(linked.name);
          if (console && !alreadyLinked) {
            const selector = console.querySelector<HTMLElement>('.technician-selector-panel');
            if (selector) {
              const ownButton = [...selector.querySelectorAll<HTMLButtonElement>('.technician-selector-results button')]
                .find((button) => button.textContent?.includes(linked.code));
              ownButton?.click();
            } else {
              console.querySelector<HTMLButtonElement>('.native-manual-primary')?.click();
            }
          }
        }
      });
    };

    const observer = new MutationObserver(applyScope);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('isivolt:security-session', applyScope);
    window.addEventListener('isivolt:data-updated', applyScope);
    applyScope();
    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:security-session', applyScope);
      window.removeEventListener('isivolt:data-updated', applyScope);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!user) return null;
  const meta = roleMeta[user.role];
  const Icon = meta.icon;
  const detail = user.role === 'technician' && linkedTechnician
    ? `${linkedTechnician.name} · ${linkedTechnician.code}`
    : meta.detail;

  return (
    <aside className={`role-scope-bar role-${user.role}`} aria-label={`Perfil activo: ${meta.label}`}>
      <span><Icon size={18} /></span>
      <div><strong>{meta.label}</strong><small>{detail}</small></div>
    </aside>
  );
}
