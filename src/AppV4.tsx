import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  applyMovementCommand,
  createOperationId,
  MovementRuleError,
} from './domain/movementEngine';
import type {
  AppData,
  OperationMode,
  ReturnCondition,
  Technician,
  Tool,
  ToolStatus,
} from './domain/types';
import { formatOperationDateTime, getDeliveryAlert } from './features/inventory/inventoryOperations';
import ToolSelectorPanel from './features/inventory/ToolSelectorPanel';
import OperationReviewPanel from './features/operations/OperationReviewPanel';
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

const buildReturnConditions = (
  tools: Tool[],
  defaultCondition: ReturnCondition,
): Record<string, ReturnCondition> => Object.fromEntries(
  tools.map((tool) => [tool.id, defaultCondition]),
) as Record<string, ReturnCondition>;

export default function AppV4() {
  const nativeScanner = useMemo(() => isNativeScannerAvailable(), []);
  const nativeNfc = useMemo(() => isNfcScannerAvailable(), []);
  const reduceMotion = useReducedMotion();
  const compactMotion = reduceMotion || window.matchMedia('(max-width: 820px)').matches;
  const savingRef = useRef(false);
  const [appRevision, setAppRevision] = useState(0);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [toolSelectorOpen, setToolSelectorOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [mode, setMode] = useState<OperationMode>('delivery');
  const [operationId, setOperationId] = useState(() => createOperationId());
  const [sessionData, setSessionData] = useState<AppData>(() => loadAppData());
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [condition, setCondition] = useState<ReturnCondition>('ok');
  const [returnConditions, setReturnConditions] = useState<Record<string, ReturnCondition>>({});
  const [notes, setNotes] = useState('');
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('Selecciona el tipo de operación y comienza a identificar.');
  const [feedback, setFeedback] = useState<NativeFeedback>(null);
  const [scanAlert, setScanAlert] = useState<{ tool: Tool; title: string; detail: string } | null>(null);

  const resetWorkflow = (nextMode: OperationMode = 'delivery') => {
    savingRef.current = false;
    setSessionData(loadAppData());
    setMode(nextMode);
    setOperationId(createOperationId());
    setTechnician(null);
    setTools([]);
    setCondition('ok');
    setReturnConditions({});
    setNotes('');
    setScanning(false);
    setNfcScanning(false);
    setSaving(false);
    setReviewing(false);
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
    setReviewing(false);
    setScanAlert(null);
    setScanning(false);
    setNfcScanning(false);
    setWorkflowOpen(false);
  };

  const requestCloseWorkflow = () => {
    if (savingRef.current) return;
    const hasDraft = Boolean(technician || tools.length > 0 || notes.trim() || reviewing);
    if (hasDraft && !window.confirm('Hay una operación sin guardar. ¿Quieres cancelarla?')) return;
    closeWorkflow();
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
    const timeout = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const changeMode = (nextMode: OperationMode) => {
    if (savingRef.current) return;
    resetWorkflow(nextMode);
  };

  const selectTechnician = (technicianId: string) => {
    if (savingRef.current) return false;
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
      setReturnConditions(buildReturnConditions(pending, condition));
      setScannerMessage(
        pending.length > 0
          ? `${foundTechnician.name} identificado. Se han cargado ${pending.length} herramienta${pending.length === 1 ? '' : 's'} pendiente${pending.length === 1 ? '' : 's'}. Revisa la lista antes de guardar.`
          : `${foundTechnician.name} no tiene herramientas pendientes de devolución.`,
      );
    } else {
      setScannerMessage(`${foundTechnician.name} identificado. Escanea ahora una o varias herramientas disponibles mediante QR o NFC.`);
    }

    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

  const addToolToOperation = (foundTool: Tool) => {
    if (savingRef.current) return false;

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
    if (mode === 'return') {
      setReturnConditions((current) => ({
        ...current,
        [foundTool.id]: current[foundTool.id] ?? condition,
      }));
    }
    setScannerMessage(`${foundTool.name} añadida. Puedes incorporar otra mediante QR o NFC, o revisar la operación.`);
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
    if (scanning || nfcScanning || savingRef.current) return;
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
    if (scanning || nfcScanning || savingRef.current) return;
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
    if (savingRef.current) return;
    setTools((current) => current.filter((tool) => tool.id !== toolId));
    setReturnConditions((current) => {
      const { [toolId]: removed, ...remaining } = current;
      void removed;
      return remaining;
    });
  };

  const applyConditionToAll = (nextCondition: ReturnCondition) => {
    if (savingRef.current) return;
    setCondition(nextCondition);
    setReturnConditions(buildReturnConditions(tools, nextCondition));
  };

  const updateToolCondition = (toolId: string, nextCondition: ReturnCondition) => {
    if (savingRef.current) return;
    setReturnConditions((current) => ({ ...current, [toolId]: nextCondition }));
  };

  const openReview = () => {
    if (savingRef.current) return;
    if (tools.length === 0) {
      setScannerMessage('Selecciona al menos una herramienta antes de revisar.');
      return;
    }
    if (mode === 'delivery' && !technician) {
      setScannerMessage('Selecciona el técnico responsable antes de revisar el préstamo.');
      return;
    }
    if (mode === 'return') {
      setReturnConditions((current) => ({
        ...buildReturnConditions(tools, condition),
        ...current,
      }));
    }
    setSelectorOpen(false);
    setToolSelectorOpen(false);
    setReviewing(true);
  };

  const confirmOperation = async () => {
    if (savingRef.current) return;

    try {
      assertPermission('operations.execute');
    } catch (cause) {
      setScannerMessage(cause instanceof Error ? cause.message : 'No tienes permiso para registrar movimientos.');
      return;
    }

    let result;
    try {
      result = applyMovementCommand(loadAppData(), {
        operationId,
        mode,
        toolIds: tools.map((tool) => tool.id),
        technicianId: technician?.id,
        condition,
        returnConditions,
        notes,
        operatorName: getCurrentOperatorName(),
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'No se ha podido preparar la operación.';
      setScannerMessage(detail);
      setFeedback({
        title: cause instanceof MovementRuleError && cause.code === 'operation-already-applied'
          ? 'Operación ya registrada'
          : 'Revisa la operación',
        detail,
        tone: cause instanceof MovementRuleError && cause.code === 'operation-already-applied'
          ? 'warning'
          : 'error',
      });
      navigator.vibrate?.([180, 70, 180]);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setScannerMessage('Guardando la operación y verificando SQLite…');
    let localSaveCompleted = false;

    try {
      saveAppData(result.data);
      localSaveCompleted = true;
      await waitForPendingAppDataWrites();

      closeWorkflow();
      setAppRevision((value) => value + 1);
      const hasIncident = result.movements.some((movement) => movement.type === 'incident');
      setFeedback({
        title: mode === 'delivery' ? 'Préstamo completado' : 'Devolución completada',
        detail: `${result.movements.length} movimiento${result.movements.length === 1 ? '' : 's'} guardado${result.movements.length === 1 ? '' : 's'} en el dispositivo · ${formatOperationDateTime(result.movements[0]?.occurredAt)}.`,
        tone: hasIncident ? 'warning' : 'success',
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
      savingRef.current = false;
      setSaving(false);
    }
  };

  const canReview = !saving
    && tools.length > 0
    && (mode === 'return' || Boolean(technician));

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
              <button className="native-scan-close" onClick={requestCloseWorkflow} disabled={saving} aria-label="Cerrar lector"><X size={21} /></button>

              <header className="native-scan-header">
                <span className="native-scan-emblem"><ScanLine size={30} /></span>
                <div><span><Zap size={14} /> Lectores activos</span><h2>Operación QR + NFC</h2><p>Identificación dual y guardado local trazable.</p></div>
              </header>

              {reviewing ? (
                <OperationReviewPanel
                  mode={mode}
                  operationId={operationId}
                  technician={technician}
                  tools={tools}
                  returnConditions={returnConditions}
                  notes={notes}
                  saving={saving}
                  onConditionChange={updateToolCondition}
                  onNotesChange={setNotes}
                  onBack={() => setReviewing(false)}
                  onConfirm={() => { void confirmOperation(); }}
                />
              ) : selectorOpen ? (
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
                    <div className="native-condition-grid" aria-label="Aplicar estado inicial a todas las herramientas">
                      {([
                        ['ok', 'Correctas', Check],
                        ['review', 'Revisión', RotateCcw],
                        ['damaged', 'Averiadas', AlertTriangle],
                      ] as const).map(([value, label, Icon]) => (
                        <button disabled={saving} key={value} className={condition === value ? 'active' : ''} onClick={() => applyConditionToAll(value)}><Icon size={17} /> {label}</button>
                      ))}
                    </div>
                  )}

                  <label className="native-notes-field">
                    {mode === 'return' && Object.values(returnConditions).some((value) => value !== 'ok') ? 'Observaciones obligatorias' : 'Observaciones'}
                    <textarea disabled={saving} value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Accesorios, estado o incidencia…" />
                  </label>

                  <footer className="native-scan-footer">
                    <span>{saving ? 'Guardando y verificando…' : `${tools.length} activo${tools.length === 1 ? '' : 's'} preparado${tools.length === 1 ? '' : 's'}`}</span>
                    <motion.button disabled={!canReview} onClick={openReview} whileTap={{ scale: 0.97 }}>
                      <Check size={19} />
                      Revisar {mode === 'delivery' ? 'préstamo' : 'devolución'}
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
