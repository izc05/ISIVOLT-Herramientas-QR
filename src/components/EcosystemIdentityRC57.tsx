import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, ChevronRight, Grid3X3 } from 'lucide-react';

const readCurrentView = () => {
  const activeNavigation = document.querySelector<HTMLElement>(
    '.core-bottom-nav > button.active span, .core-bottom-nav > button.nav-active span',
  );
  if (activeNavigation?.textContent?.trim()) return activeNavigation.textContent.trim();

  const brandDetail = document.querySelector<HTMLElement>('.brand-button small')?.textContent ?? '';
  return brandDetail.split('·').at(-1)?.trim() || 'Inicio';
};

export default function EcosystemIdentityRC57() {
  const [topbarTarget, setTopbarTarget] = useState<HTMLElement | null>(null);
  const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(null);
  const [currentView, setCurrentView] = useState('Inicio');

  useEffect(() => {
    let frame: number | null = null;

    const synchronize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setTopbarTarget(document.querySelector<HTMLElement>('.core-topbar'));
        setSidebarTarget(document.querySelector<HTMLElement>('.professional-brand'));
        setCurrentView(readCurrentView());
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    synchronize();

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {topbarTarget && createPortal(
        <section className="ivp-ecosystem-context" aria-label="Contexto del ecosistema IsiVoltPro">
          <span className="ivp-ecosystem-icon"><Grid3X3 size={17} /></span>
          <span className="ivp-ecosystem-brand"><small>Ecosistema</small><strong>IsiVoltPro</strong></span>
          <ChevronRight className="ivp-ecosystem-chevron" size={15} />
          <span className="ivp-ecosystem-module"><small>Módulo</small><strong>Herramientas</strong></span>
          <span className="ivp-ecosystem-technology">QR/NFC</span>
          <span className="ivp-ecosystem-view">{currentView}</span>
          <span className="ivp-ecosystem-release" title="Versión publicada">RC57 · WEB</span>
        </section>,
        topbarTarget,
      )}

      {sidebarTarget && createPortal(
        <section className="ivp-sidebar-module" aria-label="Módulo activo de IsiVoltPro">
          <span><Boxes size={18} /></span>
          <div>
            <small>Módulo activo · RC57</small>
            <strong>Herramientas</strong>
            <p>Inventario · trazabilidad · QR/NFC</p>
          </div>
        </section>,
        sidebarTarget,
      )}
    </>
  );
}
