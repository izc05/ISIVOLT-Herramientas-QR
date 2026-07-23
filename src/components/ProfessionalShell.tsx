import { useEffect, useState } from 'react';
import {
  Barcode,
  Boxes,
  ChevronRight,
  CircleUserRound,
  FileSpreadsheet,
  Files,
  Hammer,
  History,
  Home,
  MoreHorizontal,
  Radio,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Tags,
  Users,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';

type ProfessionalRoute = 'dashboard' | 'inventory' | 'technicians' | 'history';

type SyncCopy = {
  title: string;
  detail: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('es-ES');

export const resolveProfessionalRoute = (label: string): ProfessionalRoute | null => {
  const normalized = normalize(label);
  if (normalized.includes('inicio')) return 'dashboard';
  if (normalized.includes('inventario') || normalized.includes('herramientas')) return 'inventory';
  if (normalized.includes('técnicos') || normalized.includes('tecnicos')) return 'technicians';
  if (normalized.includes('historial') || normalized.includes('movimientos')) return 'history';
  return null;
};

const findLegacyNavigationButton = (route: ProfessionalRoute): HTMLButtonElement | null => {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.core-bottom-nav > button'));
  return buttons.find((button) => resolveProfessionalRoute(button.textContent ?? '') === route) ?? null;
};

const readActiveRoute = (): ProfessionalRoute => {
  const active = document.querySelector<HTMLButtonElement>('.core-bottom-nav > button.active, .core-bottom-nav > button.nav-active');
  return resolveProfessionalRoute(active?.textContent ?? '') ?? 'dashboard';
};

const triggerClick = (selector: string) => {
  document.querySelector<HTMLButtonElement>(selector)?.click();
};

const adminActions = [
  { label: 'Gestión', detail: 'Herramientas y técnicos', selector: '.management-launcher', Icon: Settings2 },
  { label: 'Informes', detail: 'Excel y copias de seguridad', selector: '.report-center-launcher', Icon: FileSpreadsheet },
  { label: 'Tarjetas', detail: 'Código de barras personal', selector: '.technician-barcode-launcher', Icon: Barcode },
  { label: 'NFC', detail: 'Tarjetas y etiquetas', selector: '.nfc-management-launcher', Icon: Radio },
  { label: 'Etiquetas QR', detail: 'Impresión y exportación', selector: '.qr-label-launcher', Icon: Tags },
  { label: 'Archivos', detail: 'Informes de gestión', selector: '.management-files-launcher', Icon: Files },
  { label: 'Mantenimiento', detail: 'Actuaciones técnicas', selector: '.maintenance-board-launcher', Icon: Hammer },
  { label: 'Rectificaciones', detail: 'Corregir movimientos', selector: '.rectification-launcher', Icon: History },
  { label: 'Respuesta', detail: 'Sonido y vibración', selector: '.experience-settings-button', Icon: Volume2 },
  { label: 'Diagnóstico', detail: 'Estado local y errores', selector: '.stability-badge', Icon: ShieldCheck },
] as const;

export default function ProfessionalShell() {
  const [route, setRoute] = useState<ProfessionalRoute>('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const [syncCopy, setSyncCopy] = useState<SyncCopy>({
    title: 'Solo local',
    detail: 'Servidor central pendiente',
  });

  useEffect(() => {
    let frame: number | null = null;

    const synchronize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setRoute(readActiveRoute());
        const title = document.querySelector<HTMLElement>('.central-sync-copy strong')?.textContent?.trim();
        const detail = document.querySelector<HTMLElement>('.central-sync-copy small')?.textContent?.trim();
        if (title || detail) {
          setSyncCopy({
            title: title || 'Estado central',
            detail: detail || 'Consulta el estado de sincronización',
          });
        }
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    synchronize();

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('professional-more-open', moreOpen);
    return () => document.body.classList.remove('professional-more-open');
  }, [moreOpen]);

  const navigate = (nextRoute: ProfessionalRoute) => {
    findLegacyNavigationButton(nextRoute)?.click();
    setRoute(nextRoute);
  };

  const launchAdmin = (selector: string) => {
    setMoreOpen(false);
    window.setTimeout(() => triggerClick(selector), 40);
  };

  const navigation = [
    { id: 'dashboard' as const, label: 'Inicio', detail: 'Panel operativo', Icon: Home },
    { id: 'inventory' as const, label: 'Herramientas', detail: 'Inventario y estados', Icon: Boxes },
    { id: 'technicians' as const, label: 'Técnicos', detail: 'Responsables y material', Icon: Users },
    { id: 'history' as const, label: 'Historial', detail: 'Movimientos y auditoría', Icon: History },
  ];

  return (
    <>
      <aside className="professional-sidebar" aria-label="Navegación profesional">
        <header className="professional-brand">
          <span><Wrench size={22} /></span>
          <div><strong>ISIVOLT</strong><small>Herramientas QR</small></div>
        </header>

        <div className="professional-section-label">Menú principal</div>
        <nav className="professional-navigation">
          {navigation.map(({ id, label, detail, Icon }) => (
            <button
              key={id}
              type="button"
              className={route === id ? 'active' : ''}
              onClick={() => navigate(id)}
            >
              <span><Icon size={19} /></span>
              <span><strong>{label}</strong><small>{detail}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
          <button type="button" className="professional-scan" onClick={() => triggerClick('.nav-scan-button, .scan-main-button')}>
            <span><ScanLine size={20} /></span>
            <span><strong>Escanear</strong><small>Técnico y herramientas</small></span>
            <ChevronRight size={16} />
          </button>
        </nav>

        <div className="professional-section-label">Administración</div>
        <nav className="professional-navigation professional-navigation-secondary">
          <button type="button" onClick={() => setMoreOpen(true)}>
            <span><MoreHorizontal size={19} /></span>
            <span><strong>Más</strong><small>Informes y configuración</small></span>
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={() => triggerClick('.demo-reset')}>
            <span><RotateCcw size={19} /></span>
            <span><strong>Restaurar demo</strong><small>Recuperar datos iniciales</small></span>
            <ChevronRight size={16} />
          </button>
        </nav>

        <section className="professional-sync-card">
          <span><ShieldCheck size={19} /></span>
          <div><strong>{syncCopy.title}</strong><small>{syncCopy.detail}</small></div>
        </section>

        <footer className="professional-user-card">
          <span><CircleUserRound size={24} /></span>
          <div><strong>Isi</strong><small>Administrador</small></div>
        </footer>
      </aside>

      <button
        className="professional-mobile-more"
        type="button"
        onClick={() => triggerClick('.mobile-tools-launcher')}
        aria-label="Abrir más opciones"
      >
        <MoreHorizontal size={21} />
        <span>Más</span>
      </button>

      {moreOpen && (
        <div className="professional-more-backdrop" onClick={() => setMoreOpen(false)}>
          <section className="professional-more-panel" role="dialog" aria-modal="true" aria-label="Más opciones" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span><MoreHorizontal size={20} /></span><div><small>Administración</small><h2>Más opciones</h2><p>Accesos agrupados sin botones flotantes.</p></div></div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>
            <div className="professional-more-grid">
              {adminActions.map(({ label, detail, selector, Icon }) => (
                <button type="button" key={label} onClick={() => launchAdmin(selector)}>
                  <span><Icon size={21} /></span>
                  <span><strong>{label}</strong><small>{detail}</small></span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
