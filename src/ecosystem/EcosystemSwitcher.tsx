import { useEffect, useState } from 'react';
import { AppWindow, Check, ChevronRight, LockKeyhole, X } from 'lucide-react';
import { activeEcosystemModule, ecosystemModules, type EcosystemModule } from './modules';

export const ECOSYSTEM_OPEN_EVENT = 'isivoltpro:ecosystem-open';

const statusLabel: Record<EcosystemModule['status'], string> = {
  active: 'En uso',
  next: 'Siguiente',
  planned: 'Planificado',
};

export default function EcosystemSwitcher() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const ActiveModuleIcon = activeEcosystemModule.icon;

  useEffect(() => {
    document.documentElement.dataset.isivoltEcosystem = 'true';
    document.documentElement.dataset.isivoltModule = activeEcosystemModule.id;
    return () => {
      delete document.documentElement.dataset.isivoltEcosystem;
      delete document.documentElement.dataset.isivoltModule;
    };
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setMessage('');
      setOpen(true);
    };
    window.addEventListener(ECOSYSTEM_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(ECOSYSTEM_OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open]);

  const chooseModule = (module: EcosystemModule) => {
    if (module.status === 'active') {
      setMessage('Ya estás trabajando en Herramientas · QR/NFC.');
      return;
    }
    setMessage(`${module.name} está preparado en la hoja de ruta del ecosistema.`);
  };

  if (!open) return null;

  return (
    <>
      <button className="ecosystem-backdrop" type="button" aria-label="Cerrar selector" onClick={() => setOpen(false)} />
      <section className="ecosystem-panel" role="dialog" aria-modal="true" aria-label="Aplicaciones de IsiVoltPro">
        <header className="ecosystem-panel-header">
          <div className="ecosystem-brand-lockup">
            <span className="ecosystem-brand-mark">ϟ</span>
            <div>
              <strong>IsiVolt<span>Pro</span></strong>
              <small>Ecosistema técnico de mantenimiento</small>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="ecosystem-current">
          <span className="ecosystem-current-icon"><ActiveModuleIcon size={23} /></span>
          <div>
            <small>MÓDULO ACTIVO</small>
            <strong>{activeEcosystemModule.name}</strong>
            <p>{activeEcosystemModule.description}</p>
          </div>
          <span className="ecosystem-current-check"><Check size={17} /></span>
        </div>

        <div className="ecosystem-section-heading">
          <div>
            <strong>Aplicaciones IsiVoltPro</strong>
            <small>Una identidad y una navegación compartidas</small>
          </div>
          <AppWindow size={19} />
        </div>

        <div className="ecosystem-module-grid">
          {ecosystemModules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                type="button"
                className={`ecosystem-module-card accent-${module.accent} ${module.status === 'active' ? 'is-active' : ''}`}
                onClick={() => chooseModule(module)}
              >
                <span className="ecosystem-module-icon"><Icon size={21} /></span>
                <span className="ecosystem-module-copy">
                  <strong>{module.shortName}</strong>
                  <small>{module.description}</small>
                </span>
                <span className={`ecosystem-status status-${module.status}`}>
                  {module.status === 'planned' && <LockKeyhole size={11} />}
                  {statusLabel[module.status]}
                </span>
                <ChevronRight className="ecosystem-module-arrow" size={16} />
              </button>
            );
          })}
        </div>

        {message && <p className="ecosystem-message" role="status">{message}</p>}

        <footer className="ecosystem-panel-footer">
          <span />
          <p><strong>Base común:</strong> marca, color, navegación, formularios, estados y accesibilidad.</p>
        </footer>
      </section>
    </>
  );
}
