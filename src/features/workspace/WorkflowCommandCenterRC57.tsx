import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Command,
  Plus,
  QrCode,
  Radio,
  Search,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { AppData } from '../../domain/types';
import { getCurrentSecurityUser } from '../../security/session';
import type { UserRole } from '../../security/types';
import { loadAppData } from '../../services/storage';

const findButtonByCopy = (selector: string, copy: string) => (
  Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .find((button) => button.textContent?.toLocaleLowerCase('es-ES').includes(copy.toLocaleLowerCase('es-ES')))
);

const retryAction = (
  resolve: () => HTMLElement | null | undefined,
  action: (target: HTMLElement) => void,
  attempts = 12,
) => {
  const target = resolve();
  if (target) {
    action(target);
    return;
  }
  if (attempts <= 1) return;
  window.setTimeout(() => retryAction(resolve, action, attempts - 1), 75);
};

const openLegacyRoute = (copy: string) => {
  retryAction(
    () => findButtonByCopy('.core-bottom-nav > button', copy),
    (button) => button.click(),
  );
};

const openToolCreation = () => {
  openLegacyRoute('Inventario');
  retryAction(
    () => findButtonByCopy('.page-section .page-heading button', 'Nueva herramienta'),
    (button) => button.click(),
  );
};

const openOperation = (mode: 'delivery' | 'return') => {
  retryAction(
    () => document.querySelector<HTMLButtonElement>('.nav-scan-button, .scan-main-button'),
    (button) => button.click(),
  );
  if (mode === 'delivery') return;
  retryAction(
    () => findButtonByCopy('.native-mode-switch button', 'Devolución'),
    (button) => button.click(),
  );
};

const focusGlobalSearch = () => {
  openLegacyRoute('Inventario');
  retryAction(
    () => document.querySelector<HTMLInputElement>('.header-search input'),
    (input) => {
      input.focus();
      input.select();
    },
  );
};

const clickSelector = (selector: string) => {
  retryAction(
    () => document.querySelector<HTMLButtonElement>(selector),
    (button) => button.click(),
  );
};

export default function WorkflowCommandCenterRC57() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [role, setRole] = useState<UserRole>(() => getCurrentSecurityUser()?.role ?? 'admin');

  useEffect(() => {
    const refreshData = (event?: Event) => {
      const detail = (event as CustomEvent<AppData> | undefined)?.detail;
      setData(detail ?? loadAppData());
    };
    const refreshRole = () => setRole(getCurrentSecurityUser()?.role ?? 'admin');

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

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const metrics = useMemo(() => ({
    tools: data.tools.filter((tool) => tool.status !== 'retired').length,
    available: data.tools.filter((tool) => tool.status === 'available').length,
    loaned: data.tools.filter((tool) => tool.status === 'loaned').length,
    technicians: data.technicians.filter((technician) => technician.active).length,
  }), [data]);

  const allowed = role === 'admin' || role === 'warehouse';
  if (!allowed) return null;

  const run = (action: () => void) => {
    setOpen(false);
    window.setTimeout(action, 40);
  };

  return (
    <>
      <button
        type="button"
        className="workflow-command-launcher"
        onClick={() => setOpen(true)}
        aria-label="Abrir acciones rápidas"
        aria-expanded={open}
      >
        <span><Command size={19} /></span>
        <strong>Acciones</strong>
        <small>{metrics.loaned} fuera</small>
      </button>

      {open && (
        <div className="workflow-command-backdrop" onClick={() => setOpen(false)}>
          <section
            className="workflow-command-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-command-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span><Command size={23} /></span>
                <div>
                  <small>Flujo operativo</small>
                  <h2 id="workflow-command-title">¿Qué necesitas hacer?</h2>
                  <p>Accede directamente a las tareas habituales sin recorrer menús.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <div className="workflow-command-metrics" aria-label="Resumen del inventario">
              <article><Boxes size={18} /><span><strong>{metrics.tools}</strong><small>Herramientas</small></span></article>
              <article><Wrench size={18} /><span><strong>{metrics.available}</strong><small>Disponibles</small></span></article>
              <article><ArrowUpFromLine size={18} /><span><strong>{metrics.loaned}</strong><small>Prestadas</small></span></article>
              <article><Users size={18} /><span><strong>{metrics.technicians}</strong><small>Técnicos</small></span></article>
            </div>

            <div className="workflow-command-primary">
              <button type="button" className="delivery" onClick={() => run(() => openOperation('delivery'))}>
                <span><ArrowUpFromLine size={23} /></span>
                <div><strong>Entregar</strong><small>Préstamo por QR, NFC o búsqueda</small></div>
              </button>
              <button type="button" className="return" onClick={() => run(() => openOperation('return'))}>
                <span><ArrowDownToLine size={23} /></span>
                <div><strong>Devolver</strong><small>Entrada, estado y accesorios</small></div>
              </button>
              <button type="button" onClick={() => run(openToolCreation)}>
                <span><Plus size={23} /></span>
                <div><strong>Nueva herramienta</strong><small>Ficha, ubicación y código QR</small></div>
              </button>
              <button type="button" onClick={() => run(() => window.dispatchEvent(new CustomEvent('isivolt:technician-create-open')))}>
                <span><UserPlus size={23} /></span>
                <div><strong>Nuevo técnico</strong><small>Responsable, categoría y contacto</small></div>
              </button>
            </div>

            <div className="workflow-command-secondary">
              <button type="button" onClick={() => run(focusGlobalSearch)}><Search size={18} /> Buscar</button>
              <button type="button" onClick={() => run(() => clickSelector('.qr-label-launcher'))}><QrCode size={18} /> Etiquetas QR</button>
              <button type="button" onClick={() => run(() => clickSelector('.nfc-management-launcher'))}><Radio size={18} /> Vincular NFC</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
