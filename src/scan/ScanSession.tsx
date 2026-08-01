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
  Keyboard,
  Nfc,
  PackageCheck,
  QrCode,
  RotateCcw,
  ScanLine,
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

export const SCAN_SESSION_EVENT = 'isivoltpro-v2:open-scan-session';

type ScanTarget = 'technician' | 'tool';
type SessionStep = 'setup' | 'technician' | 'items' | 'review' | 'complete';

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

type NdefRecord = {
  data?: DataView;
  encoding?: string;
};

type NdefReadingEvent = {
  serialNumber?: string;
  message?: { records?: NdefRecord[] };
};

type NdefReaderInstance = {
  scan(): Promise<void>;
  onreading: ((event: NdefReadingEvent) => void) | null;
  onreadingerror: (() => void) | null;
};

type NdefReaderConstructor = new () => NdefReaderInstance;

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now = () => new Date().toISOString();
const technicianPayload = (technician: Technician) => technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;

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
  const [message, setMessage] = useState('');
  const [cameraTarget, setCameraTarget] = useState<ScanTarget | null>(null);
  const [nfcWaiting, setNfcWaiting] = useState<ScanTarget | null>(null);
  const [completedBatch, setCompletedBatch] = useState<BatchTransaction | null>(null);
  const [startedAt, setStartedAt] = useState(now());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanHandlerRef = useRef<(value: string, target: ScanTarget, method: Exclude<ScanMethod, 'mixed'>) => void>(() => undefined);

  const activeTechnicians = useMemo(() => data.technicians.filter((technician) => technician.active), [data.technicians]);
  const selectedTechnician = data.technicians.find((technician) => technician.id === technicianId);
  const selectedTools = toolIds.map((id) => data.tools.find((tool) => tool.id === id)).filter((tool): tool is Tool => Boolean(tool));
  const authenticatedSelfService = operatorMode === 'self-service'
    && identificationMethod === 'authenticated'
    && Boolean(selectedTechnician);

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
    setMessage(requestedTechnician ? `${requestedTechnician.name} identificado mediante la cuenta.` : '');
    setCameraTarget(null);
    setNfcWaiting(null);
    setCompletedBatch(null);
    setStartedAt(now());
  };

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<ScanSessionRequest>).detail ?? {};
      reset(detail);
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

  const addTool = (value: string, method: Exclude<ScanMethod, 'mixed'>): boolean => {
    if (!selectedTechnician) {
      setMessage('Primero debes identificar al técnico.');
      return false;
    }
    const normalized = value.trim();
    const payloadCode = normalized.startsWith('ISIVOLTPRO:TOOL:') ? normalized.split(':').at(-1) : undefined;
    const tool = data.tools.find((item) =>
      item.code === normalized
      || item.code === payloadCode
      || item.qrPayload === normalized
      || item.nfcTag === normalized,
    );
    if (!tool) {
      setMessage('No se ha encontrado ningún artículo con ese QR, código o NFC.');
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
            // La cámara seguirá intentando mientras el panel permanezca abierto.
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
    setData(nextData);
    setCompletedBatch(batch);
    setStep('complete');
    setMessage(operationCopy[operation].done);
  };

  const removeTool = (toolId: string) => setToolIds((current) => current.filter((id) => id !== toolId));
  const close = () => {
    setOpen(false);
    setCameraTarget(null);
    setNfcWaiting(null);
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
    if (authenticatedSelfService && selectedTechnician) {
      reset({
        operation,
        mode: 'self-service',
        technicianId: selectedTechnician.id,
        identificationMethod: 'authenticated',
        startAt: 'items',
      });
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

        <div className="scan-progress" aria-label="Progreso de la operación">
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
        </div>

        <main className="scan-session-body">
          {step === 'setup' && (
            <div className="scan-choice-screen">
              <div className="scan-intro"><span><PackageCheck size={32} /></span><h2>¿Qué operación vas a realizar?</h2><p>Primero identifica al técnico, después escanea todos los artículos y confirma el lote una sola vez.</p></div>
              <div className="scan-choice-grid">
                <button className={operation === 'loan' ? 'selected' : ''} type="button" onClick={() => setOperation('loan')}><ArrowUpFromLine size={26} /><strong>Préstamo</strong><small>Salida de herramientas o material</small></button>
                <button className={operation === 'return' ? 'selected' : ''} type="button" onClick={() => setOperation('return')}><ArrowDownToLine size={26} /><strong>Devolución</strong><small>Entrada de material al almacén</small></button>
              </div>
              <h3>Modo de trabajo</h3>
              <div className="scan-choice-grid mode">
                <button className={operatorMode === 'administrator' ? 'selected' : ''} type="button" onClick={() => setOperatorMode('administrator')}><ShieldCheck size={24} /><strong>Administrador</strong><small>Escanea primero al técnico y luego el material</small></button>
                <button className={operatorMode === 'self-service' ? 'selected' : ''} type="button" onClick={() => setOperatorMode('self-service')}><Smartphone size={24} /><strong>Técnico</strong><small>Usa su QR personal y registra su propia operación</small></button>
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
              <div className="scan-step-heading"><span><QrCode size={25} /></span><div><h2>Escanear material</h2><p>{selectedTechnician?.name} · {authenticatedSelfService ? 'cuenta identificada automáticamente' : 'añade todos los artículos antes de finalizar'}.</p></div><strong>{selectedTools.length}</strong></div>
              <div className="scan-input-card compact"><label>Código, QR o identificador NFC del artículo</label><div className="scan-input-row"><ScanLine size={19} /><input autoFocus value={scanInput} onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleScannedValue(scanInput, 'tool', 'manual'); }} placeholder="Ej. ELE-001" /><button type="button" onClick={() => handleScannedValue(scanInput, 'tool', 'manual')}>Añadir</button></div><div className="scan-device-actions"><button type="button" onClick={() => setCameraTarget('tool')}><Camera size={18} /> Escanear QR</button><button type="button" onClick={() => void readNfc('tool')} className={nfcWaiting === 'tool' ? 'waiting' : ''}><Nfc size={18} /> {nfcWaiting === 'tool' ? 'Acerca el NFC…' : 'Leer NFC'}</button></div></div>
              {selectedTools.length === 0 ? <div className="scan-empty-list"><ScanLine size={31} /><strong>Escanea el primer artículo</strong><p>Se comprobará automáticamente que esté disponible o asignado al técnico.</p></div> : <div className="scan-tool-list">{selectedTools.map((tool, index) => <article key={tool.id}><span>{index + 1}</span><div><strong>{tool.name}</strong><small>{tool.code} · {tool.category}</small></div><em>{operation === 'loan' ? 'SALIDA' : 'ENTRADA'}</em><button type="button" onClick={() => removeTool(tool.id)} aria-label={`Quitar ${tool.name}`}><Trash2 size={17} /></button></article>)}</div>}
            </div>
          )}

          {step === 'review' && selectedTechnician && (
            <div className="scan-review-screen"><div className="scan-review-hero"><span>{operation === 'loan' ? <ArrowUpFromLine size={30} /> : <ArrowDownToLine size={30} />}</span><div><small>REVISAR OPERACIÓN</small><h2>{operation === 'loan' ? 'Salida de material' : 'Entrada de material'}</h2><p>Comprueba los datos antes de registrar el lote completo.</p></div></div><dl><div><dt>Técnico</dt><dd>{selectedTechnician.name}<small>{selectedTechnician.code}</small></dd></div><div><dt>Modo</dt><dd>{operatorMode === 'administrator' ? 'Administrador' : 'Autoservicio'}</dd></div><div><dt>Identificación</dt><dd>{identificationMethod.toUpperCase()}</dd></div><div><dt>Artículos</dt><dd>{selectedTools.length}</dd></div></dl><div className="scan-review-tools">{selectedTools.map((tool) => <span key={tool.id}><CheckCircle2 size={16} /> {tool.code} · {tool.name}</span>)}</div></div>
          )}

          {step === 'complete' && selectedTechnician && completedBatch && (
            <div className="scan-complete-screen"><span><CheckCircle2 size={48} /></span><h2>{operationCopy[operation].done}</h2><p>{selectedTools.length} artículo{selectedTools.length === 1 ? '' : 's'} · {selectedTechnician.name}</p><code>{completedBatch.id}</code><div><button type="button" onClick={startAnotherOperation}><RotateCcw size={18} /> Nueva operación</button><button className="primary" type="button" onClick={close}>Finalizar</button></div></div>
          )}

          {cameraTarget && <div className="scan-camera"><video ref={videoRef} playsInline muted /><div><ScanLine size={40} /><p>Coloca el QR dentro del recuadro</p></div><button type="button" onClick={() => setCameraTarget(null)}><X size={19} /> Cerrar cámara</button></div>}
          {message && <p className="scan-message" role="status">{message}</p>}
        </main>

        {step !== 'complete' && <footer className="scan-session-footer"><button type="button" onClick={goBack}><ArrowLeft size={18} /> {step === 'setup' || (step === 'items' && authenticatedSelfService) ? 'Cancelar' : 'Atrás'}</button><button className="primary" type="button" disabled={(step === 'technician' && !selectedTechnician) || (step === 'items' && selectedTools.length === 0)} onClick={() => { if (step === 'setup') { setStartedAt(now()); setStep('technician'); } else if (step === 'technician') setStep('items'); else if (step === 'items') setStep('review'); else finish(); }}>{step === 'review' ? <PackageCheck size={18} /> : <ArrowRight size={18} />}{step === 'setup' ? 'Comenzar' : step === 'technician' ? 'Escanear material' : step === 'items' ? 'Revisar operación' : `Confirmar ${operationCopy[operation].verb}`}</button></footer>}
      </section>
    </div>,
    document.body,
  );
}
