import { useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  ClipboardCheck,
  CloudCog,
  FileSpreadsheet,
  Files,
  Hammer,
  History,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TestTube2,
  UserCheck,
  UserCog,
  Users,
  Volume2,
  X,
} from 'lucide-react';
import { getCurrentSecurityUser } from '../security/session';
import type { UserRole } from '../security/types';

type MobileAction = {
  label: string;
  detail: string;
  selector: string;
  Icon: typeof UserCog;
  roles: readonly UserRole[];
};

const actions: MobileAction[] = [
  { label: 'Cuenta y seguridad', detail: 'Perfil, sesiones y acceso', selector: '.security-account-launcher', Icon: UserCog, roles: ['admin', 'warehouse', 'coordinator', 'technician'] },
  { label: 'Solicitudes de acceso', detail: 'Aprobar cuentas nuevas', selector: '.registration-request-manager-launcher', Icon: UserCheck, roles: ['admin'] },
  { label: 'Técnicos y cuentas', detail: 'Editar datos y crear accesos', selector: '.technician-account-manager-launcher', Icon: Users, roles: ['admin'] },
  { label: 'Sincronización', detail: 'Servidor y datos pendientes', selector: '.central-sync-open-button', Icon: CloudCog, roles: ['admin', 'warehouse', 'coordinator', 'technician'] },
  { label: 'Gestión', detail: 'Herramientas, alertas y Excel', selector: '.management-launcher', Icon: SlidersHorizontal, roles: ['admin', 'warehouse'] },
  { label: 'Tarjetas', detail: 'Código de barras personal', selector: '.technician-barcode-launcher', Icon: Barcode, roles: ['admin', 'warehouse', 'technician'] },
  { label: 'NFC', detail: 'Tarjetas y etiquetas NFC', selector: '.nfc-management-launcher', Icon: ScanLine, roles: ['admin', 'warehouse'] },
  { label: 'Informes', detail: 'Excel y copias', selector: '.report-center-launcher', Icon: FileSpreadsheet, roles: ['admin', 'warehouse', 'coordinator'] },
  { label: 'Etiquetas QR', detail: 'Imprimir códigos', selector: '.qr-label-launcher', Icon: Tags, roles: ['admin', 'warehouse'] },
  { label: 'Archivos', detail: 'Informe de gestión', selector: '.management-files-launcher', Icon: Files, roles: ['admin', 'warehouse', 'coordinator'] },
  { label: 'Mantenimiento', detail: 'Actuaciones técnicas', selector: '.maintenance-board-launcher', Icon: Hammer, roles: ['admin', 'warehouse'] },
  { label: 'Rectificaciones', detail: 'Corregir movimientos', selector: '.rectification-launcher', Icon: History, roles: ['admin'] },
  { label: 'Sonido y vibración', detail: 'Respuesta de operaciones', selector: '.experience-settings-button', Icon: Volume2, roles: ['admin', 'warehouse', 'coordinator', 'technician'] },
  { label: 'Diagnóstico', detail: 'SQLite y errores locales', selector: '.stability-badge', Icon: ShieldCheck, roles: ['admin'] },
  { label: 'Pruebas', detail: 'Puesta en servicio', selector: '.commissioning-launcher', Icon: TestTube2, roles: ['admin'] },
];

export default function MobileToolsMenu() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(() => getCurrentSecurityUser()?.role ?? 'admin');
  const visibleActions = useMemo(() => actions.filter((action) => action.roles.includes(role)), [role]);

  useEffect(() => {
    const close = () => {
      setOpen(false);
      setRole(getCurrentSecurityUser()?.role ?? 'admin');
    };
    const closeOnModal = (event: Event) => {
      if ((event as CustomEvent<boolean>).detail) setOpen(false);
    };
    window.addEventListener('isivolt:security-session', close);
    window.addEventListener('isivolt:central-account-changed', close);
    window.addEventListener('isivolt:modal-state', closeOnModal);
    return () => {
      window.removeEventListener('isivolt:security-session', close);
      window.removeEventListener('isivolt:central-account-changed', close);
      window.removeEventListener('isivolt:modal-state', closeOnModal);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('mobile-tools-open', open);
    return () => document.body.classList.remove('mobile-tools-open');
  }, [open]);

  const launch = (selector: string) => {
    setOpen(false);
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(selector);
      target?.click();
    }, 30);
  };

  return (
    <div className={`mobile-tools-menu ${open ? 'open' : ''}`}>
      {open && (
        <div className="mobile-tools-sheet" role="menu" aria-label="Herramientas y cuenta">
          <header><div><ClipboardCheck size={19} /><span><strong>{role === 'technician' ? 'Mi cuenta' : 'Más opciones'}</strong><small>{role === 'technician' ? 'Cuenta, sincronización y preferencias' : 'Cuenta, técnicos y configuración'}</small></span></div><button onClick={() => setOpen(false)} aria-label="Cerrar"><X size={19} /></button></header>
          <div>
            {visibleActions.map(({ label, detail, selector, Icon }) => (
              <button type="button" role="menuitem" key={label} onClick={() => launch(selector)}>
                <span><Icon size={20} /></span>
                <span><strong>{label}</strong><small>{detail}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="mobile-tools-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir más opciones">
        {open ? <X size={22} /> : <SlidersHorizontal size={22} />}
      </button>
    </div>
  );
}
