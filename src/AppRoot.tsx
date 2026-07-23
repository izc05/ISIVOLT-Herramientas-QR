import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Database, Globe2, LoaderCircle, RefreshCcw, ShieldCheck } from 'lucide-react';
import AppStable from './AppStable';
import BootErrorBoundary from './BootErrorBoundary';
import MobileToolsMenu from './components/MobileToolsMenu';
import InventoryOperationalEnhancer from './features/inventory/InventoryOperationalEnhancer';
import MaintenanceBoard from './features/management/MaintenanceBoard';
import NfcManagementCenter from './features/nfc/NfcManagementCenter';
import CommissioningCenter from './production/CommissioningCenter';
import RectificationCenter from './security/RectificationCenter';
import SecurityController from './security/SecurityController';
import { recordAppError } from './services/errorLog';
import { hydrateAppDataFromNative } from './services/storage';
import { installModalStateObserver } from './ui/modalState';

type BootState = 'loading' | 'ready' | 'degraded';

const timeout = (milliseconds: number) => new Promise<never>((_, reject) => {
  window.setTimeout(() => reject(new Error(`SQLite no respondió en ${milliseconds / 1000} segundos.`)), milliseconds);
});

export default function AppRoot() {
  const isWebMode = !Capacitor.isNativePlatform();
  const [bootState, setBootState] = useState<BootState>(() => {
    if (isWebMode) return 'ready';
    return window.sessionStorage.getItem('isivolt:skip-native-hydration') === '1' ? 'degraded' : 'loading';
  });
  const [bootMessage, setBootMessage] = useState('Preparando la base de datos local…');

  useEffect(() => installModalStateObserver(), []);

  useEffect(() => {
    if (isWebMode || bootState !== 'loading') return;
    let active = true;

    void Promise.race([
      hydrateAppDataFromNative(),
      timeout(7_000),
    ]).then(() => {
      if (!active) return;
      window.sessionStorage.removeItem('isivolt:skip-native-hydration');
      setBootState('ready');
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : 'No se ha podido abrir SQLite.';
      recordAppError('boot.sqlite-timeout', message);
      setBootMessage(message);
      setBootState('degraded');
    });

    return () => { active = false; };
  }, [bootState, isWebMode]);

  const retryNative = () => {
    window.sessionStorage.removeItem('isivolt:skip-native-hydration');
    setBootMessage('Reintentando la conexión con SQLite…');
    setBootState('loading');
  };

  return (
    <BootErrorBoundary>
      <SecurityController />

      {bootState === 'loading' ? (
        <main className="boot-screen">
          <section>
            <span><LoaderCircle className="boot-spin" size={38} /></span>
            <small>ISIVOLT Herramientas QR</small>
            <h1>Iniciando aplicación</h1>
            <p>{bootMessage}</p>
            <button type="button" onClick={() => {
              window.sessionStorage.setItem('isivolt:skip-native-hydration', '1');
              setBootState('degraded');
            }}>
              <Database size={18} /> Continuar en modo local
            </button>
          </section>
        </main>
      ) : (
        <>
          {isWebMode && (
            <aside className="web-mode-banner" aria-label="Aplicación ejecutándose en modo web">
              <Globe2 size={18} />
              <div>
                <strong>Modo web RC30</strong>
                <span>Los datos se guardan en este navegador · sincronización central pendiente</span>
              </div>
            </aside>
          )}
          {bootState === 'degraded' && (
            <aside className="boot-degraded-banner">
              <Database size={18} />
              <div>
                <strong>Modo local de recuperación</strong>
                <span>{bootMessage}</span>
              </div>
              <button type="button" onClick={retryNative}><RefreshCcw size={17} /> Reintentar SQLite</button>
            </aside>
          )}
          <AppStable />
          <InventoryOperationalEnhancer />
          <MaintenanceBoard onSaved={() => window.dispatchEvent(new CustomEvent('isivolt:management-refresh'))} />
          <NfcManagementCenter />
          <RectificationCenter />
          <CommissioningCenter />
          <MobileToolsMenu />
          {!isWebMode && bootState === 'ready' && (
            <span className="boot-ready-marker" aria-label="Arranque protegido completado"><ShieldCheck size={14} /></span>
          )}
        </>
      )}
    </BootErrorBoundary>
  );
}
