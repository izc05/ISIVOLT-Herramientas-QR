import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  Eraser,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { seedData } from '../../data/seed';
import type { AppData } from '../../domain/types';
import { getCurrentSecurityUser } from '../../security/session';
import { loadAppData, saveAppData } from '../../services/storage';

const LEGACY_DEMO_TOOL_IDS = new Set([
  'tool-fluke-289',
  'tool-hilti-te30',
  'tool-camera',
  'tool-clamp',
  'tool-detector',
  'tool-extension',
]);

const LEGACY_DEMO_TECHNICIAN_IDS = new Set([
  'tech-antonio',
  'tech-marta',
  'tech-carlos',
]);

const LEGACY_DEMO_MOVEMENT_IDS = new Set([
  'mov-001',
  'mov-002',
  'mov-003',
  'mov-004',
]);

const CLEANUP_KEY = 'isivolt:rc57-legacy-demo-cleanup';

const cloneFreshWorkspace = (): AppData => JSON.parse(JSON.stringify(seedData)) as AppData;

const isLegacyDemoWorkspace = (data: AppData) => (
  data.tools.every((item) => LEGACY_DEMO_TOOL_IDS.has(item.id))
  && data.technicians.every((item) => LEGACY_DEMO_TECHNICIAN_IDS.has(item.id))
  && data.movements.every((item) => LEGACY_DEMO_MOVEMENT_IDS.has(item.id))
  && (data.accessories ?? []).length === 0
  && (data.maintenanceRecords ?? []).length === 0
);

const refreshApplication = () => {
  window.dispatchEvent(new CustomEvent('isivolt:management-refresh'));
  window.dispatchEvent(new CustomEvent('isivolt:app-refresh'));
};

export default function WorkspaceResetCenterRC57() {
  const [allowed, setAllowed] = useState(() => getCurrentSecurityUser()?.role === 'admin');
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [completed, setCompleted] = useState(false);
  const [snapshot, setSnapshot] = useState(() => loadAppData());

  useEffect(() => {
    const refreshPermission = () => setAllowed(getCurrentSecurityUser()?.role === 'admin');
    window.addEventListener('isivolt:security-session', refreshPermission);
    window.addEventListener('isivolt:central-account-changed', refreshPermission);
    return () => {
      window.removeEventListener('isivolt:security-session', refreshPermission);
      window.removeEventListener('isivolt:central-account-changed', refreshPermission);
    };
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem(CLEANUP_KEY)) return;
    const current = loadAppData();

    if (isLegacyDemoWorkspace(current)) {
      const hasDemoData = current.tools.length > 0
        || current.technicians.length > 0
        || current.movements.length > 0;
      if (hasDemoData) {
        saveAppData(cloneFreshWorkspace(), { replaceNative: true });
        refreshApplication();
      }
      window.localStorage.setItem(CLEANUP_KEY, 'cleared');
      return;
    }

    window.localStorage.setItem(CLEANUP_KEY, 'protected-non-demo-data');
  }, []);

  useEffect(() => {
    const openReset = () => {
      setSnapshot(loadAppData());
      setPhrase('');
      setCompleted(false);
      setOpen(true);
    };
    window.addEventListener('isivolt:workspace-reset-open', openReset);
    return () => window.removeEventListener('isivolt:workspace-reset-open', openReset);
  }, []);

  const counts = useMemo(() => ({
    tools: snapshot.tools.length,
    technicians: snapshot.technicians.length,
    movements: snapshot.movements.length,
    maintenance: (snapshot.maintenanceRecords ?? []).length,
  }), [snapshot]);

  const clearWorkspace = () => {
    if (phrase.trim().toLocaleUpperCase('es-ES') !== 'VACIAR') return;
    const clean = cloneFreshWorkspace();
    saveAppData(clean, { replaceNative: true });
    window.localStorage.setItem(CLEANUP_KEY, 'manual-clear');
    setSnapshot(clean);
    setPhrase('');
    setCompleted(true);
    refreshApplication();
  };

  if (!allowed) return null;

  return (
    <>
      <button
        className="workspace-reset-launcher"
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('isivolt:workspace-reset-open'))}
        aria-label="Vaciar datos operativos"
      >
        <Eraser size={18} />
      </button>

      {open && (
        <div className="workspace-reset-backdrop" onClick={() => setOpen(false)}>
          <section
            className="workspace-reset-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span><DatabaseZap size={24} /></span>
                <div>
                  <small>Administración protegida</small>
                  <h2 id="workspace-reset-title">Vaciar espacio de trabajo</h2>
                  <p>Prepara la aplicación para registrar desde cero los técnicos y herramientas reales.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
            </header>

            {completed ? (
              <div className="workspace-reset-success">
                <CheckCircle2 size={34} />
                <strong>Espacio de trabajo limpio</strong>
                <span>Ya puedes comenzar las altas reales sin registros de demostración.</span>
              </div>
            ) : (
              <>
                <div className="workspace-reset-summary">
                  <article><strong>{counts.tools}</strong><span>Herramientas</span></article>
                  <article><strong>{counts.technicians}</strong><span>Técnicos</span></article>
                  <article><strong>{counts.movements}</strong><span>Movimientos</span></article>
                  <article><strong>{counts.maintenance}</strong><span>Mantenimientos</span></article>
                </div>

                <div className="workspace-reset-warning">
                  <AlertTriangle size={22} />
                  <div>
                    <strong>Esta acción no se puede deshacer desde la aplicación</strong>
                    <span>Se eliminan inventario, técnicos, movimientos, accesorios y mantenimiento. La cuenta administradora y la configuración de acceso se conservan.</span>
                  </div>
                </div>

                <label className="workspace-reset-confirmation">
                  <span>Escribe <strong>VACIAR</strong> para confirmar</span>
                  <input
                    value={phrase}
                    onChange={(event) => setPhrase(event.target.value)}
                    autoComplete="off"
                    placeholder="VACIAR"
                  />
                </label>
              </>
            )}

            <footer>
              <span><ShieldCheck size={16} /> Solo disponible para administración</span>
              <button type="button" onClick={() => setOpen(false)}>{completed ? 'Cerrar' : 'Cancelar'}</button>
              {!completed && (
                <button
                  type="button"
                  className="danger"
                  disabled={phrase.trim().toLocaleUpperCase('es-ES') !== 'VACIAR'}
                  onClick={clearWorkspace}
                >
                  <Trash2 size={18} /> Vaciar datos
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
