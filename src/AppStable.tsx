import { useEffect, useState } from 'react';
import { AlertTriangle, Bug, Database, ShieldCheck, Trash2, X } from 'lucide-react';
import AppV6 from './AppV6';
import { APP_VERSION } from './config/app';
import MovementHistoryCenter from './features/history/MovementHistoryCenter';
import ManagementCenter from './features/management/ManagementCenter';
import ManagementFiles from './features/management/ManagementFiles';
import NativeBackController from './features/navigation/NativeBackController';
import GreetingSettings from './features/personalization/GreetingSettings';
import TechnicianBarcodeCenter from './features/technicians/TechnicianBarcodeCenter';
import TechnicianQuickCreate from './features/technicians/TechnicianQuickCreate';
import TechnicianVisualEnhancer from './features/technicians/TechnicianVisualEnhancer';
import type { IntegrityIssue } from './services/dataIntegrity';
import {
  clearAppErrorLog,
  getAppErrorLog,
  installGlobalErrorLogging,
  recordAppError,
  type AppErrorEntry,
} from './services/errorLog';
import {
  getNativeDatabaseHealth,
  type NativeDatabaseHealth,
} from './services/nativeDatabase';

export default function AppStable() {
  const [appRevision, setAppRevision] = useState(0);
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [errors, setErrors] = useState<AppErrorEntry[]>(() => getAppErrorLog());
  const [databaseHealth, setDatabaseHealth] = useState<NativeDatabaseHealth | null>(null);
  const [databaseChecking, setDatabaseChecking] = useState(false);

  useEffect(() => installGlobalErrorLogging(), []);

  useEffect(() => {
    const onIntegrityWarning = (event: Event) => {
      setIntegrityIssues((event as CustomEvent<IntegrityIssue[]>).detail ?? []);
    };
    const onErrorRecorded = () => setErrors(getAppErrorLog());

    window.addEventListener('isivolt:integrity-warning', onIntegrityWarning);
    window.addEventListener('isivolt:error-recorded', onErrorRecorded);
    return () => {
      window.removeEventListener('isivolt:integrity-warning', onIntegrityWarning);
      window.removeEventListener('isivolt:error-recorded', onErrorRecorded);
    };
  }, []);

  const refreshApplication = () => setAppRevision((value) => value + 1);

  const openDiagnostics = async () => {
    setErrors(getAppErrorLog());
    setDiagnosticsOpen(true);
    setDatabaseChecking(true);
    try {
      setDatabaseHealth(await getNativeDatabaseHealth());
    } catch (error) {
      recordAppError('database.health', error);
      setDatabaseHealth(null);
    } finally {
      setDatabaseChecking(false);
    }
  };

  return (
    <>
      <AppV6 key={appRevision} />
      <NativeBackController />
      <TechnicianVisualEnhancer />
      <GreetingSettings />
      <MovementHistoryCenter />
      <ManagementCenter onSaved={refreshApplication} />
      <ManagementFiles />
      <TechnicianQuickCreate onSaved={refreshApplication} />
      <TechnicianBarcodeCenter />

      <button
        className="stability-badge"
        type="button"
        onClick={() => { void openDiagnostics(); }}
        aria-label="Abrir diagnóstico de la aplicación"
      >
        <ShieldCheck size={15} /> v{APP_VERSION}
        {errors.length > 0 && <span>{errors.length}</span>}
      </button>

      {integrityIssues.length > 0 && (
        <aside className="integrity-warning" role="alert">
          <AlertTriangle size={21} />
          <div>
            <strong>Cambio rechazado para proteger los datos</strong>
            <span>{integrityIssues[0].message}</span>
            {integrityIssues.length > 1 && <small>Hay {integrityIssues.length - 1} advertencia(s) adicional(es).</small>}
          </div>
          <button type="button" onClick={() => setIntegrityIssues([])} aria-label="Cerrar aviso"><X size={18} /></button>
        </aside>
      )}

      {diagnosticsOpen && (
        <div className="diagnostics-backdrop" onClick={() => setDiagnosticsOpen(false)}>
          <section className="diagnostics-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <header>
              <div><Bug size={22} /><span><small>Soporte local</small><strong>Diagnóstico v{APP_VERSION}</strong></span></div>
              <button type="button" onClick={() => setDiagnosticsOpen(false)}><X size={20} /></button>
            </header>

            <p>Este registro permanece únicamente en el dispositivo y ayuda a localizar fallos de cámara, SQLite o archivos.</p>

            <section className="database-health-card">
              <div><Database size={22} /><span><small>Persistencia nativa</small><strong>SQLite normalizado</strong></span></div>
              {databaseChecking ? (
                <span className="database-health-loading">Comprobando…</span>
              ) : databaseHealth ? (
                <div className="database-health-grid">
                  <span><small>Esquema</small><strong>v{databaseHealth.schemaVersion}</strong></span>
                  <span><small>Herramientas</small><strong>{databaseHealth.tools}</strong></span>
                  <span><small>Técnicos</small><strong>{databaseHealth.technicians}</strong></span>
                  <span><small>Movimientos</small><strong>{databaseHealth.movements}</strong></span>
                  <span><small>Accesorios</small><strong>{databaseHealth.accessories}</strong></span>
                  <span><small>Mantenimiento</small><strong>{databaseHealth.maintenanceRecords}</strong></span>
                </div>
              ) : (
                <span className="database-health-web">Modo web · almacenamiento del navegador</span>
              )}
            </section>

            <div className="diagnostics-list">
              {errors.length === 0 ? (
                <div className="diagnostics-empty"><ShieldCheck size={28} /><strong>Sin errores registrados</strong></div>
              ) : errors.slice(0, 20).map((entry) => (
                <article key={entry.id}>
                  <strong>{entry.source}</strong>
                  <span>{entry.message}</span>
                  <time>{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(entry.occurredAt))}</time>
                </article>
              ))}
            </div>

            <footer>
              <span>{errors.length} registro{errors.length === 1 ? '' : 's'} local{errors.length === 1 ? '' : 'es'}</span>
              <button
                type="button"
                disabled={errors.length === 0}
                onClick={() => {
                  clearAppErrorLog();
                  setErrors([]);
                }}
              >
                <Trash2 size={17} /> Limpiar registro
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
