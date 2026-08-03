import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Cloud,
  Grid3X3,
  HeartPulse,
  LockKeyhole,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  CLOUD_PROFILE_EVENT,
  getCloudProfile,
  type CloudProfile,
} from '../cloud/config';

type HeaderAction = {
  id: string;
  label: string;
  detail: string;
  selector: string;
  Icon: LucideIcon;
};

const actions: HeaderAction[] = [
  {
    id: 'system',
    label: 'Sistema',
    detail: 'Cámara, QR, NFC, instalación y diagnóstico.',
    selector: '.diagnostics-trigger',
    Icon: HeartPulse,
  },
  {
    id: 'ecosystem',
    label: 'Ecosistema',
    detail: 'Módulos IsiVoltPro y hoja de ruta.',
    selector: '.ecosystem-trigger',
    Icon: Grid3X3,
  },
  {
    id: 'security',
    label: 'Seguridad',
    detail: 'PIN, autobloqueo y bloqueo inmediato.',
    selector: '.security-center-trigger',
    Icon: LockKeyhole,
  },
  {
    id: 'account',
    label: 'Cuenta y nube',
    detail: 'Servidor, sincronización, perfil y sesión.',
    selector: '.cloud-status-trigger',
    Icon: Cloud,
  },
];

const roleLabel = (role: string | undefined) => {
  if (role === 'admin') return 'Administrador';
  if (role === 'coordinator') return 'Coordinador';
  if (role === 'technician') return 'Técnico';
  return 'Espacio local';
};

export default function DesktopUtilityMenu() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [role, setRole] = useState(() => document.body.dataset.accessRole ?? 'local');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const resolve = () => {
      setTarget(document.querySelector('.topbar-actions'));
      setRole(document.body.dataset.accessRole ?? 'local');
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-access-role'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleProfile = (event: Event) => {
      setProfile((event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile());
    };
    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    return () => window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const identity = useMemo(() => ({
    name: profile?.displayName ?? 'IsiVoltPro',
    detail: profile?.email ?? roleLabel(role),
  }), [profile, role]);

  const launch = (selector: string) => {
    setOpen(false);
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(selector)?.click(), 60);
  };

  if (!target) return null;

  return createPortal(
    <div className="desktop-utility-menu" ref={wrapperRef}>
      <button
        className="desktop-utility-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>Más</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <section className="desktop-utility-popover" role="menu" aria-label="Más accesos IsiVoltPro">
          <header>
            <span className="isivolt-monogram">I</span>
            <div><strong>{identity.name}</strong><small>{identity.detail}</small></div>
          </header>

          <div className="desktop-utility-actions">
            {actions.map(({ id, label, detail, selector, Icon }) => (
              <button key={id} type="button" role="menuitem" onClick={() => launch(selector)}>
                <span className={`desktop-utility-icon action-${id}`}><Icon size={19} /></span>
                <span><strong>{label}</strong><small>{detail}</small></span>
              </button>
            ))}
          </div>

          <footer><UserRound size={15} /> {roleLabel(profile?.role ?? role)}</footer>
        </section>
      )}
    </div>,
    target,
  );
}
