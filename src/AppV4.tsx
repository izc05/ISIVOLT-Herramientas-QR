import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ListFilter,
  QrCode,
  RotateCcw,
  ScanLine,
  UserRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import AppV3 from './AppV3';
import type {
  AppData,
  Movement,
  OperationMode,
  ReturnCondition,
  Technician,
  Tool,
  ToolStatus,
} from './domain/types';
import TechnicianSelectorPanel from './features/technicians/TechnicianSelectorPanel';
import { assertPermission } from './security/permissions';
import { getCurrentOperatorName } from './security/session';
import {
  isNativeScannerAvailable,
  parseIsivoltQr,
  scanQrCode,
} from './services/barcodeScanner';
import { loadAppData, saveAppData } from './services/storage';

type NativeFeedback = {
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'error';
} | null;

const newId = (prefix: string) => {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
};

const toolStatusLabel: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  damaged: 'Averiada',
  retired: 'Baja',
};

const findTechnician = (data: AppData, code: string) =>
  data.technicians.find((technician) => technician.code.toUpperCase() === code.toUpperCase());

const findTool = (data: AppData, code: string, raw: string) =>
  data.tools.find(
    (tool) => tool.code.toUpperCase() === code.toUpperCase() || tool.qrCode.toUpperCase() === raw.toUpperCase(),
  );

