import { useEffect } from 'react';
import { loadAppData } from '../../services/storage';
import { getCurrentSecurityUser } from '../../security/session';

const normalize = (value: string) => value.trim().toLocaleLowerCase('es-ES');

const legacyRouteButton = (route: 'dashboard' | 'inventory' | 'technicians' | 'history') => {
  const matches = {
    dashboard: ['inicio'],
    inventory: ['inventario'],
    technicians: ['técnicos', 'tecnicos'],
    history: ['historial', 'movimientos'],
  }[route];
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.core-bottom-nav > button'))
    .find((button) => matches.some((label) => normalize(button.textContent ?? '').includes(label))) ?? null;
};

const setText = (element: Element | null | undefined, value: string) => {
  if (element) element.textContent = value;
};

const decorateBottomNavigation = (technicianMode: boolean) => {
  const inventory = legacyRouteButton('inventory');
  const technicians = legacyRouteButton('technicians');
  const history = legacyRouteButton('history');
  const inventoryLabel = inventory?.querySelector('span');
  const historyLabel = history?.querySelector('span');

  inventory?.classList.toggle('rc47-technician-nav', technicianMode);
  history?.classList.toggle('rc47-technician-nav', technicianMode);
  technicians?.classList.toggle('rc47-role-hidden', technicianMode);
  setText(inventoryLabel, technicianMode ? 'Mis herramientas' : 'Inventario');
  setText(historyLabel, technicianMode ? 'Mi historial' : 'Historial');
};

const updateStats = (values: Array<{ label: string; value: number; detail: string }>) => {
  document.querySelectorAll<HTMLElement>('.core-stats .stat-card').forEach((card, index) => {
    const next = values[index];
    if (!next) return;
    setText(card.querySelector('strong'), String(next.value));
    setText(card.querySelector('h3'), next.label);
    setText(card.querySelector('p'), next.detail);
  });
};

const updateQuickActions = (technicianMode: boolean) => {
  const panel = document.querySelector<HTMLElement>('.actions-panel');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.quick-actions button')];
  panel?.classList.toggle('rc47-personal-actions', technicianMode);
  setText(panel?.querySelector('.section-heading h2'), technicianMode ? 'Mis acciones rápidas' : 'Acciones rápidas');
  setText(panel?.querySelector('.section-heading .eyebrow'), technicianMode ? 'Espacio personal' : 'Operaciones');

  const content = technicianMode ? [
    ['Retirar herramienta', 'Escanea una herramienta disponible', 'scan'],
    ['Devolver herramienta', 'Registra la entrada y su estado', 'scan'],
    ['Mis herramientas', 'Consulta asignadas y disponibles', 'inventory'],
    ['Mi historial', 'Revisa tus movimientos registrados', 'history'],
  ] : [
    ['Entregar', 'Asignar varias herramientas', ''],
    ['Devolver', 'Comprobar y registrar estado', ''],
    ['Inventario', 'Consultar disponibilidad y ubicación', ''],
    ['Técnicos', 'Ver las especialidades', ''],
  ];

  buttons.forEach((button, index) => {
    const next = content[index];
    if (!next) return;
    setText(button.querySelector('strong'), next[0]);
    setText(button.querySelector('small'), next[1]);
    if (next[2]) button.dataset.rc47Action = next[2];
    else delete button.dataset.rc47Action;
  });
};

