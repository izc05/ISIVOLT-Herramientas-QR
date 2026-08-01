import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BriefcaseBusiness,
  History,
  Home,
  PackageCheck,
  ScanLine,
  Users,
  X,
} from 'lucide-react';
import { CLOUD_PROFILE_EVENT, getCloudProfile, type CloudProfile } from '../cloud/config';
import { SCAN_SESSION_EVENT } from '../scan/ScanSession';
import { OPEN_MY_MATERIAL_EVENT } from '../technician/MyMaterial';
import type { BatchOperation } from '../types';

const viewButtonByLabel: Record<string, string> = {
  Inicio: 'dashboard',
  Herramientas: 'tools',
  Técnicos: 'technicians',
  Movimientos: 'movements',
};

function activateView(label: string) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.sidebar nav button')];
  buttons.find((button) => button.querySelector('span')?.textContent?.trim() === label)?.click();
}

function advanceFastSession() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('.scan-session-footer button.primary')?.click();
    });
  });
}

export default function MobileFastScan() {
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [profile, setProfile] = useState<CloudProfile | null>(() => getCloudProfile());

  useEffect(() => {
    setReady(true);

    const syncView = () => {
      const label = document.querySelector<HTMLButtonElement>('.sidebar nav button.active span')?.textContent?.trim() ?? 'Inicio';
      setActiveView(viewButtonByLabel[label] ?? 'dashboard');
    };
    const syncProfile = (event: Event) => {
      setProfile((event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile());
    };

    syncView();
    const navigation = document.querySelector('.sidebar nav');
    const observer = navigation ? new MutationObserver(syncView) : null;
    observer?.observe(navigation as Node, { attributes: true, subtree: true, attributeFilter: ['class'] });
    window.addEventListener(CLOUD_PROFILE_EVENT, syncProfile);

    return () => {
      observer?.disconnect();
      window.removeEventListener(CLOUD_PROFILE_EVENT, syncProfile);
    };
  }, []);

  const selfServiceTechnicianId = profile?.role === 'technician' ? profile.technicianExternalId : undefined;

  const startFastOperation = (operation: BatchOperation) => {
    setSheetOpen(false);
    if (selfServiceTechnicianId) {
      window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT, {
        detail: {
          operation,
          mode: 'self-service',
          technicianId: selfServiceTechnicianId,
          identificationMethod: 'authenticated',
          startAt: 'items',
        },
      }));
      return;
    }

    window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT, {
      detail: { operation, mode: 'administrator' },
    }));
    advanceFastSession();
  };

  if (!ready) return null;

  return createPortal(
    <>
      <nav className="mobile-action-dock" aria-label="Navegación móvil">
        <button type="button" className={activeView === 'dashboard' ? 'active' : ''} onClick={() => activateView('Inicio')}>
          <Home size={20} />
          <span>Inicio</span>
        </button>
        <button type="button" className={activeView === 'tools' ? 'active' : ''} onClick={() => activateView('Herramientas')}>
          <BriefcaseBusiness size={20} />
          <span>Material</span>
        </button>
        <button className="mobile-scan-button" type="button" onClick={() => setSheetOpen(true)} aria-label="Abrir escaneo rápido">
          <span><ScanLine size={27} /></span>
          <strong>Escanear</strong>
        </button>
        {selfServiceTechnicianId ? (
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_MY_MATERIAL_EVENT))}>
            <PackageCheck size={20} />
            <span>Mi material</span>
          </button>
        ) : (
          <button type="button" className={activeView === 'technicians' ? 'active' : ''} onClick={() => activateView('Técnicos')}>
            <Users size={20} />
            <span>Técnicos</span>
          </button>
        )}
        <button type="button" className={activeView === 'movements' ? 'active' : ''} onClick={() => activateView('Movimientos')}>
          <History size={20} />
          <span>Historial</span>
        </button>
      </nav>

      {sheetOpen && (
        <div className="mobile-scan-sheet-backdrop" role="presentation" onMouseDown={() => setSheetOpen(false)}>
          <section className="mobile-scan-sheet" role="dialog" aria-modal="true" aria-label="Escaneo rápido" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>{selfServiceTechnicianId ? 'AUTOSERVICIO' : 'OPERACIÓN RÁPIDA'}</small>
                <h2>¿Qué vas a registrar?</h2>
                <p>{selfServiceTechnicianId
                  ? 'Tu cuenta ya está identificada. Pasarás directamente a escanear los artículos.'
                  : 'Después identificarás al técnico y escanearás todo el material.'}</p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>
            <div className="mobile-scan-options">
              <button type="button" onClick={() => startFastOperation('loan')}>
                <span><ArrowUpFromLine size={27} /></span>
                <div><strong>{selfServiceTechnicianId ? 'Recoger material' : 'Prestar material'}</strong><small>Registrar una salida</small></div>
              </button>
              <button type="button" onClick={() => startFastOperation('return')}>
                <span><ArrowDownToLine size={27} /></span>
                <div><strong>Devolver material</strong><small>Registrar una entrada</small></div>
              </button>
            </div>
          </section>
        </div>
      )}
    </>,
    document.body,
  );
}