export default function AppV4() {
  const nativeScanner = useMemo(() => isNativeScannerAvailable(), []);
  const reduceMotion = useReducedMotion();
  const compactMotion = reduceMotion || window.matchMedia('(max-width: 820px)').matches;
  const [appRevision, setAppRevision] = useState(0);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [mode, setMode] = useState<OperationMode>('delivery');
  const [sessionData, setSessionData] = useState<AppData>(() => loadAppData());
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [condition, setCondition] = useState<ReturnCondition>('ok');
  const [notes, setNotes] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('Selecciona el tipo de operación y comienza a escanear.');
  const [feedback, setFeedback] = useState<NativeFeedback>(null);

  const resetWorkflow = (nextMode: OperationMode = 'delivery') => {
    setSessionData(loadAppData());
    setMode(nextMode);
    setTechnician(null);
    setTools([]);
    setCondition('ok');
    setNotes('');
    setScanning(false);
    setSelectorOpen(false);
    setScannerMessage(
      nextMode === 'delivery'
        ? 'Primero identifica al técnico responsable.'
        : 'Escanea la primera herramienta que regresa al almacén.',
    );
  };

  const openWorkflow = () => {
    resetWorkflow('delivery');
    setWorkflowOpen(true);
  };

  const closeWorkflow = () => {
    setSelectorOpen(false);
    setWorkflowOpen(false);
  };

  useEffect(() => {
    if (!nativeScanner) return undefined;

    const interceptScannerButtons = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const scannerButton = target?.closest('.nav-scan-button, .scan-main-button');
      if (!scannerButton) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openWorkflow();
    };

    document.addEventListener('click', interceptScannerButtons, true);
    return () => document.removeEventListener('click', interceptScannerButtons, true);
  }, [nativeScanner]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const changeMode = (nextMode: OperationMode) => resetWorkflow(nextMode);

  const selectTechnician = (technicianId: string) => {
    const foundTechnician = sessionData.technicians.find((item) => item.id === technicianId);
    if (!foundTechnician || !foundTechnician.active) {
      setScannerMessage('El técnico no existe o está marcado como inactivo.');
      return false;
    }
    setTechnician(foundTechnician);
    setSelectorOpen(false);
    setScannerMessage(`${foundTechnician.name} identificado. Escanea ahora una herramienta disponible.`);
    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScannerMessage('Activando cámara y enfoque automático…');

    const result = await scanQrCode();
    setScanning(false);

    if (result.status === 'cancelled') {
      setScannerMessage('Lectura cancelada. Puedes volver a intentarlo o seleccionar el técnico manualmente.');
      return;
    }

    if (result.status !== 'success') {
      setScannerMessage(result.message);
      return;
    }

    const payload = parseIsivoltQr(result.value);
    if (payload.type === 'unknown') {
      setScannerMessage('El código leído no pertenece a ISIVOLT Herramientas QR.');
      navigator.vibrate?.([120, 60, 120]);
      return;
    }

    if (mode === 'delivery' && !technician) {
      if (payload.type !== 'technician') {
        setScannerMessage('Para una entrega debes identificar primero al técnico.');
        navigator.vibrate?.([120, 60, 120]);
        return;
      }

      const foundTechnician = findTechnician(sessionData, payload.code);
      if (!foundTechnician) {
        setScannerMessage('El técnico no existe. Puedes buscarlo manualmente.');
        return;
      }
      selectTechnician(foundTechnician.id);
      return;
    }

    if (payload.type !== 'tool') {
      setScannerMessage('Ahora se esperaba el QR de una herramienta.');
      navigator.vibrate?.([120, 60, 120]);
      return;
    }

    const foundTool = findTool(sessionData, payload.code, payload.raw);
    if (!foundTool) {
      setScannerMessage(`No existe ninguna herramienta registrada con el código ${payload.code}.`);
      return;
    }

    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';
    if (foundTool.status !== requiredStatus) {
      setScannerMessage(
        `${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede usarse en esta operación.`,
      );
      navigator.vibrate?.([120, 60, 120]);
      return;
    }

    if (tools.some((tool) => tool.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return;
    }

    setTools((current) => [...current, foundTool]);
    setScannerMessage(`${foundTool.name} añadida. Puedes escanear otra o confirmar la operación.`);
    navigator.vibrate?.([60, 35, 80]);
  };

  const removeTool = (toolId: string) => {
    setTools((current) => current.filter((tool) => tool.id !== toolId));
  };

  const confirmOperation = () => {
    try {
      assertPermission('operations.execute');
    } catch (cause) {
      setScannerMessage(cause instanceof Error ? cause.message : 'No tienes permiso para registrar movimientos.');
      return;
    }

    const current = loadAppData();
    const selectedIds = new Set(tools.map((tool) => tool.id));
    const occurredAt = new Date().toISOString();
    const movementBatch: Movement[] = [];
    const operatorName = getCurrentOperatorName();

    const updatedTools = current.tools.map((tool) => {
      if (!selectedIds.has(tool.id)) return tool;

      if (mode === 'delivery') {
        if (!technician || tool.status !== 'available') return tool;
        movementBatch.push({
          id: newId('mov'),
          type: 'delivery',
          toolId: tool.id,
          technicianId: technician.id,
          operatorName,
          occurredAt,
          previousStatus: tool.status,
          nextStatus: 'loaned',
          notes: notes.trim() || undefined,
        });
        return {
          ...tool,
          status: 'loaned' as ToolStatus,
          holderTechnicianId: technician.id,
          loanedAt: occurredAt,
          updatedAt: occurredAt,
        };
      }

      if (tool.status !== 'loaned') return tool;
      const nextStatus: ToolStatus = condition === 'ok' ? 'available' : condition === 'review' ? 'review' : 'damaged';
      movementBatch.push({
        id: newId('mov'),
        type: condition === 'ok' ? 'return' : 'incident',
        toolId: tool.id,
        technicianId: tool.holderTechnicianId,
        operatorName,
        occurredAt,
        previousStatus: tool.status,
        nextStatus,
        condition,
        notes: notes.trim() || undefined,
      });
      return {
        ...tool,
        status: nextStatus,
        holderTechnicianId: undefined,
        loanedAt: undefined,
        updatedAt: occurredAt,
        notes: notes.trim() || tool.notes,
      };
    });

    if (movementBatch.length === 0) {
      setScannerMessage('No se ha podido confirmar: el estado de las herramientas ha cambiado.');
      return;
    }

    saveAppData({
      ...current,
      tools: updatedTools,
      movements: [...movementBatch, ...current.movements],
    });

    closeWorkflow();
    setAppRevision((value) => value + 1);
    setFeedback({
      title: mode === 'delivery' ? 'Entrega QR completada' : 'Devolución QR completada',
      detail: `${movementBatch.length} movimiento${movementBatch.length === 1 ? '' : 's'} guardado${movementBatch.length === 1 ? '' : 's'} en el dispositivo.`,
      tone: condition === 'damaged' ? 'warning' : 'success',
    });
  };

  const canConfirm = tools.length > 0 && (mode === 'return' || Boolean(technician));

  return (
    <>
      <AppV3 key={appRevision} />

      <AnimatePresence>
        {workflowOpen && (
          <motion.div className="native-scan-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section
              className="native-scan-console"
              initial={compactMotion ? { opacity: 0, y: 18 } : { opacity: 0, y: 50, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={compactMotion ? { opacity: 0, y: 12 } : { opacity: 0, y: 28, scale: 0.97 }}
              transition={{ duration: compactMotion ? 0.18 : 0.24 }}
              role="dialog"
              aria-modal="true"
              aria-label="Operación mediante cámara QR"
            >
              <span className="native-console-glow" aria-hidden="true" />
              <button className="native-scan-close" onClick={closeWorkflow} aria-label="Cerrar escáner"><X size={21} /></button>

              <header className="native-scan-header">
                <span className="native-scan-emblem"><ScanLine size={30} /></span>
                <div><span><Zap size={14} /> Cámara nativa activa</span><h2>Operación QR</h2><p>Lectura mediante Google ML Kit y guardado local.</p></div>
              </header>

              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : (
                <>
                  <div className="native-mode-switch">
                    <button className={mode === 'delivery' ? 'active' : ''} onClick={() => changeMode('delivery')}><ArrowUpFromLine size={18} /> Entrega</button>
                    <button className={mode === 'return' ? 'active' : ''} onClick={() => changeMode('return')}><ArrowDownToLine size={18} /> Devolución</button>
                  </div>

                  <div className="native-progress-grid">
                    {mode === 'delivery' && (
                      <article className={technician ? 'completed' : 'current'}>
                        <span><UserRound size={20} /></span>
                        <div><small>Paso 1</small><strong>{technician?.name ?? 'Identificar técnico'}</strong></div>
                        {technician && <Check size={19} />}
                      </article>
                    )}
                    <article className={tools.length > 0 ? 'completed' : mode === 'return' || technician ? 'current' : ''}>
                      <span><Wrench size={20} /></span>
                      <div><small>{mode === 'delivery' ? 'Paso 2' : 'Paso 1'}</small><strong>{tools.length ? `${tools.length} herramienta${tools.length === 1 ? '' : 's'}` : 'Escanear herramientas'}</strong></div>
                      {tools.length > 0 && <Check size={19} />}
                    </article>
                  </div>

                  <motion.button className="native-camera-button" onClick={handleScan} disabled={scanning} whileTap={{ scale: 0.97 }}>
                    <QrCode size={30} />
                    <strong>{scanning ? 'Abriendo cámara…' : technician || mode === 'return' ? 'Escanear herramienta' : 'Escanear técnico'}</strong>
                  </motion.button>

                  {mode === 'delivery' && !technician && (
                    <button className="native-manual-technician" type="button" onClick={() => setSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Seleccionar técnico manualmente</strong><small>Buscar por nombre, código o categoría</small></span>
                    </button>
                  )}

                  <div className="native-scanner-message">
                    {scannerMessage.includes('no ') || scannerMessage.includes('No ') || scannerMessage.includes('esperaba')
                      ? <AlertTriangle size={17} /> : <Zap size={17} />}
                    <span>{scannerMessage}</span>
                  </div>

                  {tools.length > 0 && (
                    <div className="native-scanned-tools">
                      {tools.map((tool) => (
                        <button key={tool.id} onClick={() => removeTool(tool.id)}><Wrench size={15} /><span><strong>{tool.name}</strong><small>{tool.code}</small></span><X size={15} /></button>
                      ))}
                    </div>
                  )}

                  {mode === 'return' && tools.length > 0 && (
                    <div className="native-condition-grid">
                      {([
                        ['ok', 'Correcta', Check],
                        ['review', 'Revisión', RotateCcw],
                        ['damaged', 'Averiada', AlertTriangle],
                      ] as const).map(([value, label, Icon]) => (
                        <button key={value} className={condition === value ? 'active' : ''} onClick={() => setCondition(value)}><Icon size={17} /> {label}</button>
                      ))}
                    </div>
                  )}

                  <label className="native-notes-field">Observaciones<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Accesorios, estado o incidencia…" /></label>

                  <footer className="native-scan-footer">
                    <span>{tools.length} activo{tools.length === 1 ? '' : 's'} preparado{tools.length === 1 ? '' : 's'}</span>
                    <motion.button disabled={!canConfirm} onClick={confirmOperation} whileTap={{ scale: 0.97 }}><Check size={19} /> Confirmar operación</motion.button>
                  </footer>
                </>
              )}
            </motion.section>
          </motion.div>
        )}

        {feedback && (
          <motion.div className={`native-feedback native-feedback-${feedback.tone}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <Check size={21} /><span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
