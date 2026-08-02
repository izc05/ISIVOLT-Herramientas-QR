import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  History,
  Keyboard,
  Nfc,
  PackageCheck,
  PackagePlus,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { loadData, saveData, WORKSPACE_DATA_EVENT } from '../storage';
import type {
  AppData,
  BatchOperation,
  BatchTransaction,
  IdentificationMethod,
  OperatorMode,
  ScanMethod,
  Technician,
  Tool,
} from '../types';
import {
  clearScanDraft,
  loadScanDraft,
  saveScanDraft,
  scanDraftIsMeaningful,
  type ScanDraft,
} from './scanDraft';

export const SCAN_SESSION_EVENT = 'isivoltpro-v2:open-scan-session';

type ScanTarget = 'technician' | 'tool';
type SessionStep = 'setup' | 'technician' | 'items' | 'review' | 'complete';
type QuickToolDraft = { code: string; name: string; categoryId: string; locationId: string };

type ScanSessionRequest = {
  operation?: BatchOperation;
  mode?: OperatorMode;
  technicianId?: string;
  identificationMethod?: IdentificationMethod;
  startAt?: Exclude<SessionStep, 'complete'>;
};

type BarcodeDetectorInstance = {
  detect(source: unknown): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

type NdefRecord = { data?: DataView; encoding?: string };
type NdefReadingEvent = { serialNumber?: string; message?: { records?: NdefRecord[] } };
type NdefReaderInstance = {
  scan(): Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
};
type NdefReaderConstructor = new () => NdefReaderInstance;

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now = () => new Date().toISOString();
const technicianPayload = (technician: Technician) => technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;
const toolPayloadCode = (value: string) => value.trim().startsWith('ISIVOLTPRO:TOOL:')
  ? value.trim().split(':').at(-1) ?? ''
  : value.trim();

const operationCopy: Record<BatchOperation, { title: string; verb: string; done: string }> = {
  loan: { title: 'Préstamo por escaneo', verb: 'prestar', done: 'Préstamo registrado' },
  return: { title: 'Devolución por escaneo', verb: 'devolver', done: 'Devolución registrada' },
};

const decodeRecord = (record?: NdefRecord): string => {
  if (!record?.data) return '';
  const bytes = new Uint8Array(record.data.buffer, record.data.byteOffset, record.data.byteLength);
  return new TextDecoder(record.encoding || 'utf-8').decode(bytes).replace(/^\u0002[a-z]{2}/i, '').trim();
};

const getScanMethod = (methods: Set<Exclude<ScanMethod, 'mixed'>>): ScanMethod => {
  if (methods.size === 0) return 'manual';
  if (methods.size === 1) return [...methods][0];
  return 'mixed';
};

export default function ScanSession() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadData());
  const [step, setStep] = useState<SessionStep>('setup');
  const [operation, setOperation] = useState<BatchOperation>('loan');
  const [operatorMode, setOperatorMode] = useState<OperatorMode>('administrator');
  const [technicianId, setTechnicianId] = useState('');
  const [identificationMethod, setIdentificationMethod] = useState<IdentificationMethod>('manual');
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [scanMethods, setScanMethods] = useState<Set<Exclude<ScanMethod, 'mixed'>>>(() => new Set());
  const [scanInput, setScanInput] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [message, setMessage] = useState('');
  const [cameraTarget, setCameraTarget] = useState<ScanTarget | null>(null);
  const [nfcWaiting, setNfcWaiting] = useState<ScanTarget | null>(null);
  const [completedBatch, setCompletedBatch] = useState<BatchTransaction | null>(null);
  const [startedAt, setStartedAt] = useState(now());
  const [recoveryDraft, setRecoveryDraft] = useState<ScanDraft | null>(null);
  const [quickTool, setQuickTool] = useState<QuickToolDraft | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingRequestRef = useRef<ScanSessionRequest>({});
  const scanHandlerRef = useRef<(value: string, target: ScanTarget, method: Exclude<ScanMethod, 'mixed'>) => void>(() => undefined);

  const activeTechnicians = useMemo(() => data.technicians.filter((technician) => technician.active), [data.technicians]);
  const selectedTechnician = data.technicians.find((technician) => technician.id === technicianId);
  const selectedTools = toolIds.map((id) => data.tools.find((tool) => tool.id === id)).filter((tool): tool is Tool => Boolean(tool));
  const activeCategories = useMemo(() => (data.toolCategories ?? []).filter((entry) => entry.active), [data.toolCategories]);
  const activeLocations = useMemo(() => (data.locations ?? []).filter((entry) => entry.active), [data.locations]);
  const authenticatedSelfService = operatorMode === 'self-service'
    && identificationMethod === 'authenticated'
    && Boolean(selectedTechnician);

  const eligibleManualTools = useMemo(() => {
    if (!selectedTechnician) return [];
    const query = manualSearch.trim().toLocaleLowerCase('es-ES');
    return data.tools
      .filter((tool) => !toolIds.includes(tool.id))
      .filter((tool) => operation === 'loan'
        ? tool.status === 'available'
        : tool.status === 'loaned' && tool.technicianId === selectedTechnician.id)
      .filter((tool) => !query || [tool.code, tool.name, tool.category, tool.location, tool.serialNumber ?? '']
        .some((value) => value.toLocaleLowerCase('es-ES').includes(query)))
      .slice(0, 12);
  }, [data.tools, manualSearch, operation, selectedTechnician, toolIds]);

  const reset = (request: ScanSessionRequest = {}) => {
    const snapshot = loadData();
    const requestedTechnician = request.technicianId
      ? snapshot.technicians.find((technician) => technician.id === request.technicianId && technician.active)
      : undefined;
    const requestedStep = request.startAt ?? 'setup';
    const safeStep = requestedStep === 'items' && !requestedTechnician ? 'technician' : requestedStep;

    setData(snapshot);
    setOperation(request.operation ?? 'loan');
    setOperatorMode(request.mode ?? 'administrator');
    setStep(safeStep);
    setTechnicianId(requestedTechnician?.id ?? '');
    setIdentificationMethod(requestedTechnician ? request.identificationMethod ?? 'authenticated' : 'manual');
    setToolIds([]);
    setScanMethods(new Set());
    setScanInput('');
    setManualSearch('');
    setMessage(requestedTechnician ? `${requestedTechnician.name} identificado mediante la cuenta.` : '');
    setCameraTarget(null);
    setNfcWaiting(null);
    setCompletedBatch(null);
    setRecoveryDraft(null);
    setQuickTool(null);
    setStartedAt(now());
  };

  const resumeDraft = (draft: ScanDraft) => {
    const snapshot = loadData();
    const technician = snapshot.technicians.find((item) => item.id === draft.technicianId && item.active);
    if (!technician) {
      clearScanDraft();
      setRecoveryDraft(null);
      reset(pendingRequestRef.current);
      setMessage('El borrador no pudo recuperarse porque el técnico ya no está activo.');
      return;
    }
    const validToolIds = draft.toolIds.filter((id) => {
      const tool = snapshot.tools.find((item) => item.id === id);
      if (!tool) return false;
      return draft.operation === 'loan'
        ? tool.status === 'available'
        : tool.status === 'loaned' && tool.technicianId === technician.id;
    });
    setData(snapshot);
    setOperation(draft.operation);
    setOperatorMode(draft.operatorMode);
    setTechnicianId(technician.id);
    setIdentificationMethod(draft.identificationMethod);
    setToolIds(validToolIds);
    setScanMethods(new Set(draft.scanMethods));
    setStartedAt(draft.startedAt);
    setStep('items');
    setRecoveryDraft(null);
    setCompletedBatch(null);
    setMessage(`Sesión recuperada: ${validToolIds.length} artículo${validToolIds.length === 1 ? '' : 's'} pendiente${validToolIds.length === 1 ? '' : 's'}.`);
  };

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<ScanSessionRequest>).detail ?? {};
      pendingRequestRef.current = detail;
      const draft = loadScanDraft();
      setData(loadData());
      if (draft && scanDraftIsMeaningful(draft)) setRecoveryDraft(draft);
      else reset(detail);
      setOpen(true);
    };
    const handleDataChange = (event: Event) => setData((event as CustomEvent<AppData>).detail ?? loadData());
    window.addEventListener(SCAN_SESSION_EVENT, handleOpen);
    window.addEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
    return () => {
      window.removeEventListener(SCAN_SESSION_EVENT, handleOpen);
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
    };
  }, []);

  useEffect(() => {
    if (!open) setCameraTarget(null);
  }, [open]);

  useEffect(() => {
    if (!open || recoveryDraft || step === 'complete') return;
    const draft = {
      operation,
      operatorMode,
      technicianId,
      identificationMethod,
      toolIds,
      scanMethods: [...scanMethods],
      startedAt,
    };
    if (scanDraftIsMeaningful(draft)) saveScanDraft(draft);
  }, [identificationMethod, open, operation, operatorMode, recoveryDraft, scanMethods, startedAt, step, technicianId, toolIds]);

  const identifyTechnician = (value: string, method: IdentificationMethod): boolean => {
    const normalized = value.trim();
    const payloadCode = normalized.startsWith('ISIVOLTPRO:TECH:') ? normalized.split(':').at(-1) : undefined;
    const technician = activeTechnicians.find((item) =>
      item.code === normalized
      || item.code === payloadCode
      || technicianPayload(item) === normalized
      || item.nfcTag === normalized,
    );
    if (!technician) {
      setMessage('No se ha encontrado un técnico activo con ese QR, código o NFC.');
      return false;
    }
    setTechnicianId(technician.id);
    setIdentificationMethod(method);
    setMessage(`${technician.name} identificado correctamente.`);
    return true;
  };

  const findTool = (value: string): Tool | undefined => {
    const normalized = value.trim();
    const payloadCode = toolPayloadCode(normalized);
    return data.tools.find((item) =>
      item.code.toLocaleUpperCase('es-ES') === payloadCode.toLocaleUpperCase('es-ES')
      || item.qrPayload === normalized
      || item.nfcTag === normalized,
    );
  };

  const addExistingTool = (tool: Tool, method: Exclude<ScanMethod, 'mixed'>): boolean => {
    if (!selectedTechnician) {
      setMessage('Primero debes identificar al técnico.');
      return false;
    }
    if (toolIds.includes(tool.id)) {
      setMessage(`${tool.name} ya está incluido en esta operación.`);
      return false;
    }
    if (operation === 'loan' && tool.status !== 'available') {
      setMessage(`${tool.name} no está disponible para préstamo.`);
      return false;
    }
    if (operation === 'return' && (tool.status !== 'loaned' || tool.technicianId !== selectedTechnician.id)) {
      setMessage(`${tool.name} no figura prestado a ${selectedTechnician.name}.`);
      return false;
    }
    setToolIds((current) => [...current, tool.id]);
    setScanMethods((current) => new Set(current).add(method));
    setMessage(`${tool.code} · ${tool.name} añadido.`);
    return true;
  };

  const addTool = (value: string, method: Exclude<ScanMethod, 'mixed'>): boolean => {
    const tool = findTool(value);
    if (!tool) {
      const code = toolPayloadCode(value).trim().toLocaleUpperCase('es-ES');
      if (operation === 'loan' && code) {
        setQuickTool({ code, name: '', categoryId: activeCategories[0]?.id ?? '', locationId: '' });
        setMessage(`El código ${code} no está registrado. Puedes crear el artículo sin perder el lote.`);
      } else {
        setMessage('No se ha encontrado ningún artículo con ese QR, código o NFC.');
      }
      return false;
    }
    return addExistingTool(tool, method);
  };

  const handleScannedValue = (value: string, target: ScanTarget, method: Exclude<ScanMethod, 'mixed'>) => {
    const accepted = target === 'technician'
      ? identifyTechnician(value, method === 'manual' ? 'manual' : method)
      : addTool(value, method);
    if (accepted) {
      setScanInput('');
      if (target === 'technician') setCameraTarget(null);
    }
  };
  scanHandlerRef.current = handleScannedValue;

  useEffect(() => {
    if (!cameraTarget || !open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const start = async () => {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        setMessage('La cámara QR no está disponible en este navegador. Puedes introducir el código manualmente.');
        setCameraTarget(null);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!videoRef.current || cancelled) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['qr_code'] });
        const inspect = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) {
              scanHandlerRef.current(raw, cameraTarget, 'qr');
              setCameraTarget(null);
              return;
            }
          } catch {
            // La cámara seguirá intentando mientras la ventana permanezca abierta.
          }
          timer = window.setTimeout(inspect, 350);
        };
        void inspect();
      } catch {
        setMessage('No se ha podido abrir la cámara. Revisa los permisos del navegador.');
        setCameraTarget(null);
      }
    };
    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraTarget, open]);

  const readNfc = async (target: ScanTarget) => {
    const Reader = (window as unknown as { NDEFReader?: NdefReaderConstructor }).NDEFReader;
    if (!Reader) {
      setMessage('La lectura NFC web requiere Android y un navegador compatible. Puedes usar QR o código manual.');
      return;
    }
    setNfcWaiting(target);
    setMessage('Acerca la tarjeta o etiqueta NFC al teléfono.');
    try {
      const reader = new Reader();
      reader.onreading = (event) => {
        const payload = decodeRecord(event.message?.records?.[0]) || event.serialNumber || '';
        if (payload) scanHandlerRef.current(payload, target, 'nfc');
        else setMessage('La etiqueta NFC no contiene un identificador reconocible.');
        setNfcWaiting(null);
      };
      reader.onreadingerror = () => {
        setMessage('No se ha podido leer la etiqueta NFC.');
        setNfcWaiting(null);
      };
      await reader.scan();
    } catch {
      setMessage('No se ha podido iniciar la lectura NFC. Comprueba permisos y compatibilidad.');
      setNfcWaiting(null);
    }
  };

  const saveQuickTool = () => {
    if (!quickTool || !selectedTechnician) return;
    const code = quickTool.code.trim().toLocaleUpperCase('es-ES');
    const name = quickTool.name.trim();
    const category = activeCategories.find((entry) => entry.id === quickTool.categoryId);
    const location = activeLocations.find((entry) => entry.id === quickTool.locationId);
    if (!code || !name || !category) {
      setMessage('Código, nombre y categoría son obligatorios para registrar el artículo.');
      return;
    }
    if (data.tools.some((tool) => tool.code.toLocaleUpperCase('es-ES') === code)) {
      setMessage(`El código ${code} ya está registrado.`);
      return;
    }
    const timestamp = now();
    const tool: Tool = {
      id: uid('tool'),
      code,
      name,
      category: category.name,
      categoryId: category.id,
      location: location?.name ?? 'Sin ubicación',
      locationId: location?.id,
      kind: 'returnable-tool',
      serviceState: 'ready',
      qrPayload: `ISIVOLTPRO:TOOL:${code}`,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const nextData = { ...data, tools: [tool, ...data.tools] };
    saveData(nextData);
    setData(nextData);
    setToolIds((current) => [...current, tool.id]);
    setScanMethods((current) => new Set(current).add('manual'));
    setQuickTool(null);
    setScanInput('');
    setMessage(`${tool.code} · ${tool.name} registrado y añadido.`);
  };

  const finish = () => {
    if (!selectedTechnician || selectedTools.length === 0) return;
    const completedAt = now();
    const batchId = uid('batch');
    const scanMethod = getScanMethod(scanMethods);
    const batch: BatchTransaction = {
      id: batchId,
      operation,
      technicianId: selectedTechnician.id,
      toolIds: selectedTools.map((tool) => tool.id),
      operatorMode,
      identificationMethod,
      scanMethod,
      startedAt,
      completedAt,
    };
    const nextData: AppData = {
      ...data,
      tools: data.tools.map((tool) => {
        if (!toolIds.includes(tool.id)) return tool;
        return operation === 'loan'
          ? { ...tool, status: 'loaned', technicianId: selectedTechnician.id, updatedAt: completedAt }
          : { ...tool, status: 'available', technicianId: undefined, updatedAt: completedAt };
      }),
      movements: [
        ...selectedTools.map((tool) => ({
          id: uid('mov'),
          type: operation,
          occurredAt: completedAt,
          toolId: tool.id,
          technicianId: selectedTechnician.id,
          batchId,
          identificationMethod,
          scanMethod,
          detail: operation === 'loan'
            ? `${tool.name} asignada a ${selectedTechnician.name}`
            : `${tool.name} devuelta por ${selectedTechnician.name}`,
        } as const)),
        ...data.movements,
      ],
      batches: [batch, ...data.batches],
    };
    saveData(nextData);
    clearScanDraft();
    setData(nextData);
    setCompletedBatch(batch);
    setStep('complete');
    setMessage(operationCopy[operation].done);
  };

  const copyReceipt = async () => {
    if (!completedBatch || !selectedTechnician) return;
    const lines = [
      `IsiVoltPro · ${operation === 'loan' ? 'Préstamo' : 'Devolución'}`,
      `Técnico: ${selectedTechnician.name} (${selectedTechnician.code})`,
      `Fecha: ${new Date(completedBatch.completedAt).toLocaleString('es-ES')}`,
      `Lote: ${completedBatch.id}`,
      ...selectedTools.map((tool) => `- ${tool.code} · ${tool.name}`),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setMessage('Comprobante copiado.');
  };

  const removeTool = (toolId: string) => setToolIds((current) => current.filter((id) => id !== toolId));
  const close = () => {
    setOpen(false);
    setCameraTarget(null);
    setNfcWaiting(null);
  };
  const discardRecovery = () => {
    clearScanDraft();
    setRecoveryDraft(null);
    reset(pendingRequestRef.current);
  };
  const discardCurrent = () => {
    clearScanDraft();
    reset(pendingRequestRef.current);
    setMessage('Operación pendiente descartada.');
  };

  const goBack = () => {
    if (step === 'setup') close();
    else if (step === 'technician') setStep('setup');
    else if (step === 'items') {
      if (authenticatedSelfService) close();
      else setStep('technician');
    } else setStep('items');
  };

  const startAnotherOperation = () => {
    clearScanDraft();
    if (authenticatedSelfService && selectedTechnician) {
      reset({ operation, mode: 'self-service', technicianId: selectedTechnician.id, identificationMethod: 'authenticated', startAt: 'items' });
      return;
    }
    reset({ operation, mode: operatorMode, startAt: 'technician' });
  };

  if (!open) return null;

  return createPortal(
    <div className="scan-session-backdrop">
      <section className="scan-session" role="dialog" aria-modal="true" aria-label="Operación por escaneo">
        <header className="scan-session-header">
          <div className="scan-session-brand"><span>ϟ</span><div><strong>IsiVoltPro</strong><small>Herramientas · QR/NFC</small></div></div>
          <div className="scan-session-title"><ScanLine size={21} /><div><strong>{operationCopy[operation].title}</strong><small>{operatorMode === 'administrator' ? 'Operación gestionada por administrador' : 'Autoservicio del técnico'}</small></div></div>
          <button type="button" onClick={close} aria-label="Cerrar"><X size={21} /></button>
        </header>

        {!recoveryDraft && <div className="scan-progress" aria-label="Progreso de la operación">
          {[
            ['setup', 'Operación'],
            ['technician', 'Técnico'],
            ['items', 'Material'],
            ['review', 'Confirmar'],
          ].map(([id, label], index) => {
            const order = ['setup', 'technician', 'items', 'review', 'complete'];
            const activeIndex = order.indexOf(step);
            return <span key={id} className={activeIndex >= index ? 'active' : ''}><i>{activeIndex > index ? <Check size={14} /> : index + 1}</i>{label}</span>;
          })}
        </div>}

        <main className="scan-session-body">
          {recoveryDraft ? (
            <div className="scan-recovery-screen">
              <span><History size={40} /></span>
              <small>OPERACIÓN SIN FINALIZAR</small>
              <h2>Tienes un lote pendiente</h2>
              <p>Se guardó automáticamente para que no pierdas los artículos escaneados al cerrar o recargar la aplicación.</p>
              <dl>
                <div><dt>Operación</dt><dd>{recoveryDraft.operation === 'loan' ? 'Préstamo' : 'Devolución parcial'}</dd></div>
                <div><dt>Artículos</dt><dd>{recoveryDraft.toolIds.length}</dd></div>
                <div><dt>Guardado</dt><dd>{new Date(recoveryDraft.savedAt).toLocaleString('es-ES')}</dd></div>
              </dl>
              <div><button type="button" onClick={discardRecovery}><Trash2 size={18} /> Descartar</button><button className="primary" type="button" onClick={() => resumeDraft(recoveryDraft)}><History size={18} /> Continuar lote</button></div>
            </div>
          ) : (
            <>
              {step === 'setup' && (
                <div className="scan-choice-screen">
                  <div className="scan-intro"><span><PackageCheck size={32} /></span><h2>¿Qué operación vas a realizar?</h2><p>Identifica al técnico, añade todos los artículos y confirma el lote una sola vez.</p></div>
                  <div className="scan-choice-grid">
                    <button className={operation === 'loan' ? 'selected' : ''} type="button" onClick={() => setOperation('loan')}><ArrowUpFromLine size={26} /><strong>Préstamo</strong><small>Salida de herramientas o material</small></button>
                    <button className={operation === 'return' ? 'selected' : ''} type="button" onClick={() => setOperation('return')}><ArrowDownToLine size={26} /><strong>Devolución</strong><small>Permite devolver solo parte del material</small></button>
                  </div>
                  <h3>Modo de trabajo</h3>
                  <div className="scan-choice-grid mode">
                    <button className={operatorMode === 'administrator' ? 'selected' : ''} type="button" onClick={() => setOperatorMode('administrator')}><ShieldCheck size={24} /><strong>Administrador</strong><small>Escanea primero al técnico y después el material</small></button>
                    <button className={operatorMode === 'self-service' ? 'selected' : ''} type="button" onClick={() => setOperatorMode('self-service')}><Smartphone size={24} /><strong>Técnico</strong><small>Registra su propia operación</small></button>
                  </div>
                </div>
              )}

              {step === 'technician' && (
                <div className="scan-identify-screen">
                  <div className="scan-step-heading"><span><UserCheck size={25} /></span><div><h2>Identificar al técnico</h2><p>Escanea su QR, lee su NFC o selecciónalo manualmente.</p></div></div>
                  <div className="scan-input-card">
                    <label>Código, QR o identificador NFC</label>
                    <div className="scan-input-row"><Keyboard size={19} /><input autoFocus value={scanInput} onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleScannedValue(scanInput, 'technician', 'manual'); }} placeholder="Ej. TEC-001" /><button type="button" onClick={() => handleScannedValue(scanInput, 'technician', 'manual')}>Identificar</button></div>
                    <div className="scan-device-actions"><button type="button" onClick={() => setCameraTarget('technician')}><Camera size={18} /> Escanear QR</button><button type="button" onClick={() => void readNfc('technician')} className={nfcWaiting === 'technician' ? 'waiting' : ''}><Nfc size={18} /> {nfcWaiting === 'technician' ? 'Acerca el NFC…' : 'Leer NFC'}</button></div>
                  </div>
                  <div className="scan-manual-select"><label>Selección manual<select value={technicianId} onChange={(event) => { setTechnicianId(event.target.value); setIdentificationMethod('manual'); setMessage('Técnico seleccionado manualmente.'); }}><option value="">Selecciona un técnico</option>{activeTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.code} · {technician.name}</option>)}</select></label></div>
                  {selectedTechnician && <div className="technician-credential"><QRCodeSVG value={technicianPayload(selectedTechnician)} size={116} level="H" includeMargin /><div><small>CREDENCIAL PERSONAL</small><strong>{selectedTechnician.name}</strong><p>{selectedTechnician.code} · {selectedTechnician.category}</p><code>{technicianPayload(selectedTechnician)}</code></div></div>}
                </div>
              )}

              {step === 'items' && (
                <div className="scan-items-screen">
                  <div className="scan-step-heading"><span><QrCode size={25} /></span><div><h2>Escanear material</h2><p>{selectedTechnician?.name} · el lote se guarda automáticamente.</p></div><strong>{selectedTools.length}</strong></div>
                  <div className="scan-input-card compact"><label>Código, QR o identificador NFC del artículo</label><div className="scan-input-row"><ScanLine size={19} /><input autoFocus value={scanInput} onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleScannedValue(scanInput, 'tool', 'manual'); }} placeholder="Ej. ELE-001" /><button type="button" onClick={() => handleScannedValue(scanInput, 'tool', 'manual')}>Añadir</button></div><div className="scan-device-actions"><button type="button" onClick={() => setCameraTarget('tool')}><Camera size={18} /> Escanear QR</button><button type="button" onClick={() => void readNfc('tool')} className={nfcWaiting === 'tool' ? 'waiting' : ''}><Nfc size={18} /> {nfcWaiting === 'tool' ? 'Acerca el NFC…' : 'Leer NFC'}</button></div></div>

                  <details className="scan-manual-browser">
                    <summary><Search size={18} /> Añadir manualmente desde el inventario</summary>
                    <div className="scan-manual-search"><Search size={18} /><input value={manualSearch} onChange={(event) => setManualSearch(event.target.value)} placeholder="Código, nombre, categoría, ubicación o serie" /></div>
                    <div className="scan-manual-results">
                      {eligibleManualTools.length === 0 ? <p>No hay artículos disponibles que coincidan.</p> : eligibleManualTools.map((tool) => <button key={tool.id} type="button" onClick={() => addExistingTool(tool, 'manual')}><span><strong>{tool.code} · {tool.name}</strong><small>{tool.category} · {tool.location}</small></span><Check size={17} /></button>)}
                    </div>
                  </details>

                  {selectedTools.length === 0 ? <div className="scan-empty-list"><ScanLine size={31} /><strong>Escanea el primer artículo</strong><p>Puedes combinar QR, NFC y selección manual antes de finalizar.</p></div> : <div className="scan-tool-list">{selectedTools.map((tool, index) => <article key={tool.id}><span>{index + 1}</span><div><strong>{tool.name}</strong><small>{tool.code} · {tool.category}</small></div><em>{operation === 'loan' ? 'SALIDA' : 'ENTRADA'}</em><button type="button" onClick={() => removeTool(tool.id)} aria-label={`Quitar ${tool.name}`}><Trash2 size={17} /></button></article>)}</div>}
                  <button className="scan-discard-draft" type="button" onClick={discardCurrent}><Trash2 size={16} /> Descartar lote pendiente</button>
                </div>
              )}

              {step === 'review' && selectedTechnician && (
                <div className="scan-review-screen"><div className="scan-review-hero"><span>{operation === 'loan' ? <ArrowUpFromLine size={30} /> : <ArrowDownToLine size={30} />}</span><div><small>REVISAR OPERACIÓN</small><h2>{operation === 'loan' ? 'Salida de material' : 'Devolución de material'}</h2><p>{operation === 'return' ? 'Solo se devolverán los artículos incluidos; el resto seguirá asignado.' : 'Comprueba los datos antes de registrar el lote completo.'}</p></div></div><dl><div><dt>Técnico</dt><dd>{selectedTechnician.name}<small>{selectedTechnician.code}</small></dd></div><div><dt>Modo</dt><dd>{operatorMode === 'administrator' ? 'Administrador' : 'Autoservicio'}</dd></div><div><dt>Identificación</dt><dd>{identificationMethod.toUpperCase()}</dd></div><div><dt>Artículos</dt><dd>{selectedTools.length}</dd></div></dl><div className="scan-review-tools">{selectedTools.map((tool) => <span key={tool.id}><CheckCircle2 size={16} /> {tool.code} · {tool.name}</span>)}</div></div>
              )}

              {step === 'complete' && selectedTechnician && completedBatch && (
                <div className="scan-complete-screen scan-receipt"><span><CheckCircle2 size={48} /></span><small>COMPROBANTE DE OPERACIÓN</small><h2>{operationCopy[operation].done}</h2><p>{selectedTools.length} artículo{selectedTools.length === 1 ? '' : 's'} · {selectedTechnician.name}</p><dl><div><dt>Fecha</dt><dd>{new Date(completedBatch.completedAt).toLocaleString('es-ES')}</dd></div><div><dt>Lote</dt><dd>{completedBatch.id}</dd></div></dl><div className="scan-receipt-tools">{selectedTools.map((tool) => <span key={tool.id}>{tool.code} · {tool.name}</span>)}</div><div><button type="button" onClick={() => void copyReceipt()}><ClipboardCheck size={18} /> Copiar comprobante</button><button type="button" onClick={startAnotherOperation}><RotateCcw size={18} /> Nueva operación</button><button className="primary" type="button" onClick={close}>Finalizar</button></div></div>
              )}
            </>
          )}

          {quickTool && <div className="scan-quick-tool-backdrop" role="presentation"><section className="scan-quick-tool" role="dialog" aria-modal="true" aria-label="Registrar artículo rápidamente"><header><div><PackagePlus size={24} /><div><small>ALTA SIN SALIR DEL LOTE</small><h3>Registrar nuevo artículo</h3></div></div><button type="button" onClick={() => setQuickTool(null)} aria-label="Cerrar"><X size={19} /></button></header><p>Se añadirá como herramienta retornable y disponible. Podrás completar fotos, marca y mantenimiento desde Gestionar → Fichas.</p><div><label>Código<input value={quickTool.code} onChange={(event) => setQuickTool({ ...quickTool, code: event.target.value })} /></label><label>Nombre<input autoFocus value={quickTool.name} onChange={(event) => setQuickTool({ ...quickTool, name: event.target.value })} /></label><label>Categoría<select value={quickTool.categoryId} onChange={(event) => setQuickTool({ ...quickTool, categoryId: event.target.value })}><option value="">Selecciona categoría</option>{activeCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Ubicación<select value={quickTool.locationId} onChange={(event) => setQuickTool({ ...quickTool, locationId: event.target.value })}><option value="">Sin ubicación</option>{activeLocations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div><footer><button type="button" onClick={() => setQuickTool(null)}>Cancelar</button><button className="primary" type="button" onClick={saveQuickTool}><PackagePlus size={18} /> Registrar y añadir</button></footer></section></div>}

          {cameraTarget && <div className="scan-camera"><video ref={videoRef} playsInline muted /><div><ScanLine size={40} /><p>Coloca el QR dentro del recuadro</p></div><button type="button" onClick={() => setCameraTarget(null)}><X size={19} /> Cerrar cámara</button></div>}
          {message && <p className="scan-message" role="status">{message}</p>}
        </main>

        {!recoveryDraft && step !== 'complete' && <footer className="scan-session-footer"><button type="button" onClick={goBack}><ArrowLeft size={18} /> {step === 'setup' || (step === 'items' && authenticatedSelfService) ? 'Cerrar' : 'Atrás'}</button><button className="primary" type="button" disabled={(step === 'technician' && !selectedTechnician) || (step === 'items' && selectedTools.length === 0)} onClick={() => { if (step === 'setup') { setStartedAt(now()); setStep('technician'); } else if (step === 'technician') setStep('items'); else if (step === 'items') setStep('review'); else finish(); }}>{step === 'review' ? <PackageCheck size={18} /> : <ArrowRight size={18} />}{step === 'setup' ? 'Comenzar' : step === 'technician' ? 'Escanear material' : step === 'items' ? 'Revisar operación' : `Confirmar ${operationCopy[operation].verb}`}</button></footer>}
      </section>
    </div>,
    document.body,
  );
}
