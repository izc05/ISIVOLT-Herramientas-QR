import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import {
  applyMovementCommand,
  createOperationId,
  MovementRuleError,
  type AccessoryChecksByTool,
} from '../../domain/movementEngine';
import type {
  AccessoryCondition,
  AppData,
  OperationMode,
  ReturnCondition,
  Technician,
  Tool,
  ToolStatus,
} from '../../domain/types';
import { formatOperationDateTime, getDeliveryAlert } from '../inventory/inventoryOperations';
import ToolSelectorPanel from '../inventory/ToolSelectorPanel';
import OperationReviewPanel from './OperationReviewPanel';
import TechnicianSelectorPanel from '../technicians/TechnicianSelectorPanel';
import { assertPermission } from '../../security/permissions';
import { getCurrentOperatorName } from '../../security/session';
import { parseIsivoltQr, scanQrCode } from '../../services/barcodeScanner';
import {
  isNfcScannerAvailable,
  normalizeNfcUid,
  scanNfcTag,
} from '../../services/nfcScanner';
import { loadAppData, saveAppData, waitForPendingAppDataWrites } from '../../services/storage';

type Feedback = {
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'error';
} | null;

type ScanOutcome = {
  accepted: boolean;
  title: string;
  message: string;
  tone: 'success' | 'warning' | 'error';
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
    (tool) => tool.code.toUpperCase() === code.toUpperCase()
      || tool.qrCode.toUpperCase() === raw.toUpperCase(),
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

const buildAccessoryChecks = (
  data: AppData,
  tools: Tool[],
  current: AccessoryChecksByTool = {},
): AccessoryChecksByTool => Object.fromEntries(
  tools.map((tool) => [
    tool.id,
    Object.fromEntries(
      (data.accessories ?? [])
        .filter((accessory) => accessory.active && accessory.toolId === tool.id)
        .map((accessory) => [
          accessory.id,
          current[tool.id]?.[accessory.id] ?? 'not_checked',
        ]),
    ),
  ]),
) as AccessoryChecksByTool;

const toLocalInputValue = (date: Date) => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
};

const suggestedReturnDate = (tools: Tool[]) => {
  const loanDays = tools
    .map((tool) => tool.maxLoanDays)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (loanDays.length === 0) return '';
  const days = Math.min(...loanDays);
  return toLocalInputValue(new Date(Date.now() + days * 86_400_000));
};

const initialInstruction = (mode: OperationMode) => mode === 'delivery'
  ? 'Paso 1: identifica al técnico. Paso 2: escanea o busca una o varias herramientas.'
  : 'Paso 1: identifica al técnico. Paso 2: escanea únicamente las herramientas que devuelve físicamente.';

