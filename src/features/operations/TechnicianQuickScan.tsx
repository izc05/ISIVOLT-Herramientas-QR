import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { applyMovementCommand, createOperationId, type AccessoryChecksByTool } from '../../domain/movementEngine';
import { requestTechnicianReturn } from '../../domain/pendingReturnEngine';
import type { AccessoryCondition, AppData, ReturnCondition, Technician, Tool } from '../../domain/types';
import { assertPermission } from '../../security/permissions';
import { getEffectiveTechnicianIdentity } from '../../security/effectiveTechnician';
import { getCurrentOperatorName } from '../../security/session';
import { parseIsivoltQr, scanQrCode } from '../../services/barcodeScanner';
import { isNfcScannerAvailable, normalizeNfcUid, scanNfcTag } from '../../services/nfcScanner';
import { loadAppData, saveAppData, waitForPendingAppDataWrites } from '../../services/storage';

type Action = 'delivery' | 'return';

type Feedback = {
  tone: 'success' | 'warning' | 'error';
  text: string;
} | null;

const accessoryLabel: Record<AccessoryCondition, string> = {
  ok: 'Correcto',
  missing: 'Falta',
  damaged: 'Dañado',
  not_checked: 'Sin revisar',
};

const resolveAction = (tool: Tool, technicianId: string): Action | null => {
  if (tool.status === 'available') return 'delivery';
  if (tool.status === 'loaned' && tool.holderTechnicianId === technicianId) return 'return';
  return null;
};

const candidateTools = (data: AppData, technicianId: string) => data.tools.filter((tool) => (
  tool.active !== false
  && (tool.status === 'available' || tool.holderTechnicianId === technicianId)
));

