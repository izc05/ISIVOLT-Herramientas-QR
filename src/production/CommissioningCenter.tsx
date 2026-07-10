import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  LoaderCircle,
  Play,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  TestTube2,
  X,
  XCircle,
} from 'lucide-react';
import { APP_VERSION } from '../config/app';
import { hasPermission } from '../security/permissions';
import {
  loadCommissioningState,
  resetCommissioningState,
  runAutomaticCommissioningChecks,
  saveCommissioningState,
  type CommissioningAutomaticCheck,
  type CommissioningCheckStatus,
  type CommissioningState,
} from './commissioning';

const statusIcon = (status: CommissioningCheckStatus) => {
  if (status === 'passed') return <CheckCircle2 size={19} />;
  if (status === 'failed') return <XCircle size={19} />;
  return <AlertTriangle size={19} />;
};

const downloadReport = (state: CommissioningState, automatic: CommissioningAutomaticCheck[]) => {
  const passedManual = state.manual.filter((item) => item.status === 'passed').length;
  const failedManual = state.manual.filter((item) => item.status === 'failed').length;
  const pendingManual = state.manual.filter((item) => item.status === 'pending').length;
  const passedAuto = automatic.filter((item) => item.passed).length;
  const lines = [
    `ISIVOLT Herramientas QR ${APP_VERSION}`,
    'Informe de puesta en servicio',
    '',
    `Responsable: ${state.tester || 'Sin indicar'}`,
    `Modelo: ${state.deviceModel || 'Sin indicar'}`,
    `Android: ${state.androidVersion || 'Sin indicar'}`,
    `Inicio: ${state.startedAt}`,
    `Actualización: ${state.updatedAt}`,
    '',
    `Automáticas correctas: ${passedAuto}/${automatic.length}`,
    ...automatic.map((item) => `[${item.passed ? 'OK' : 'FALLO'}] ${item.title}: ${item.detail}`),
    '',
    `Manuales: ${passedManual} correctas · ${failedManual} fallidas · ${pendingManual} pendientes`,
    ...state.manual.map((item) => `[${item.status.toUpperCase()}] ${item.title}: ${item.detail}`),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ISIVOLT_Puesta_en_servicio_${APP_VERSION}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function CommissioningCenter() {
  const [allowed, setAllowed] = useState(() => hasPermission('diagnostics.view'));
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CommissioningState | null>(null);
  const [automatic, setAutomatic] = useState<CommissioningAutomaticCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const refresh = () => setAllowed(hasPermission('diagnostics.view'));
    window.addEventListener('isivolt:security-session', refresh);
    return () => window.removeEventListener('isivolt:security-session', refresh);
  }, []);

  const summary = useMemo(() => {
    if (!state) return { passed: 0, failed: 0, pending: 0 };
    return {
      passed: state.manual.filter((item) => item.status === 'passed').length,
      failed: state.manual.filter((item) => item.status === 'failed').length,
      pending: state.manual.filter((item) => item.status === 'pending').length,
    };
  }, [state]);

  const runChecks = async () => {
    setChecking(true);
    try {
      setAutomatic(await runAutomaticCommissioningChecks());
    } finally {
      setChecking(false);
    }
  };

  const openCenter = async () => {
    const loaded = await loadCommissioningState();
    setState(loaded);
    setOpen(true);
    void runChecks();
  };

  const persist = async (next: CommissioningState) => {
    setSaving(true);
    try {
      setState(await saveCommissioningState(next));
    } finally {
      setSaving(false);
    }
  };

  const updateManual = (id: string, status: CommissioningCheckStatus) => {
    if (!state) return;
    void persist({
      ...state,
      manual: state.manual.map((item) => item.id === id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item),
    });
  };

  if (!allowed) return null;

  return (
    <>
      <motion.button className="commissioning-launcher" onClick={() => { void openCenter(); }} whileTap={{ scale: 0.9 }} aria-label="Abrir puesta en servicio">
        <TestTube2 size={20} />
      </motion.button>

      <AnimatePresence>
        {open && state && (
          <motion.div className="commissioning-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="commissioning-center" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 25, scale: 0.97 }}>
              <header>
                <div><span><TestTube2 size={24} /></span><div><small>Candidata {APP_VERSION}</small><h2>Puesta en servicio</h2><p>{summary.passed} correctas · {summary.failed} fallidas · {summary.pending} pendientes</p></div></div>
                <button onClick={() => setOpen(false)}><X size={22} /></button>
              </header>

              <main>
                <section className="commissioning-device-card">
                  <div className="commissioning-section-title"><Smartphone size={19} /><h3>Datos del dispositivo</h3></div>
                  <div className="commissioning-device-grid">
                    <label>Responsable<input value={state.tester ?? ''} onChange={(event) => setState({ ...state, tester: event.target.value })} onBlur={() => { void persist(state); }} /></label>
                    <label>Modelo de teléfono<input value={state.deviceModel ?? ''} onChange={(event) => setState({ ...state, deviceModel: event.target.value })} onBlur={() => { void persist(state); }} /></label>
                    <label>Versión de Android<input value={state.androidVersion ?? ''} onChange={(event) => setState({ ...state, androidVersion: event.target.value })} onBlur={() => { void persist(state); }} /></label>
                  </div>
                </section>

                <section className="commissioning-section">
                  <div className="commissioning-section-heading"><div><ShieldCheck size={19} /><h3>Comprobaciones automáticas</h3></div><button onClick={() => { void runChecks(); }} disabled={checking}>{checking ? <LoaderCircle className="commissioning-spin" size={17} /> : <Play size={17} />} Ejecutar</button></div>
                  <div className="commissioning-auto-grid">
                    {automatic.map((item) => <article key={item.id} className={item.passed ? 'passed' : 'failed'}><span>{item.passed ? <CheckCircle2 size={20} /> : <XCircle size={20} />}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></article>)}
                    {automatic.length === 0 && <p>Ejecuta el diagnóstico automático para comprobar versión, SQLite, cámara, códigos y usuarios.</p>}
                  </div>
                </section>

                <section className="commissioning-section">
                  <div className="commissioning-section-title"><ClipboardCheck size={19} /><h3>Pruebas manuales</h3></div>
                  <div className="commissioning-manual-list">
                    {state.manual.map((item) => <article key={item.id} className={`status-${item.status}`}><span>{statusIcon(item.status)}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><div className="commissioning-status-actions"><button onClick={() => updateManual(item.id, 'passed')} aria-label="Marcar correcta"><Check size={17} /></button><button onClick={() => updateManual(item.id, 'failed')} aria-label="Marcar fallida"><X size={17} /></button><button onClick={() => updateManual(item.id, 'pending')} aria-label="Marcar pendiente"><RefreshCcw size={16} /></button></div></article>)}
                  </div>
                </section>
              </main>

              <footer>
                <span>{saving ? 'Guardando resultados…' : `Iniciado ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.startedAt))}`}</span>
                <button onClick={() => downloadReport(state, automatic)}><Download size={17} /> Informe</button>
                <button onClick={() => { void resetCommissioningState().then(setState); }}><RefreshCcw size={17} /> Reiniciar</button>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