export default function FastScanWorkflow() {
  const savingRef = useRef(false);
  const technicianRef = useRef<Technician | null>(null);
  const toolsRef = useRef<Tool[]>([]);

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
  const [accessoryChecks, setAccessoryChecks] = useState<AccessoryChecksByTool>({});
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerMessage, setScannerMessage] = useState(initialInstruction('delivery'));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [scanAlert, setScanAlert] = useState<{
    tool: Tool;
    title: string;
    detail: string;
  } | null>(null);

  const resetDraft = useCallback((nextMode: OperationMode = 'delivery') => {
    savingRef.current = false;
    technicianRef.current = null;
    toolsRef.current = [];
    setSessionData(loadAppData());
    setMode(nextMode);
    setOperationId(createOperationId());
    setTechnician(null);
    setTools([]);
    setCondition('ok');
    setReturnConditions({});
    setAccessoryChecks({});
    setExpectedReturnAt('');
    setWorkOrder('');
    setWorkLocation('');
    setNotes('');
    setScanning(false);
    setNfcScanning(false);
    setSaving(false);
    setReviewing(false);
    setSelectorOpen(false);
    setToolSelectorOpen(false);
    setScanAlert(null);
    setScannerMessage(initialInstruction(nextMode));
  }, []);

  const openWorkflow = useCallback(() => {
    resetDraft('delivery');
    setWorkflowOpen(true);
  }, [resetDraft]);

  useLayoutEffect(() => {
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
  }, [openWorkflow]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeoutId = window.setTimeout(() => setFeedback(null), 4_200);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const closeWorkflow = () => {
    if (savingRef.current) return;
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
    const hasDraft = Boolean(
      technicianRef.current
      || toolsRef.current.length > 0
      || notes.trim()
      || workOrder.trim()
      || workLocation.trim()
      || expectedReturnAt
      || reviewing,
    );
    if (hasDraft && !window.confirm('Hay una operación sin guardar. ¿Quieres cancelarla?')) return;
    closeWorkflow();
  };

  const changeMode = (nextMode: OperationMode) => {
    if (savingRef.current || nextMode === mode) return;
    resetDraft(nextMode);
  };

  const selectTechnician = (technicianId: string) => {
    if (savingRef.current) return false;
    const foundTechnician = sessionData.technicians.find((item) => item.id === technicianId);
    if (!foundTechnician || !foundTechnician.active) {
      setScannerMessage('El técnico no existe o está marcado como inactivo.');
      return false;
    }

    const currentTechnician = technicianRef.current;
    const currentTools = toolsRef.current;
    if (currentTechnician && currentTechnician.id !== foundTechnician.id && currentTools.length > 0) {
      setScannerMessage('Quita primero las herramientas seleccionadas antes de cambiar de técnico.');
      return false;
    }

    technicianRef.current = foundTechnician;
    setTechnician(foundTechnician);
    setSelectorOpen(false);
    setToolSelectorOpen(false);

    if (mode === 'return') {
      const pendingCount = sessionData.tools.filter(
        (tool) => tool.status === 'loaned' && tool.holderTechnicianId === foundTechnician.id,
      ).length;
      setScannerMessage(
        pendingCount > 0
          ? `${foundTechnician.name} identificado. Tiene ${pendingCount} herramienta${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}. Escanea solo las que entrega.`
          : `${foundTechnician.name} no tiene herramientas pendientes de devolución.`,
      );
    } else {
      setScannerMessage(`${foundTechnician.name} identificado. Escanea o busca las herramientas.`);
    }

    navigator.vibrate?.([60, 35, 80]);
    return true;
  };

  const addToolToOperation = (foundTool: Tool) => {
    if (savingRef.current) return false;
    const activeTechnician = technicianRef.current;
    const currentTools = toolsRef.current;

    if (!activeTechnician) {
      setScannerMessage('Identifica primero al técnico antes de añadir herramientas.');
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }

    if (mode === 'delivery') {
      const deliveryAlert = getDeliveryAlert(foundTool, activeTechnician.id);
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

    if (mode === 'return' && foundTool.holderTechnicianId !== activeTechnician.id) {
      const holder = sessionData.technicians.find((item) => item.id === foundTool.holderTechnicianId);
      setScannerMessage(
        `${foundTool.name} está prestada a ${holder?.name ?? 'otro técnico'} y no puede incluirse en esta devolución.`,
      );
      navigator.vibrate?.([120, 60, 120]);
      return false;
    }

    if (currentTools.some((tool) => tool.id === foundTool.id)) {
      setScannerMessage(`${foundTool.name} ya estaba añadida a esta operación.`);
      return false;
    }

    const nextTools = [...currentTools, foundTool];
    toolsRef.current = nextTools;
    setTools(nextTools);
    setAccessoryChecks((current) => buildAccessoryChecks(sessionData, nextTools, current));
    if (mode === 'return') {
      setReturnConditions((current) => ({
        ...current,
        [foundTool.id]: current[foundTool.id] ?? condition,
      }));
    }

    setScannerMessage(
      `${foundTool.name} añadida. Llevas ${nextTools.length} herramienta${nextTools.length === 1 ? '' : 's'}.`,
    );
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

  const processScannedValue = (rawValue: string): ScanOutcome => {
    const payload = parseIsivoltQr(rawValue);
    const activeTechnician = technicianRef.current;

    if (!activeTechnician) {
      if (payload.type !== 'technician') {
        const message = 'Primero debes identificar la tarjeta o el QR del técnico.';
        setScannerMessage(message);
        return { accepted: false, title: 'Falta el técnico', message, tone: 'error' };
      }

      const foundTechnician = findTechnician(sessionData, payload.code);
      const accepted = foundTechnician ? selectTechnician(foundTechnician.id) : false;
      const message = accepted && foundTechnician
        ? `${foundTechnician.name} identificado. Escanea ahora las herramientas sin cerrar la cámara.`
        : 'La tarjeta o el código no pertenecen a ningún técnico activo.';
      return {
        accepted,
        title: accepted && foundTechnician ? `Técnico: ${foundTechnician.name}` : 'Técnico no reconocido',
        message,
        tone: accepted ? 'success' : 'error',
      };
    }

    if (payload.type === 'technician') {
      const foundTechnician = findTechnician(sessionData, payload.code);
      const sameTechnician = foundTechnician?.id === activeTechnician.id;
      const message = sameTechnician
        ? `${activeTechnician.name} ya está identificado. Escanea una herramienta.`
        : 'Ya hay un técnico activo. Cierra la cámara antes de cambiarlo.';
      setScannerMessage(message);
      return {
        accepted: false,
        title: `Técnico: ${activeTechnician.name}`,
        message,
        tone: sameTechnician ? 'warning' : 'error',
      };
    }

    if (payload.type === 'unknown') {
      const message = 'El código leído no está vinculado a ninguna herramienta.';
      setScannerMessage(message);
      return { accepted: false, title: `Técnico: ${activeTechnician.name}`, message, tone: 'error' };
    }

    const foundTool = findTool(sessionData, payload.code, payload.raw);
    if (!foundTool) {
      const message = `No existe ninguna herramienta registrada con el código ${payload.code}.`;
      setScannerMessage(message);
      return { accepted: false, title: `Técnico: ${activeTechnician.name}`, message, tone: 'error' };
    }

    const accepted = addToolToOperation(foundTool);
    const count = toolsRef.current.length;
    const message = accepted
      ? `${foundTool.name} añadida. ${count} herramienta${count === 1 ? '' : 's'} preparada${count === 1 ? '' : 's'}.`
      : `${foundTool.name} no se ha añadido. Revisa el aviso mostrado.`;
    return {
      accepted,
      title: `Técnico: ${activeTechnician.name} · ${count} herramienta${count === 1 ? '' : 's'}`,
      message,
      tone: accepted ? 'success' : 'error',
    };
  };

  const handleScan = async () => {
    if (scanning || nfcScanning || savingRef.current) return;
    setScanning(true);
    setScannerMessage(
      technicianRef.current
        ? 'Abriendo cámara continua para herramientas…'
        : 'Abriendo cámara para identificar primero al técnico…',
    );

    const result = await scanQrCode({
      autoStart: true,
      continuous: true,
      duplicateCooldownMs: 1_600,
      title: technicianRef.current
        ? `Técnico: ${technicianRef.current.name}`
        : 'Identifica primero al técnico',
      instruction: 'Una sola sesión: identifica al técnico y continúa escaneando herramientas. Cierra la cámara cuando termines.',
      manualLabel: technicianRef.current ? 'Añadir herramienta manualmente' : 'Elegir técnico manualmente',
      onDetected: async (value) => {
        const outcome = processScannedValue(value);
        return {
          action: 'continue',
          title: technicianRef.current
            ? `Técnico: ${technicianRef.current.name} · ${toolsRef.current.length} herramienta${toolsRef.current.length === 1 ? '' : 's'}`
            : outcome.title,
          message: outcome.message,
          tone: outcome.tone,
        };
      },
    });
    setScanning(false);

    if (result.status === 'manual-requested') {
      if (technicianRef.current) {
        setToolSelectorOpen(true);
        setScannerMessage('Cámara cerrada. Añade una herramienta mediante búsqueda manual.');
      } else {
        setSelectorOpen(true);
        setScannerMessage('Cámara cerrada. Selecciona primero al técnico manualmente.');
      }
      return;
    }

    if (result.status === 'completed' || result.status === 'cancelled') {
      setScannerMessage(
        technicianRef.current
          ? `${technicianRef.current.name}: ${toolsRef.current.length} herramienta${toolsRef.current.length === 1 ? '' : 's'} preparada${toolsRef.current.length === 1 ? '' : 's'}. Puedes revisar o añadir manualmente.`
          : 'Cámara cerrada. Identifica al técnico con cámara o selección manual.',
      );
      return;
    }

    if (result.status === 'success') {
      const outcome = processScannedValue(result.value);
      setScannerMessage(outcome.message);
      return;
    }

    setScannerMessage(result.message);
  };

  const handleNfcScan = async () => {
    if (scanning || nfcScanning || savingRef.current) return;
    setNfcScanning(true);
    setScannerMessage('Acerca la tarjeta o la pegatina NFC a la parte trasera del teléfono…');

    const result = await scanNfcTag();
    setNfcScanning(false);

    if (result.status === 'cancelled') {
      setScannerMessage('Lectura NFC cancelada o agotó el tiempo.');
      return;
    }
    if (result.status !== 'success') {
      setScannerMessage(result.message);
      return;
    }

    const uid = normalizeNfcUid(result.tag.uid);
    const foundTechnician = findTechnicianByNfc(sessionData, uid);
    const foundTool = findToolByNfc(sessionData, uid);

    if (foundTechnician && foundTool) {
      setScannerMessage('Este UID NFC está duplicado. Corrige la vinculación en Administración > NFC.');
      return;
    }
    if (foundTechnician) {
      selectTechnician(foundTechnician.id);
      return;
    }
    if (foundTool) {
      addToolToOperation(foundTool);
      return;
    }

    setScannerMessage(`NFC ${uid} sin vincular. Regístralo desde Administración > NFC.`);
  };

  const removeTool = (toolId: string) => {
    if (savingRef.current) return;
    const nextTools = toolsRef.current.filter((tool) => tool.id !== toolId);
    toolsRef.current = nextTools;
    setTools(nextTools);
    setReturnConditions((current) => {
      const { [toolId]: removed, ...remaining } = current;
      void removed;
      return remaining;
    });
    setAccessoryChecks((current) => {
      const { [toolId]: removed, ...remaining } = current;
      void removed;
      return remaining;
    });
  };

  const applyConditionToAll = (nextCondition: ReturnCondition) => {
    if (savingRef.current) return;
    setCondition(nextCondition);
    setReturnConditions(buildReturnConditions(toolsRef.current, nextCondition));
  };

  const updateToolCondition = (toolId: string, nextCondition: ReturnCondition) => {
    if (savingRef.current) return;
    setReturnConditions((current) => ({ ...current, [toolId]: nextCondition }));
  };

  const updateAccessoryCondition = (
    toolId: string,
    accessoryId: string,
    nextCondition: AccessoryCondition,
  ) => {
    if (savingRef.current) return;
    setAccessoryChecks((current) => ({
      ...current,
      [toolId]: {
        ...(current[toolId] ?? {}),
        [accessoryId]: nextCondition,
      },
    }));
  };

  const openReview = () => {
    if (savingRef.current) return;
    if (!technicianRef.current) {
      setScannerMessage('Selecciona primero al técnico responsable.');
      return;
    }
    if (toolsRef.current.length === 0) {
      setScannerMessage('Selecciona al menos una herramienta antes de revisar.');
      return;
    }

    if (mode === 'return') {
      setReturnConditions((current) => ({
        ...buildReturnConditions(toolsRef.current, condition),
        ...current,
      }));
    } else if (!expectedReturnAt) {
      setExpectedReturnAt(suggestedReturnDate(toolsRef.current));
    }
    setAccessoryChecks((current) => buildAccessoryChecks(sessionData, toolsRef.current, current));
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
        toolIds: toolsRef.current.map((tool) => tool.id),
        technicianId: technicianRef.current?.id,
        condition,
        returnConditions,
        accessoryChecks,
        expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt).toISOString() : undefined,
        workOrder,
        workLocation,
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
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setScannerMessage('Guardando la operación…');

    try {
      saveAppData(result.data);
      await waitForPendingAppDataWrites();
      setWorkflowOpen(false);
      const hasIncident = result.movements.some((movement) => movement.type === 'incident');
      setFeedback({
        title: mode === 'delivery' ? 'Préstamo completado' : 'Devolución completada',
        detail: `${result.movements.length} movimiento${result.movements.length === 1 ? '' : 's'} guardado${result.movements.length === 1 ? '' : 's'} · ${formatOperationDateTime(result.movements[0]?.occurredAt)}.`,
        tone: hasIncident ? 'warning' : 'success',
      });
      navigator.vibrate?.([60, 35, 100]);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'No se ha podido confirmar el guardado.';
      setScannerMessage(`No se ha podido guardar la operación: ${detail}`);
      setFeedback({ title: 'Operación no guardada', detail, tone: 'error' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const nativeNfc = isNfcScannerAvailable();
  const canReview = !saving && Boolean(technician) && tools.length > 0;

  return (
    <>
      {workflowOpen && (
        <div className="native-scan-backdrop rc33-fast-scan-backdrop">
          <section
            className="native-scan-console rc33-fast-scan-console"
            role="dialog"
            aria-modal="true"
            aria-label="Flujo rápido de préstamo y devolución"
            aria-busy={saving}
          >
            <button
              className="native-scan-close"
              onClick={requestCloseWorkflow}
              disabled={saving}
              aria-label="Cerrar flujo"
            >
              <X size={21} />
            </button>

            <header className="native-scan-header">
              <span className="native-scan-emblem"><ScanLine size={30} /></span>
              <div>
                <span><Zap size={14} /> Flujo rápido RC33</span>
                <h2>Préstamo y devolución</h2>
                <p>Primero técnico, después herramientas · cámara continua o selección manual.</p>
              </div>
            </header>

            {reviewing ? (
              <OperationReviewPanel
                mode={mode}
                operationId={operationId}
                technician={technician}
                tools={tools}
                accessories={sessionData.accessories ?? []}
                returnConditions={returnConditions}
                accessoryChecks={accessoryChecks}
                expectedReturnAt={expectedReturnAt}
                workOrder={workOrder}
                workLocation={workLocation}
                notes={notes}
                saving={saving}
                onConditionChange={updateToolCondition}
                onAccessoryConditionChange={updateAccessoryCondition}
                onExpectedReturnAtChange={setExpectedReturnAt}
                onWorkOrderChange={setWorkOrder}
                onWorkLocationChange={setWorkLocation}
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
                  <button
                    disabled={saving}
                    className={mode === 'delivery' ? 'active' : ''}
                    onClick={() => changeMode('delivery')}
                  >
                    <ArrowUpFromLine size={18} /> Préstamo
                  </button>
                  <button
                    disabled={saving}
                    className={mode === 'return' ? 'active' : ''}
                    onClick={() => changeMode('return')}
                  >
                    <ArrowDownToLine size={18} /> Devolución
                  </button>
                </div>

                <div className="native-progress-grid">
                  <article className={technician ? 'completed' : 'current'}>
                    <span><UserRound size={20} /></span>
                    <div><small>Paso 1</small><strong>{technician?.name ?? 'Identificar técnico'}</strong></div>
                    {technician && <Check size={19} />}
                  </article>
                  <article className={tools.length > 0 ? 'completed' : technician ? 'current' : ''}>
                    <span><Wrench size={20} /></span>
                    <div>
                      <small>Paso 2</small>
                      <strong>{tools.length ? `${tools.length} herramienta${tools.length === 1 ? '' : 's'}` : 'Identificar herramientas'}</strong>
                    </div>
                    {tools.length > 0 && <Check size={19} />}
                  </article>
                </div>

                <div className="native-scan-methods">
                  <button
                    className="native-camera-button"
                    onClick={() => { void handleScan(); }}
                    disabled={scanning || nfcScanning || saving}
                  >
                    <QrCode size={28} />
                    <strong>{scanning ? 'Cámara activa…' : technician ? 'Escaneo continuo de herramientas' : 'Escanear técnico y herramientas'}</strong>
                  </button>
                  <button
                    className="native-nfc-button"
                    onClick={() => { void handleNfcScan(); }}
                    disabled={scanning || nfcScanning || saving || !nativeNfc}
                  >
                    <ScanLine size={26} />
                    <strong>{nfcScanning ? 'Leyendo NFC…' : technician ? 'NFC herramienta' : 'NFC técnico'}</strong>
                  </button>
                </div>

                <button
                  disabled={saving}
                  className="native-manual-primary"
                  type="button"
                  onClick={() => technician ? setToolSelectorOpen(true) : setSelectorOpen(true)}
                >
                  <ListFilter size={20} />
                  <span>
                    <strong>{technician ? 'Añadir herramienta manualmente' : 'Elegir técnico manualmente'}</strong>
                    <small>{technician ? 'Nombre, código, categoría, ubicación o marca' : 'Nombre, código, tarjeta o especialidad'}</small>
                  </span>
                </button>

                <div className="native-scanner-message">
                  {scannerMessage.includes('no ')
                    || scannerMessage.includes('No ')
                    || scannerMessage.includes('Falta')
                    ? <AlertTriangle size={17} />
                    : scanning || saving
                      ? <LoaderCircle className="boot-spin" size={17} />
                      : <Zap size={17} />}
                  <span>{scannerMessage}</span>
                </div>

                {tools.length > 0 && (
                  <div className="native-scanned-tools">
                    {tools.map((tool) => (
                      <button disabled={saving} key={tool.id} onClick={() => removeTool(tool.id)}>
                        <Wrench size={15} />
                        <span><strong>{tool.name}</strong><small>{tool.code}</small></span>
                        <X size={15} />
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'return' && tools.length > 0 && (
                  <div className="native-condition-grid" aria-label="Aplicar estado inicial a todas">
                    {([
                      ['ok', 'Correctas', Check],
                      ['review', 'Revisión', RotateCcw],
                      ['damaged', 'Averiadas', AlertTriangle],
                    ] as const).map(([value, label, Icon]) => (
                      <button
                        disabled={saving}
                        key={value}
                        className={condition === value ? 'active' : ''}
                        onClick={() => applyConditionToAll(value)}
                      >
                        <Icon size={17} /> {label}
                      </button>
                    ))}
                  </div>
                )}

                <label className="native-notes-field">
                  Observaciones iniciales
                  <textarea
                    disabled={saving}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    placeholder="Información del préstamo o incidencia…"
                  />
                </label>

                <footer className="native-scan-footer">
                  <span>{saving ? 'Guardando…' : `${tools.length} herramienta${tools.length === 1 ? '' : 's'} preparada${tools.length === 1 ? '' : 's'}`}</span>
                  <button disabled={!canReview} onClick={openReview}>
                    <Check size={19} /> Revisar {mode === 'delivery' ? 'préstamo' : 'devolución'}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}

      {scanAlert && (
        <div className="native-tool-alert-backdrop" onClick={() => setScanAlert(null)}>
          <section className="native-tool-alert" onClick={(event) => event.stopPropagation()}>
            <span className="native-tool-alert-icon"><AlertTriangle size={34} /></span>
            <small>Operación bloqueada</small>
            <h2>{scanAlert.title}</h2>
            <strong>{scanAlert.tool.code} · {scanAlert.tool.name}</strong>
            <p>{scanAlert.detail}</p>
            <button type="button" onClick={() => setScanAlert(null)}><X size={18} /> Entendido</button>
          </section>
        </div>
      )}

      {feedback && (
        <div className={`native-feedback native-feedback-${feedback.tone}`}>
          {feedback.tone === 'success' ? <Check size={21} /> : <AlertTriangle size={21} />}
          <span><strong>{feedback.title}</strong><small>{feedback.detail}</small></span>
        </div>
      )}
    </>
  );
}
