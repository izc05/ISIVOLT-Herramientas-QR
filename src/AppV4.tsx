import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
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
import {
  isNativeScannerAvailable,
  parseIsivoltQr,
  scanQrCode,
} from './services/barcodeScanner';
import { loadAppData, saveAppData } from './services/storage';

const OPERATOR_NAME = 'Isi';

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
  const [appRevision, setAppRevision] = useState(0);
  const [workflowOpen, setWorkflowOpen] = useState(false);
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
    const timeout = window.setTimeout(() => setFeedback(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const changeMode = (nextMode: OperationMode) => resetWorkflow(nextMode);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScannerMessage('Activando cámara y enfoque automático…');

    const result = await scanQrCode();
    setScanning(false);

    if (result.status === 'cancelled') {
      setScannerMessage('Lectura cancelada. Puedes volver a intentarlo.');
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
        setScannerMessage('Para una entrega debes escanear primero el QR personal del técnico.');
        navigator.vibrate?.([120, 60, 120]);
        return;
      }

      const foundTechnician = findTechnician(sessionData, payload.code);
      if (!foundTechnician || !foundTechnician.active) {
        setScannerMessage('El técnico no existe o está marcado como inactivo.');
        return;
      }

      setTechnician(foundTechnician);
      setScannerMessage(`${foundTechnician.name} identificado. Escanea ahora una herramienta disponible.`);
      navigator.vibrate?.([60, 35, 80]);
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
    const current = loadAppData();
    const selectedIds = new Set(tools.map((tool) => tool.id));
    const occurredAt = new Date().toISOString();
    const movementBatch: Movement[] = [];

    const updatedTools = current.tools.map((tool) => {
      if (!selectedIds.has(tool.id)) return tool;

      if (mode === 'delivery') {
        if (!technician || tool.status !== 'available') return tool;
        movementBatch.push({
          id: newId('mov'),
          type: 'delivery',
          toolId: tool.id,
          technicianId: technician.id,
          operatorName: OPERATOR_NAME,
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
        operatorName: OPERATOR_NAME,
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

    setWorkflowOpen(false);
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
          <motion.div
            className="native-scan-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="native-scan-console"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              role="dialog"
              aria-modal="true"
              aria-label="Operación mediante cámara QR"
            >
              <span className="native-console-glow" aria-hidden="true" />
              <button className="native-scan-close" onClick={() => setWorkflowOpen(false)} aria-label="Cerrar escáner">
                <X size={21} />
              </button>

              <header className="native-scan-header">
                <motion.span
                  className="native-scan-emblem"
                  animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity }}
                >
                  <ScanLine size={30} />
                </motion.span>
                <div>
                  <span><Zap size={14} /> Cámara nativa activa</span>
                  <h2>Operación QR</h2>
                  <p>Lectura mediante Google ML Kit y guardado local en SQLite.</p>
                </div>
              </header>

              <div className="native-mode-switch">
                <button className={mode === 'delivery' ? 'active' : ''} onClick={() => changeMode('delivery')}>
                  <ArrowUpFromLine size={18} /> Entrega
                </button>
                <button className={mode === 'return' ? 'active' : ''} onClick={() => changeMode('return')}>
                  <ArrowDownToLine size={18} /> Devolución
                </button>
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

              <motion.button
                className="native-camera-button"
                onClick={handleScan}
                disabled={scanning}
                whileTap={{ scale: 0.95 }}
              >
                <motion.span
                  animate={{ scale: scanning ? [1, 1.32, 1] : [1, 1.12, 1], opacity: [0.7, 0.2, 0.7] }}
                  transition={{ duration: scanning ? 0.8 : 2, repeat: Infinity }}
                />
                <QrCode size={30} />
                <strong>{scanning ? 'Abriendo cámara…' : technician || mode === 'return' ? 'Escanear herramienta' : 'Escanear técnico'}</strong>
              </motion.button>

              <div className="native-scanner-message">
                {scannerMessage.includes('no ') || scannerMessage.includes('No ') || scannerMessage.includes('esperaba')
                  ? <AlertTriangle size={17} />
                  : <Zap size={17} />}
                <span>{scannerMessage}</span>
              </div>

              {tools.length > 0 && (
                <div className="native-scanned-tools">
                  {tools.map((tool) => (
                    <motion.button key={tool.id} onClick={() => removeTool(tool.id)} layout whileTap={{ scale: 0.95 }}>
                      <Wrench size={15} />
                      <span><strong>{tool.name}</strong><small>{tool.code}</small></span>
                      <X size={15} />
                    </motion.button>
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
                    <button key={value} className={condition === value ? 'active' : ''} onClick={() => setCondition(value)}>
                      <Icon size={17} /> {label}
                    </button>
                  ))}
                </div>
              )}

              <label className="native-notes-field">
                Observaciones
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Accesorios, estado o incidencia…" />
              </label>

              <footer className="native-scan-footer">
                <span>{tools.length} activo{tools.length === 1 ? '' : 's'} preparado{tools.length === 1 ? '' : 's'}</span>
                <motion.button disabled={!canConfirm} onClick={confirmOperation} whileTap={{ scale: 0.96 }}>
                  <Check size={19} /> Confirmar operación
                </motion.button>
              </footer>
            </motion.section>
          </motion.div>
        )}

        {feedback && (
          <motion.div
            className={`native-feedback native-feedback-${feedback.tone}`}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
          >
            <Check size={21} />
            <span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
