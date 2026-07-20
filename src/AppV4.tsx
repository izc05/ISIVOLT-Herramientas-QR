import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ListFilter,
  LoaderCircle,
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
import { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';
import ToolSelectorPanel from './features/inventory/ToolSelectorPanel';
import TechnicianSelectorPanel from './features/technicians/TechnicianSelectorPanel';
import { assertPermission } from './security/permissions';
import { getCurrentOperatorName } from './security/session';
import {
  isNativeScannerAvailable,
  parseIsivoltQr,
  scanQrCode,
} from './services/barcodeScanner';
import {
  isNfcScannerAvailable,
  normalizeNfcUid,
  scanNfcTag,
} from './services/nfcScanner';
import { loadAppData, saveAppData, waitForPendingAppDataWrites } from './services/storage';

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

const findTechnicianByNfc = (data: AppData, uid: string) =>
  data.technicians.find((item) => normalizeNfcUid(item.nfcUid) === uid);

const findToolByNfc = (data: AppData, uid: string) =>
  data.tools.find((item) => normalizeNfcUid(item.nfcUid) === uid);

export default function AppV4() {
  const nativeScanner = useMemo(() => isNativeScannerAvailable(), []);
  const nativeNfc = useMemo(() => isNfcScannerAvailable(), []);
  const reduceMotion = useReducedMotion();
  const compactMotion = reduceMotion || window.matchMedia('(max-width: 820px)').matches;
  const [appRevision, setAppRevision] = useState(0);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);
  const [mode, setMode] = useState<OperationMode>('delivery');
  const [sessionData, setSessionData] = useState<AppData>(() => loadAppData());
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [condition, setCondition] = useState<ReturnCondition>('ok');
  const [notes, setNotes] = useState('');
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('Selecciona el tipo de operación y comienza a identificar.');
  const [feedback, setFeedback] = useState<NativeFeedback>(null);
  const [scanAlert, setScanAlert] = useState<{ tool: Tool; title: string; detail: string } | null>(null);

  const resetWorkflow = (nextMode: OperationMode = 'delivery') => {
    setSessionData(loadAppData());
    setMode(nextMode);
    setTechnician(null);
    setTools([]);
    setCondition('ok');
    setNotes('');
    setScanning(false);
    setNfcScanning(false);
    setSaving(false);
    setSelectorOpen(false);
    setToolSelectorOpen(false);
    setScanAlert(null);
    setScannerMessage(
      nextMode === 'delivery'
        ? 'Identifica primero al técnico mediante su tarjeta NFC, su QR o la búsqueda manual.'
        : 'Pasa la tarjeta del técnico para cargar todo lo pendiente o identifica una herramienta individual.',
    );
  };

  const openWorkflow = () => {
    resetWorkflow('delivery');
    setWorkflowOpen(true);
  };

  const closeWorkflow = () => {
    setSelectorOpen(false);
    setToolSelectorOpen(false);
    setScanAlert(null);
    setScanning(false);
    setNfcScanning(false);
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

    if (technician && technician.id !== foundTechnician.id && tools.length > 0) {
      setScannerMessage('Quita primero las herramientas seleccionadas antes de cambiar de técnico.');
      return false;
    }

    setTechnician(foundTechnician);
    setSelectorOpen(false);
    setToolSelectorOpen(false);

    if (mode === 'return') {
      const pending = sessionData.tools.filter(
        (tool) => tool.status === 'loaned' && tool.holderTechnicianId === foundTechnician.id,
      );
      setTools(pending);
      setScannerMessage(
        pending.length > 0
          ? `${foundTechnician.name} identificado. Se han cargado ${pending.length} herramienta${pending.length === 1 ? '' : 's'} pendiente${pending.length === 1 ? '' : 's'}. Revisa la lista y confirma.`
          : `${foundTechnician.name} no tiene herramientas pendientes de devolución.`,
      );
    } else {
      setScannerMessage(`${foundTechnician.name} identificado. Escanea ahora una o varias herramientas disponibles mediante QR o NFC.`);
    }

    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

  const addToolToOperation = (foundTool: Tool) => {
    if (mode === 'delivery') {
      const deliveryAlert = getDeliveryAlert(foundTool, technician?.id);
      if (deliveryAlert) {
        setScanAlert({ tool: foundTool, title: deliveryAlert.title, detail: deliveryAlert.detail });
        setScannerMessage(`${deliveryAlert.title}: ${deliveryAlert.detail}`);
        setFeedback({ title: deliveryAlert.title, detail: deliveryAlert.detail, tone: 'error' });
        navigator.vibrate?.([180, 70, 180, 70, 220]);
        return false;
      }
    }

    const requiredStatus: ToolStatus = mode === 'delivery' ? 'available' : 'loaned';
    if (foundTool.status !== requiredStatus) {
      setScannerMessage(
        `${foundTool.name} está ${toolStatusLabel[foundTool.status].toLowerCase()} y no puede usarse en esta operación.`,
      );
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }

    if (mode === 'return' && technician && foundTool.holderTechnicianId !== technician.id) {
      const holder = sessionData.technicians.find((item) => item.id === foundTool.holderTechnicianId);
      setScannerMessage(`${foundTool.name} está prestada a ${holder?.name ?? 'otro técnico'} y no puede incluirse en esta devolución.`);
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }

    if (tools.some((tool) => tool.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return false;
    }

    if (mode === 'return' && !technician && foundTool.holderTechnicianId) {
      const holder = sessionData.technicians.find((item) => item.id === foundTool.holderTechnicianId);
      if (holder) setTechnician(holder);
    }

    setTools((current) => [...current, foundTool]);
    setScannerMessage(`${foundTool.name} añadida. Puedes incorporar otra mediante QR o NFC, o confirmar la operación.`);
    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

  const selectToolManually = (toolId: string) => {
    const foundTool = sessionData.tools.find((item) => item.id === toolId);
    if (!foundTool) {
      setScannerMessage('La herramienta seleccionada ya no existe en el inventario.');
      return false;
    }
    return addToolToOperation(foundTool);
  };

  const processTechnician = (foundTechnician: Technician | undefined) => {
    if (!foundTechnician) {
      setScannerMessage('La tarjeta o el código no pertenecen a ningún técnico registrado.');
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }
    return selectTechnician(foundTechnician.id);
  };

  const handleScan = async () => {
    if (scanning || nfcScanning || saving) return;
    setScanning(true);
    setScannerMessage('Activando cámara y enfoque automático…');

    const result = await scanQrCode();
    setScanning(false);

    if (result.status === 'cancelled') {
      setScannerMessage('Lectura cancelada. Puedes intentarlo de nuevo, usar NFC o seleccionar manualmente.');
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

    if (payload.type === 'technician') {
      const foundTechnician = findTechnician(sessionData, payload.code);
      processTechnician(foundTechnician);
      return;
    }

    if (mode === 'delivery' && !technician) {
      setScannerMessage('Para una entrega debes identificar primero al técnico mediante QR, NFC o búsqueda manual.');
      navigator.vibrate?.([120, 60, 120]);
      return;
    }

    const foundTool = findTool(sessionData, payload.code, payload.raw);
    if (!foundTool) {
      setScannerMessage(`No existe ninguna herramienta registrada con el código ${payload.code}.`);
      return;
    }

    addToolToOperation(foundTool);
  };

  const handleNfcScan = async () => {
    if (scanning || nfcScanning || saving) return;
    setNfcScanning(true);
    setScannerMessage('Acerca la tarjeta o la pegatina NFC a la parte trasera del teléfono…');

    const result = await scanNfcTag();
    setNfcScanning(false);

    if (result.status === 'cancelled') {
      setScannerMessage('Lectura NFC cancelada o agotó el tiempo. Puedes volver a intentarlo.');
      return;
    }

    if (result.status !== 'success') {
      setScannerMessage(result.message);
      navigator.vibrate?.([120, 60, 120]);
      return;
    }

    const uid = normalizeNfcUid(result.tag.uid);
    const foundTechnician = findTechnicianByNfc(sessionData, uid);
    const foundTool = findToolByNfc(sessionData, uid);

    if (foundTechnician && foundTool) {
      setScannerMessage('Este UID NFC está duplicado entre un técnico y una herramienta. Corrige la vinculación en Administración > NFC.');
      navigator.vibrate?.([180, 70, 180]);
      return;
    }

    if (foundTechnician) {
      processTechnician(foundTechnician);
      return;
    }

    if (foundTool) {
      if (mode === 'delivery' && !technician) {
        setScannerMessage('Se ha detectado una herramienta. Identifica primero al técnico responsable.');
        navigator.vibrate?.([120, 60, 120]);
        return;
      }
      addToolToOperation(foundTool);
      return;
    }

    setScannerMessage(`NFC ${uid} sin vincular. Regístralo desde Administración > NFC.`);
    setFeedback({ title: 'NFC no vinculado', detail: `UID ${uid}`, tone: 'warning' });
    navigator.vibrate?.([120, 60, 120]);
  };

  const removeTool = (toolId: string) => {
    if (saving) return;
    setTools((current) => current.filter((tool) => tool.id !== toolId));
  };

  const confirmOperation = async () => {
    if (saving) return;

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
      if (technician && tool.holderTechnicianId !== technician.id) return tool;
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

    setSaving(true);
    setScannerMessage('Guardando la operación y verificando SQLite…');
    let localSaveCompleted = false;

    try {
      saveAppData({
        ...current,
        tools: updatedTools,
        movements: [...movementBatch, ...current.movements],
      });
      localSaveCompleted = true;
      await waitForPendingAppDataWrites();

      closeWorkflow();
      setAppRevision((value) => value + 1);
      setFeedback({
        title: mode === 'delivery' ? 'Préstamo completado' : 'Devolución completada',
        detail: `${movementBatch.length} movimiento${movementBatch.length === 1 ? '' : 's'} guardado${movementBatch.length === 1 ? '' : 's'} en el dispositivo · ${formatOperationDateTime(occurredAt)}.`,
        tone: condition === 'damaged' ? 'warning' : 'success',
      });
      navigator.vibrate?.([60, 35, 100]);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'SQLite no ha confirmado la escritura.';

      if (localSaveCompleted) {
        closeWorkflow();
        setAppRevision((value) => value + 1);
        setFeedback({
          title: 'Operación guardada localmente',
          detail: `La operación queda protegida para recuperarse en el próximo arranque. ${detail}`,
          tone: 'warning',
        });
      } else {
        setScannerMessage(`No se ha podido guardar la operación: ${detail}`);
        setFeedback({
          title: 'Operación no guardada',
          detail,
          tone: 'error',
        });
      }
      navigator.vibrate?.([180, 70, 180]);
    } finally {
      setSaving(false);
    }
  };

  const canConfirm = !saving
    && tools.length > 0
    && (mode === 'return' || Boolean(technician))
    && (mode !== 'return' || condition === 'ok' || notes.trim().length > 0);

  const expectedLabel = mode === 'delivery'
    ? technician ? 'herramienta' : 'técnico'
    : technician ? 'herramienta' : 'técnico o herramienta';

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
              aria-label="Operación mediante QR o NFC"
              aria-busy={saving}
            >
              <span className="native-console-glow" aria-hidden="true" />
              <button className="native-scan-close" onClick={closeWorkflow} disabled={saving} aria-label="Cerrar lector"><X size={21} /></button>

              <header className="native-scan-header">
                <span className="native-scan-emblem"><ScanLine size={30} /></span>
                <div><span><Zap size={14} /> Lectores activos</span><h2>Operación QR + NFC</h2><p>Identificación dual y guardado local trazable.</p></div>
              </header>

              {selectorOpen ? (
                <TechnicianSelectorPanel
                  technicians={sessionData.technicians}
                  tools={sessionData.tools}
                  onSelect={selectTechnician}
                  onBack={() => setSelectorOpen(false)}
                />
              ) : toolSelectorOpen ? (
                <ToolSelectorPanel
                  tools={sessionData.tools}
                  technicians={sessionData.technicians}
                  mode={mode}
                  technicianId={technician?.id}
                  selectedIds={tools.map((tool) => tool.id)}
                  onSelect={selectToolManually}
                  onBack={() => setToolSelectorOpen(false)}
                />
              ) : (
                <>
                  <div className="native-mode-switch">
                    <button disabled={saving} className={mode === 'delivery' ? 'active' : ''} onClick={() => changeMode('delivery')}><ArrowUpFromLine size={18} /> Préstamo</button>
                    <button disabled={saving} className={mode === 'return' ? 'active' : ''} onClick={() => changeMode('return')}><ArrowDownToLine size={18} /> Devolución</button>
                  </div>

                  <div className="native-progress-grid">
                    <article className={technician ? 'completed' : 'current'}>
                      <span><UserRound size={20} /></span>
                      <div><small>{mode === 'delivery' ? 'Paso 1' : 'Técnico'}</small><strong>{technician?.name ?? (mode === 'delivery' ? 'Identificar técnico' : 'Opcional: cargar todo')}</strong></div>
                      {technician && <Check size={19} />}
                    </article>
                    <article className={tools.length > 0 ? 'completed' : mode === 'return' || technician ? 'current' : ''}>
                      <span><Wrench size={20} /></span>
                      <div><small>{mode === 'delivery' ? 'Paso 2' : 'Herramientas'}</small><strong>{tools.length ? `${tools.length} herramienta${tools.length === 1 ? '' : 's'}` : 'Identificar herramientas'}</strong></div>
                      {tools.length > 0 && <Check size={19} />}
                    </article>
                  </div>

                  <div className="native-scan-methods">
                    <motion.button className="native-camera-button" onClick={handleScan} disabled={scanning || nfcScanning || saving} whileTap={{ scale: 0.97 }}>
                      <QrCode size={28} />
                      <strong>{scanning ? 'Abriendo cámara…' : `QR ${expectedLabel}`}</strong>
                    </motion.button>
                    <motion.button className="native-nfc-button" onClick={handleNfcScan} disabled={scanning || nfcScanning || saving || !nativeNfc} whileTap={{ scale: 0.97 }}>
                      <ScanLine size={28} />
                      <strong>{nfcScanning ? 'Leyendo NFC…' : `NFC ${expectedLabel}`}</strong>
                    </motion.button>
                  </div>

                  {!nativeNfc && (
                    <div className="native-scanner-message"><AlertTriangle size={17} /><span>Este dispositivo no ofrece lectura NFC nativa. El QR y la selección manual siguen disponibles.</span></div>
                  )}

                  {!technician && (
                    <button disabled={saving} className="native-manual-technician" type="button" onClick={() => setSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Seleccionar técnico manualmente</strong><small>Buscar por nombre, código o categoría</small></span>
                    </button>
                  )}

                  {(mode === 'return' || Boolean(technician)) && (
                    <button disabled={saving} className="native-manual-tool" type="button" onClick={() => setToolSelectorOpen(true)}>
                      <ListFilter size={19} />
                      <span><strong>Buscar herramienta manualmente</strong><small>Nombre, código, categoría, ubicación, marca o NFC</small></span>
                    </button>
                  )}

                  <div className="native-scanner-message">
                    {scannerMessage.includes('no ') || scannerMessage.includes('No ') || scannerMessage.includes('esperaba') || scannerMessage.includes('sin vincular')
                      ? <AlertTriangle size={17} /> : saving ? <LoaderCircle className="boot-spin" size={17} /> : <Zap size={17} />}
                    <span>{scannerMessage}</span>
                  </div>

                  {tools.length > 0 && (
                    <div className="native-scanned-tools">
                      {tools.map((tool) => (
                        <button disabled={saving} key={tool.id} onClick={() => removeTool(tool.id)}><Wrench size={15} /><span><strong>{tool.name}</strong><small>{tool.code}{tool.nfcUid ? ' · NFC' : ''}</small></span><X size={15} /></button>
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
                        <button disabled={saving} key={value} className={condition === value ? 'active' : ''} onClick={() => setCondition(value)}><Icon size={17} /> {label}</button>
                      ))}
                    </div>
                  )}

                  <label className="native-notes-field">
                    {mode === 'return' && condition !== 'ok' ? 'Observaciones obligatorias' : 'Observaciones'}
                    <textarea disabled={saving} value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Accesorios, estado o incidencia…" />
                  </label>

                  <footer className="native-scan-footer">
                    <span>{saving ? 'Guardando y verificando…' : `${tools.length} activo${tools.length === 1 ? '' : 's'} preparado${tools.length === 1 ? '' : 's'}`}</span>
                    <motion.button disabled={!canConfirm} onClick={confirmOperation} whileTap={{ scale: 0.97 }}>
                      {saving ? <LoaderCircle className="boot-spin" size={19} /> : <Check size={19} />}
                      {saving ? 'Guardando…' : `Confirmar ${mode === 'delivery' ? 'préstamo' : 'devolución'}`}
                    </motion.button>
                  </footer>
                </>
              )}
            </motion.section>
          </motion.div>
        )}

        {scanAlert && (
          <motion.div className="native-tool-alert-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setScanAlert(null)}>
            <motion.section className="native-tool-alert" initial={{ opacity: 0, y: 30, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.97 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Aviso de herramienta bloqueada">
              <span className="native-tool-alert-icon"><AlertTriangle size={34} /></span>
              <small>Préstamo bloqueado</small>
              <h2>{scanAlert.title}</h2>
              <strong>{scanAlert.tool.code} · {scanAlert.tool.name}</strong>
              <p>{scanAlert.detail}</p>
              {scanAlert.tool.notes && <blockquote>{scanAlert.tool.notes}</blockquote>}
              <button type="button" onClick={() => setScanAlert(null)}><X size={18} /> Entendido</button>
            </motion.section>
          </motion.div>
        )}

        {feedback && (
          <motion.div className={`native-feedback native-feedback-${feedback.tone}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            {feedback.tone === 'success' ? <Check size={21} /> : <AlertTriangle size={21} />}<span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