export default function TechnicianQuickScan() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [condition, setCondition] = useState<ReturnCondition>('ok');
  const [accessoryChecks, setAccessoryChecks] = useState<Record<string, AccessoryCondition>>({});
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const identity = getEffectiveTechnicianIdentity();
  const accessories = useMemo(() => tool
    ? (data.accessories ?? []).filter((item) => item.active && item.toolId === tool.id)
    : [], [data.accessories, tool]);

  const filteredTools = useMemo(() => {
    if (!technician) return [];
    const value = query.trim().toLocaleLowerCase('es-ES');
    return candidateTools(data, technician.id)
      .filter((item) => !value || [item.code, item.name, item.category, item.brand, item.location]
        .some((field) => field?.toLocaleLowerCase('es-ES').includes(value)))
      .slice(0, 10);
  }, [data, query, technician]);

  const resetSelection = () => {
    setTool(null);
    setAction(null);
    setCondition('ok');
    setAccessoryChecks({});
    setNotes('');
    setQuery('');
    setShowSearch(false);
  };

  const openFlow = () => {
    const nextData = loadAppData();
    const nextIdentity = getEffectiveTechnicianIdentity();
    const nextTechnician = nextIdentity
      ? nextData.technicians.find((item) => item.id === nextIdentity.technicianId && item.active) ?? null
      : null;
    if (!nextTechnician) return;
    setData(nextData);
    setTechnician(nextTechnician);
    setFeedback(null);
    resetSelection();
    setOpen(true);
  };

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      if (!getEffectiveTechnicianIdentity()) return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.nav-scan-button, .scan-main-button')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openFlow();
    };
    window.addEventListener('click', intercept, true);
    return () => window.removeEventListener('click', intercept, true);
  }, []);

  useEffect(() => {
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (!getEffectiveTechnicianIdentity()) return;
        const title = 'Escanear herramienta';
        const detail = 'Retirada o devolución automática';
        document.querySelectorAll<HTMLElement>('.nav-scan-button strong, .scan-main-button strong')
          .forEach((element) => {
            if (element.textContent !== title) element.textContent = title;
          });
        document.querySelectorAll<HTMLElement>('.nav-scan-button small, .scan-main-button small')
          .forEach((element) => {
            if (element.textContent !== detail) element.textContent = detail;
          });
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('isivolt:security-session', schedule);
    window.addEventListener('isivolt:central-account-changed', schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('isivolt:security-session', schedule);
      window.removeEventListener('isivolt:central-account-changed', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  const chooseTool = (selected: Tool) => {
    if (!technician) return;
    if (selected.status === 'review' && selected.holderTechnicianId === technician.id) {
      setFeedback({ tone: 'warning', text: `${selected.name} ya está pendiente de validación por el administrador.` });
      return;
    }
    const nextAction = resolveAction(selected, technician.id);
    if (!nextAction) {
      const holder = data.technicians.find((item) => item.id === selected.holderTechnicianId)?.name;
      setFeedback({
        tone: 'error',
        text: selected.status === 'loaned'
          ? `${selected.name} está asociada a ${holder ?? 'otro técnico'}.`
          : `${selected.name} no puede utilizarse porque está ${selected.status}.`,
      });
      return;
    }
    setTool(selected);
    setAction(nextAction);
    setCondition('ok');
    setAccessoryChecks(Object.fromEntries(
      (data.accessories ?? []).filter((item) => item.active && item.toolId === selected.id)
        .map((item) => [item.id, 'not_checked']),
    ));
    setNotes('');
    setShowSearch(false);
    setFeedback({
      tone: 'success',
      text: nextAction === 'delivery'
        ? `${selected.name} está disponible. Se registrará la retirada a tu nombre.`
        : `${selected.name} está a tu nombre. Se solicitará la devolución para validación.`,
    });
  };

  const processValue = (raw: string) => {
    const payload = parseIsivoltQr(raw);
    if (payload.type !== 'tool') {
      setFeedback({ tone: 'error', text: 'Escanea únicamente el QR de una herramienta.' });
      return;
    }
    const selected = data.tools.find((item) => item.code.toUpperCase() === payload.code.toUpperCase()
      || item.qrCode.toUpperCase() === payload.raw.toUpperCase());
    if (!selected) {
      setFeedback({ tone: 'error', text: `No existe ninguna herramienta con el código ${payload.code}.` });
      return;
    }
    chooseTool(selected);
  };

  const scanQr = async () => {
    if (scanning || saving) return;
    setScanning(true);
    const result = await scanQrCode({
      autoStart: true,
      continuous: false,
      title: 'Escanear herramienta',
      instruction: 'La aplicación detectará automáticamente si la retiras o la devuelves.',
      manualLabel: 'Buscar herramienta',
    });
    setScanning(false);
    if (result.status === 'manual-requested') {
      setShowSearch(true);
      return;
    }
    if (result.status === 'success') processValue(result.value);
    else if (result.status !== 'cancelled') setFeedback({ tone: 'error', text: result.message });
  };

  const scanNfc = async () => {
    if (nfcScanning || saving) return;
    setNfcScanning(true);
    const result = await scanNfcTag();
    setNfcScanning(false);
    if (result.status !== 'success') {
      if (result.status !== 'cancelled') setFeedback({ tone: 'error', text: result.message });
      return;
    }
    const uid = normalizeNfcUid(result.tag.uid);
    const selected = data.tools.find((item) => normalizeNfcUid(item.nfcUid) === uid);
    if (!selected) {
      setFeedback({ tone: 'error', text: `NFC ${uid} sin vincular a una herramienta.` });
      return;
    }
    chooseTool(selected);
  };

  const hasUncheckedRequired = accessories.some((item) => item.required
    && accessoryChecks[item.id] === 'not_checked');
  const hasIncident = condition !== 'ok' || Object.values(accessoryChecks)
    .some((value) => value === 'missing' || value === 'damaged');
  const canConfirm = Boolean(tool && action && !saving && !hasUncheckedRequired && (!hasIncident || notes.trim()));

  const confirm = async () => {
    if (!tool || !action || !technician || !canConfirm) return;
    try {
      assertPermission('operations.execute');
      setSaving(true);
      const current = loadAppData();
      const checks: AccessoryChecksByTool = { [tool.id]: accessoryChecks };
      const result = action === 'delivery'
        ? applyMovementCommand(current, {
          operationId: createOperationId(),
          mode: 'delivery',
          toolIds: [tool.id],
          technicianId: technician.id,
          accessoryChecks: checks,
          notes,
          operatorName: getCurrentOperatorName(),
        })
        : requestTechnicianReturn(current, {
          operationId: createOperationId(),
          toolId: tool.id,
          technicianId: technician.id,
          condition,
          accessoryChecks: checks,
          notes,
          operatorName: getCurrentOperatorName(),
        });
      saveAppData(result.data);
      await waitForPendingAppDataWrites();
      const refreshed = loadAppData();
      setData(refreshed);
      setFeedback({
        tone: 'success',
        text: action === 'delivery'
          ? `${tool.name} ya está registrada a tu nombre.`
          : `${tool.name} queda pendiente de validación. Hasta entonces continúa asociada a ti.`,
      });
      resetSelection();
      navigator.vibrate?.([60, 35, 100]);
    } catch (cause) {
      setFeedback({ tone: 'error', text: cause instanceof Error ? cause.message : 'No se ha podido registrar la operación.' });
    } finally {
      setSaving(false);
    }
  };

  if (!identity) return null;

  return open ? (
    <div className="rc54-quick-backdrop" onClick={() => !saving && setOpen(false)}>
      <section className="rc54-quick-scan" role="dialog" aria-modal="true" aria-label="Escanear herramienta" onClick={(event) => event.stopPropagation()}>
        <button className="rc54-close" type="button" onClick={() => setOpen(false)} disabled={saving} aria-label="Cerrar"><X size={21} /></button>
        <header>
          <span><ScanLine size={28} /></span>
          <div><small>Operación personal</small><h2>Escanear herramienta</h2><p>La retirada o devolución se detecta automáticamente.</p></div>
        </header>

        {technician && (
          <aside className="rc54-identity"><ShieldCheck size={20} /><span><small>Operación asociada a</small><strong>{technician.name}</strong><em>{technician.code} · {technician.specialty}</em></span></aside>
        )}

        {!tool ? (
          <>
            <div className="rc54-scan-actions">
              <button className="primary" type="button" onClick={() => void scanQr()} disabled={scanning || saving}>
                {scanning ? <LoaderCircle className="boot-spin" size={28} /> : <QrCode size={30} />}
                <strong>{scanning ? 'Abriendo cámara…' : 'Escanear QR'}</strong>
                <small>Una herramienta cada vez</small>
              </button>
              <button type="button" onClick={() => void scanNfc()} disabled={!isNfcScannerAvailable() || nfcScanning || saving}>
                {nfcScanning ? <LoaderCircle className="boot-spin" size={25} /> : <ScanLine size={26} />}
                <strong>{nfcScanning ? 'Leyendo…' : 'Leer NFC'}</strong>
              </button>
              <button type="button" onClick={() => setShowSearch((value) => !value)} disabled={saving}><Search size={25} /><strong>Buscar</strong></button>
            </div>

            {showSearch && (
              <section className="rc54-search-panel">
                <label><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código, nombre, categoría o ubicación" /></label>
                <div>{filteredTools.map((item) => (
                  <button type="button" key={item.id} onClick={() => chooseTool(item)}>
                    <Wrench size={18} /><span><strong>{item.name}</strong><small>{item.code} · {item.status === 'available' ? 'Retirar' : item.status === 'loaned' ? 'Devolver' : 'Pendiente'}</small></span>
                  </button>
                ))}</div>
              </section>
            )}
          </>
        ) : (
          <main className={`rc54-operation-card ${action}`}>
            <div className="rc54-operation-heading">
              <span>{action === 'delivery' ? <KeyRound size={25} /> : <RotateCcw size={25} />}</span>
              <div><small>{action === 'delivery' ? 'RETIRADA' : 'DEVOLUCIÓN'}</small><h3>{tool.name}</h3><p>{tool.code} · {tool.location}</p></div>
            </div>
            {action === 'return' && (
              <div className="rc54-condition-grid">
                {(['ok', 'review', 'damaged'] as ReturnCondition[]).map((value) => (
                  <button type="button" key={value} className={condition === value ? 'active' : ''} onClick={() => setCondition(value)}>
                    {value === 'ok' ? <CheckCircle2 size={17} /> : value === 'review' ? <RotateCcw size={17} /> : <AlertTriangle size={17} />}
                    {value === 'ok' ? 'Correcta' : value === 'review' ? 'Revisar' : 'Averiada'}
                  </button>
                ))}
              </div>
            )}
            {accessories.length > 0 && (
              <section className="rc54-accessories"><strong>Accesorios</strong>{accessories.map((item) => (
                <div key={item.id}><span>{item.name}{item.required ? ' · obligatorio' : ''}</span><select value={accessoryChecks[item.id] ?? 'not_checked'} onChange={(event) => setAccessoryChecks((current) => ({ ...current, [item.id]: event.target.value as AccessoryCondition }))}>{Object.entries(accessoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              ))}</section>
            )}
            <label className="rc54-notes">Observaciones<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder={action === 'return' ? 'Indica cualquier anomalía…' : 'Opcional'} /></label>
            {action === 'return' && <p className="rc54-approval-note"><ShieldCheck size={17} /> La herramienta seguirá asociada a ti hasta que el administrador valide la devolución.</p>}
            <div className="rc54-operation-actions">
              <button type="button" onClick={resetSelection} disabled={saving}>Cancelar</button>
              <button className="confirm" type="button" onClick={() => void confirm()} disabled={!canConfirm}>{saving ? <LoaderCircle className="boot-spin" size={18} /> : <Check size={18} />}{action === 'delivery' ? 'Confirmar retirada' : 'Solicitar devolución'}</button>
            </div>
          </main>
        )}

        {feedback && <p className={`rc54-feedback ${feedback.tone}`}>{feedback.tone === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}{feedback.text}</p>}
      </section>
    </div>
  ) : null;
}
