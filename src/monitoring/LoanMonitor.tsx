import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarClock,
  CheckCircle2,
  Download,
  Filter,
  RotateCcw,
  TimerReset,
} from 'lucide-react';
import { CLOUD_PROFILE_EVENT, getCloudProfile, type CloudProfile } from '../cloud/config';
import { SCAN_SESSION_EVENT } from '../scan/ScanSession';
import { loadData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData, Movement, Technician, Tool } from '../types';

const THRESHOLD_KEY = 'isivoltpro:loan-alert-days';
const DAY_MS = 86_400_000;

type OpenLoan = {
  tool: Tool;
  technician?: Technician;
  loanMovement?: Movement;
  loanedAt: string;
  days: number;
  needsAttention: boolean;
};

const getThreshold = (): number => {
  const stored = Number(window.localStorage.getItem(THRESHOLD_KEY));
  return Number.isFinite(stored) && stored >= 1 && stored <= 365 ? stored : 7;
};

const saveThreshold = (value: number) => {
  const normalized = Math.min(365, Math.max(1, Math.round(value)));
  window.localStorage.setItem(THRESHOLD_KEY, String(normalized));
  return normalized;
};

const formatDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function downloadCsv(loans: OpenLoan[]) {
  const rows = [
    ['Código', 'Artículo', 'Categoría', 'Técnico', 'Fecha préstamo', 'Días fuera', 'Estado'],
    ...loans.map((loan) => [
      loan.tool.code,
      loan.tool.name,
      loan.tool.category,
      loan.technician?.name ?? 'Sin responsable',
      loan.loanedAt,
      loan.days,
      loan.needsAttention ? 'Atención' : 'Dentro de plazo',
    ]),
  ];
  const content = rows.map((row) => row.map(csvCell).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `isivoltpro-prestamos-abiertos-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function LoanMonitor() {
  const [target, setTarget] = useState<Element | null>(null);
  const [data, setData] = useState<AppData>(() => loadData());
  const [profile, setProfile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [threshold, setThreshold] = useState(getThreshold);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.operations-main-grid'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleData = (event: Event) => setData((event as CustomEvent<AppData>).detail ?? loadData());
    const handleProfile = (event: Event) => setProfile((event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile());
    const refreshClock = () => setClock(Date.now());

    window.addEventListener(WORKSPACE_DATA_EVENT, handleData);
    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    window.addEventListener('focus', refreshClock);
    const interval = window.setInterval(refreshClock, 60 * 60 * 1000);

    return () => {
      observer.disconnect();
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleData);
      window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
      window.removeEventListener('focus', refreshClock);
      window.clearInterval(interval);
    };
  }, []);

  const openLoans = useMemo<OpenLoan[]>(() => {
    const currentTechnicianId = profile?.role === 'technician' ? profile.technicianExternalId : undefined;
    return data.tools
      .filter((tool) => tool.status === 'loaned')
      .filter((tool) => !currentTechnicianId || tool.technicianId === currentTechnicianId)
      .map((tool) => {
        const loanMovement = data.movements
          .filter((movement) => movement.toolId === tool.id && movement.type === 'loan')
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
        const loanedAt = loanMovement?.occurredAt ?? tool.updatedAt;
        const elapsed = Math.max(0, clock - new Date(loanedAt).getTime());
        const days = Math.floor(elapsed / DAY_MS);
        return {
          tool,
          technician: data.technicians.find((technician) => technician.id === tool.technicianId),
          loanMovement,
          loanedAt,
          days,
          needsAttention: days >= threshold,
        };
      })
      .sort((a, b) => b.days - a.days || a.tool.code.localeCompare(b.tool.code, 'es'));
  }, [clock, data.movements, data.technicians, data.tools, profile, threshold]);

  const attentionCount = openLoans.filter((loan) => loan.needsAttention).length;
  const visibleLoans = filter === 'attention' ? openLoans.filter((loan) => loan.needsAttention) : openLoans;
  const isTechnician = profile?.role === 'technician';

  const updateThreshold = (value: number) => setThreshold(saveThreshold(value));

  const startReturn = (loan: OpenLoan) => {
    const technicianId = loan.technician?.id;
    if (isTechnician && technicianId) {
      window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT, {
        detail: {
          operation: 'return',
          mode: 'self-service',
          technicianId,
          identificationMethod: 'authenticated',
          startAt: 'items',
        },
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT, {
      detail: { operation: 'return', mode: 'administrator' },
    }));
  };

  if (!target) return null;

  return createPortal(
    <section className="surface loan-monitor">
      <header className="loan-monitor-header">
        <div>
          <span className={attentionCount > 0 ? 'attention' : ''}>{attentionCount > 0 ? <AlertTriangle size={19} /> : <CalendarClock size={19} />}</span>
          <div>
            <h2>{isTechnician ? 'Mis préstamos abiertos' : 'Préstamos abiertos'}</h2>
            <p>{openLoans.length} artículo{openLoans.length === 1 ? '' : 's'} fuera del almacén · {attentionCount} requieren atención</p>
          </div>
        </div>
        <div className="loan-monitor-actions">
          <label title="Días antes de marcar atención"><TimerReset size={16} /><span>Alerta</span><input type="number" min="1" max="365" value={threshold} onChange={(event) => updateThreshold(Number(event.target.value) || 1)} /><em>días</em></label>
          <button type="button" disabled={openLoans.length === 0} onClick={() => downloadCsv(openLoans)}><Download size={16} /> Exportar</button>
        </div>
      </header>

      <div className="loan-monitor-summary">
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}><Filter size={15} /> Todos <strong>{openLoans.length}</strong></button>
        <button type="button" className={filter === 'attention' ? 'active attention' : ''} onClick={() => setFilter('attention')}><AlertTriangle size={15} /> Atención <strong>{attentionCount}</strong></button>
        <span><CheckCircle2 size={15} /> Dentro de plazo <strong>{openLoans.length - attentionCount}</strong></span>
      </div>

      {visibleLoans.length === 0 ? (
        <div className="loan-monitor-empty">
          {openLoans.length === 0 ? <CheckCircle2 size={31} /> : <AlertTriangle size={31} />}
          <strong>{openLoans.length === 0 ? 'No hay préstamos abiertos' : 'Ningún préstamo supera el plazo'}</strong>
          <p>{openLoans.length === 0 ? 'Todo el material está disponible, en revisión o retirado.' : `El aviso se activa a partir de ${threshold} días.`}</p>
        </div>
      ) : (
        <div className="loan-monitor-list">
          {visibleLoans.map((loan) => (
            <article key={loan.tool.id} className={loan.needsAttention ? 'attention' : ''}>
              <span className="loan-age"><strong>{loan.days}</strong><small>{loan.days === 1 ? 'día' : 'días'}</small></span>
              <div className="loan-tool"><strong>{loan.tool.name}</strong><small>{loan.tool.code} · {loan.tool.category}</small></div>
              <div className="loan-holder"><strong>{loan.technician?.name ?? 'Sin responsable'}</strong><small>Desde {formatDate(loan.loanedAt)}</small></div>
              <em>{loan.needsAttention ? <><AlertTriangle size={14} /> Atención</> : <><CheckCircle2 size={14} /> En plazo</>}</em>
              <button type="button" onClick={() => startReturn(loan)} title={`Registrar devolución de ${loan.tool.name}`}><RotateCcw size={16} /><span>Devolver</span></button>
            </article>
          ))}
        </div>
      )}
    </section>,
    target,
  );
}
