import { useEffect, useState } from 'react';
import { AlertTriangle, Bug, ShieldCheck, Trash2, X } from 'lucide-react';
import AppV6 from './AppV6';
import { APP_VERSION } from './config/app';
import type { IntegrityIssue } from './services/dataIntegrity';
import {
  clearAppErrorLog,
  getAppErrorLog,
  installGlobalErrorLogging,
  type AppErrorEntry,
} from './services/errorLog';

export default function AppStable() {
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [errors, setErrors] = useState<AppErrorEntry[]>(() => getAppErrorLog());

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

  return (
    <>
      <AppV6 />

      <button
        className="stability-badge"
        type="button"
        onClick={() => {
          setErrors(getAppErrorLog());
          setDiagnosticsOpen(true);
        }}
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
          <section className="diagnostics-panel" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><Bug size={22} /><span><small>Soporte local</small><strong>Diagnóstico v{APP_VERSION}</strong></span></div>
              <button type="button" onClick={() => setDiagnosticsOpen(false)}><X size={20} /></button>
            </header>

            <p>Este registro permanece únicamente en el dispositivo y ayuda a localizar fallos de cámara, SQLite o archivos.</p>

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
