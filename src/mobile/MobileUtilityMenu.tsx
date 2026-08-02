import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  Cloud,
  Grid3X3,
  HeartPulse,
  LockKeyhole,
  MoreHorizontal,
  Settings2,
  X,
  type LucideIcon,
} from 'lucide-react';

type UtilityAction = {
  id: string;
  label: string;
  detail: string;
  selector: string;
  Icon: LucideIcon;
  managerOnly?: boolean;
};

const actions: UtilityAction[] = [
  {
    id: 'manage',
    label: 'Gestionar',
    detail: 'Técnicos, inventario, usuarios y copias.',
    selector: '.admin-tools-launcher',
    Icon: Settings2,
    managerOnly: true,
  },
  {
    id: 'security',
    label: 'Seguridad y PIN',
    detail: 'Cambiar PIN, autobloqueo y bloquear ahora.',
    selector: '.security-center-trigger',
    Icon: LockKeyhole,
  },
  {
    id: 'cloud',
    label: 'Nube y cuenta',
    detail: 'Conexión, sesión y sincronización central.',
    selector: '.cloud-status-trigger',
    Icon: Cloud,
  },
  {
    id: 'system',
    label: 'Sistema',
    detail: 'Cámara, QR, NFC, PWA y diagnóstico.',
    selector: '.diagnostics-trigger',
    Icon: HeartPulse,
  },
  {
    id: 'ecosystem',
    label: 'Ecosistema IsiVoltPro',
    detail: 'Módulos actuales y hoja de ruta.',
    selector: '.ecosystem-trigger',
    Icon: Grid3X3,
  },
];

const currentRole = () => document.body.dataset.accessRole ?? 'local';

export default function MobileUtilityMenu() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(currentRole);

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();

    const observer = new MutationObserver(() => {
      resolveTarget();
      setRole(currentRole());
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-access-role'],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handleViewport = () => {
      if (window.innerWidth > 760) setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleViewport);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleViewport);
    };
  }, [open]);

  const visibleActions = useMemo(
    () => actions.filter((action) => !action.managerOnly || role !== 'technician'),
    [role],
  );

  const launch = (selector: string) => {
    const source = document.querySelector<HTMLButtonElement>(selector);
    setOpen(false);
    window.setTimeout(() => source?.click(), 70);
  };

  const launcher = target ? createPortal(
    <button
      className="mobile-utility-launcher"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Abrir accesos de IsiVoltPro"
      title="Accesos de IsiVoltPro"
      onClick={() => { setRole(currentRole()); setOpen(true); }}
    >
      <MoreHorizontal size={23} />
      <span>Accesos</span>
    </button>,
    target,
  ) : null;

  return (
    <>
      {launcher}
      {open && createPortal(
        <div
          className="mobile-utility-backdrop"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section className="mobile-utility-panel" role="dialog" aria-modal="true" aria-label="Accesos de IsiVoltPro">
            <header>
              <div>
                <span className="mobile-utility-brand">IZ</span>
                <div><small>ISIVOLTPRO</small><h2>Accesos rápidos</h2></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <div className="mobile-utility-actions">
              {visibleActions.map(({ id, label, detail, selector, Icon }) => (
                <button key={id} type="button" onClick={() => launch(selector)}>
                  <span className={`mobile-utility-icon action-${id}`}><Icon size={21} /></span>
                  <span className="mobile-utility-copy"><strong>{label}</strong><small>{detail}</small></span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>

            <footer>Los accesos secundarios se agrupan aquí para mantener limpia la cabecera del móvil.</footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
