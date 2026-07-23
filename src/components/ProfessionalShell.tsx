import { useEffect, useState } from 'react';
import {
  Boxes,
  ChevronRight,
  CircleUserRound,
  History,
  Home,
  MoreHorizontal,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Users,
  Wrench,
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

export default function ProfessionalShell() {
  const [route, setRoute] = useState<ProfessionalRoute>('dashboard');
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

  const navigate = (nextRoute: ProfessionalRoute) => {
    findLegacyNavigationButton(nextRoute)?.click();
    setRoute(nextRoute);
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
          <button type="button" onClick={() => triggerClick('.mobile-tools-launcher')}>
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
    </>
  );
}
