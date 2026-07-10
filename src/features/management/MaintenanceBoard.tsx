import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ClipboardCheck,
  CircleDollarSign,
  Hammer,
  PackageSearch,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import type { AppData, MaintenanceRecord } from '../../domain/types';
import {
  createMaintenanceRecord,
  getManagementData,
  saveMaintenanceRecord,
} from './managementService';

type Filter = 'open' | 'all' | 'completed';

type Props = {
  onSaved: () => void;
};

const statusLabel: Record<MaintenanceRecord['status'], string> = {
  open: 'Abierta',
  in_progress: 'En curso',
  waiting_parts: 'Esperando repuesto',
  completed: 'Terminada',
  cancelled: 'Cancelada',
};

const typeLabel: Record<MaintenanceRecord['type'], string> = {
  incident: 'Incidencia',
  inspection: 'Inspección',
  repair: 'Reparación',
  calibration: 'Calibración',
  status_change: 'Cambio de estado',
};

const dateInput = (value?: string) => value?.slice(0, 10) ?? '';
const money = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function MaintenanceBoard({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => getManagementData());
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<MaintenanceRecord | null>(null);
  const [error, setError] = useState('');

  const refresh = (next?: AppData) => {
    const value = next ?? getManagementData();
    setData(value);
    onSaved();
  };

  const records = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...(data.maintenanceRecords ?? [])]
      .filter((record) => {
        if (filter === 'open' && ['completed', 'cancelled'].includes(record.status)) return false;
        if (filter === 'completed' && record.status !== 'completed') return false;
        const tool = data.tools.find((item) => item.id === record.toolId);
        return [record.title, record.description, record.assignedTo ?? '', tool?.code ?? '', tool?.name ?? '']
          .some((value) => value.toLowerCase().includes(normalized));
      })
      .sort((a, b) => {
        const closedA = ['completed', 'cancelled'].includes(a.status) ? 1 : 0;
        const closedB = ['completed', 'cancelled'].includes(b.status) ? 1 : 0;
        return closedA - closedB || b.openedAt.localeCompare(a.openedAt);
      });
  }, [data, filter, query]);

  const createNew = () => {
    const firstTool = data.tools.find((tool) => tool.active !== false && tool.status !== 'retired');
    if (!firstTool) {
      setError('No hay ninguna herramienta activa para abrir un expediente.');
      return;
    }
    setError('');
    setDraft(createMaintenanceRecord(firstTool.id));
  };

  const save = () => {
    if (!draft) return;
    try {
      setError('');
      const next = saveMaintenanceRecord(draft);
      refresh(next);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar el expediente.');
    }
  };

  const openBoard = () => {
    setData(getManagementData());
    setError('');
    setOpen(true);
  };

  return (
    <>
      <motion.button
        className="maintenance-board-launcher"
        type="button"
        onClick={openBoard}
        whileTap={{ scale: 0.9 }}
        aria-label="Abrir tablero de mantenimiento"
      >
        <Hammer size={20} />
        {(data.maintenanceRecords ?? []).some((record) => !['completed', 'cancelled'].includes(record.status)) && <i />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="maintenance-board-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="maintenance-board" initial={{ opacity: 0, y: 42, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 28, scale: 0.97 }}>
              <header>
                <div><span><Hammer size={23} /></span><div><small>Gestión técnica</small><h2>Tablero de mantenimiento</h2><p>{records.length} expediente{records.length === 1 ? '' : 's'} en este filtro</p></div></div>
                <button onClick={() => setOpen(false)} aria-label="Cerrar"><X size={22} /></button>
              </header>

              <div className="maintenance-board-toolbar">
                <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Herramienta, código, responsable…" /></label>
                <button className="maintenance-board-add" onClick={createNew}><Plus size={17} /> Nueva actuación</button>
              </div>

              <nav>
                {([
                  ['open', 'Abiertas'],
                  ['all', 'Todas'],
                  ['completed', 'Terminadas'],
                ] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
              </nav>

              <main>
                {records.length === 0 ? (
                  <div className="maintenance-board-empty"><ClipboardCheck size={38} /><strong>Sin expedientes</strong><span>No hay actuaciones que coincidan con el filtro.</span></div>
                ) : records.map((record) => {
                  const tool = data.tools.find((item) => item.id === record.toolId);
                  const overdue = Boolean(record.dueAt && !['completed', 'cancelled'].includes(record.status) && new Date(record.dueAt) < new Date());
                  return (
                    <button key={record.id} className={`maintenance-board-card status-${record.status} ${overdue ? 'overdue' : ''}`} onClick={() => { setError(''); setDraft(record); }}>
                      <span className="maintenance-board-icon">{overdue ? <AlertTriangle size={20} /> : <Hammer size={20} />}</span>
                      <div>
                        <small>{tool?.code ?? 'Sin código'} · {typeLabel[record.type]}</small>
                        <strong>{record.title}</strong>
                        <span>{tool?.name ?? 'Herramienta eliminada'}{record.assignedTo ? ` · ${record.assignedTo}` : ''}</span>
                        <time>{record.dueAt ? `Límite: ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(record.dueAt))}` : 'Sin fecha límite'}</time>
                      </div>
                      <b>{statusLabel[record.status]}</b>
                    </button>
                  );
                })}
              </main>

              {error && <p className="maintenance-board-error"><AlertTriangle size={17} /> {error}</p>}
            </motion.section>
          </motion.div>
        )}

        {draft && (
          <motion.div className="maintenance-record-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDraft(null)}>
            <motion.section className="maintenance-record-editor" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} onClick={(event) => event.stopPropagation()}>
              <header><div><ClipboardCheck size={22} /><span><small>Expediente técnico</small><strong>{draft.title || 'Nueva actuación'}</strong></span></div><button onClick={() => setDraft(null)}><X size={21} /></button></header>

              <div className="maintenance-record-scroll">
                <label><span>Herramienta</span><select value={draft.toolId} onChange={(event) => setDraft((current) => current && ({ ...current, toolId: event.target.value }))}>{data.tools.map((tool) => <option value={tool.id} key={tool.id}>{tool.code} · {tool.name}</option>)}</select></label>
                <div className="maintenance-record-grid">
                  <label><span>Tipo</span><select value={draft.type} onChange={(event) => setDraft((current) => current && ({ ...current, type: event.target.value as MaintenanceRecord['type'] }))}>{Object.entries(typeLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label><span>Estado</span><select value={draft.status} onChange={(event) => setDraft((current) => current && ({ ...current, status: event.target.value as MaintenanceRecord['status'] }))}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                </div>
                <label><span>Título</span><input value={draft.title} onChange={(event) => setDraft((current) => current && ({ ...current, title: event.target.value }))} /></label>
                <label><span>Descripción</span><textarea rows={4} value={draft.description} onChange={(event) => setDraft((current) => current && ({ ...current, description: event.target.value }))} /></label>
                <div className="maintenance-record-grid">
                  <label><span>Fecha límite</span><input type="date" value={dateInput(draft.dueAt)} onChange={(event) => setDraft((current) => current && ({ ...current, dueAt: event.target.value || undefined }))} /></label>
                  <label><span>Asignado a</span><div className="maintenance-inline-icon"><UserRound size={16} /><input value={draft.assignedTo ?? ''} onChange={(event) => setDraft((current) => current && ({ ...current, assignedTo: event.target.value || undefined }))} /></div></label>
                </div>
                <div className="maintenance-record-grid">
                  <label><span>Coste (€)</span><div className="maintenance-inline-icon"><CircleDollarSign size={16} /><input inputMode="decimal" value={draft.cost ?? ''} onChange={(event) => setDraft((current) => current && ({ ...current, cost: money(event.target.value) }))} /></div></label>
                  <label><span>Repuestos</span><div className="maintenance-inline-icon"><PackageSearch size={16} /><input value={draft.parts ?? ''} onChange={(event) => setDraft((current) => current && ({ ...current, parts: event.target.value || undefined }))} /></div></label>
                </div>
                <label><span>Resolución</span><textarea rows={3} value={draft.resolution ?? ''} onChange={(event) => setDraft((current) => current && ({ ...current, resolution: event.target.value || undefined }))} placeholder="Trabajo realizado y prueba final…" /></label>
                <label><span>Observaciones</span><textarea rows={2} value={draft.notes ?? ''} onChange={(event) => setDraft((current) => current && ({ ...current, notes: event.target.value || undefined }))} /></label>
                {error && <p className="maintenance-board-error"><AlertTriangle size={17} /> {error}</p>}
              </div>

              <footer><button onClick={() => setDraft(null)}>Cancelar</button><button className="maintenance-record-save" onClick={save}><Check size={18} /> Guardar expediente</button></footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