const applyWorkspace = () => {
  const user = getCurrentSecurityUser();
  const data = loadAppData();
  const technicianMode = user?.role === 'technician' && Boolean(user.technicianId);
  decorateBottomNavigation(technicianMode);

  document.querySelectorAll<HTMLElement>('.rc47-coordinator-readonly').forEach((element) => element.classList.remove('rc47-coordinator-readonly'));

  if (technicianMode && user?.technicianId) {
    const technician = data.technicians.find((item) => item.id === user.technicianId);
    const ownLoaned = data.tools.filter((tool) => tool.status === 'loaned' && tool.holderTechnicianId === user.technicianId);
    const ownMovements = data.movements.filter((movement) => movement.technicianId === user.technicianId);
    const ownIncidents = ownMovements.filter((movement) => movement.type === 'incident').length;
    const available = data.tools.filter((tool) => tool.status === 'available').length;

    setText(document.querySelector('.command-hero .eyebrow'), 'Área personal de herramientas');
    setText(document.querySelector('.command-hero .hero-date'), `${technician?.name ?? user.name} · ${ownLoaned.length} herramienta${ownLoaned.length === 1 ? '' : 's'} en tu poder`);
    setText(document.querySelector('.scan-main-button strong'), 'Escanear herramienta');
    setText(document.querySelector('.scan-main-button small'), 'Retira o devuelve con tu cuenta');
    updateStats([
      { label: 'Disponibles', value: available, detail: 'Herramientas que puedes retirar' },
      { label: 'En mi poder', value: ownLoaned.length, detail: 'Asignadas a tu cuenta' },
      { label: 'Mis incidencias', value: ownIncidents, detail: 'Entradas que requieren revisión' },
      { label: 'Mis movimientos', value: ownMovements.length, detail: 'Historial personal registrado' },
    ]);
    updateQuickActions(true);

    const pageHeading = document.querySelector<HTMLElement>('.page-heading');
    const currentTitle = pageHeading?.querySelector('h1')?.textContent ?? '';
    if (/inventario/i.test(currentTitle)) setText(pageHeading?.querySelector('h1'), 'Mis herramientas');
    if (/historial|movimientos/i.test(currentTitle)) setText(pageHeading?.querySelector('h1'), 'Mi historial');
    return;
  }

  const generalStats = [
    { label: 'Disponibles', value: data.tools.filter((tool) => tool.status === 'available').length, detail: 'Actualización automática' },
    { label: 'Prestadas', value: data.tools.filter((tool) => tool.status === 'loaned').length, detail: 'Asignadas a técnicos' },
    { label: 'Requieren atención', value: data.tools.filter((tool) => tool.status === 'review' || tool.status === 'damaged').length, detail: 'Actualización automática' },
    { label: 'Técnicos activos', value: data.technicians.filter((technician) => technician.active).length, detail: 'Directorio hospitalario' },
  ];
  updateStats(generalStats);
  updateQuickActions(false);

  if (user?.role === 'coordinator') {
    document.querySelector('.actions-panel')?.classList.add('rc47-coordinator-readonly');
    setText(document.querySelector('.command-hero .eyebrow'), 'Panel de consulta y seguimiento');
    setText(document.querySelector('.scan-main-button strong'), 'Perfil de consulta');
    setText(document.querySelector('.scan-main-button small'), 'Sin permisos para registrar movimientos');
  } else {
    setText(document.querySelector('.command-hero .eyebrow'), 'Centro de control operativo');
    setText(document.querySelector('.scan-main-button strong'), 'Escanear QR');
    setText(document.querySelector('.scan-main-button small'), 'Inicia una entrega o devolución');
  }
};

export default function RoleWorkspacePresenter() {
  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyWorkspace();
      });
    };

    const interceptPersonalAction = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-rc47-action]');
      const user = getCurrentSecurityUser();
      if (!button || user?.role !== 'technician') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const action = button.dataset.rc47Action;
      if (action === 'scan') document.querySelector<HTMLButtonElement>('.scan-main-button, .nav-scan-button')?.click();
      if (action === 'inventory') legacyRouteButton('inventory')?.click();
      if (action === 'history') legacyRouteButton('history')?.click();
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', interceptPersonalAction, true);
    window.addEventListener('isivolt:security-session', schedule);
    window.addEventListener('isivolt:central-account-changed', schedule);
    window.addEventListener('isivolt:data-updated', schedule);
    schedule();

    return () => {
      observer.disconnect();
      document.removeEventListener('click', interceptPersonalAction, true);
      window.removeEventListener('isivolt:security-session', schedule);
      window.removeEventListener('isivolt:central-account-changed', schedule);
      window.removeEventListener('isivolt:data-updated', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
