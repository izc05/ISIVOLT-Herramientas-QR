import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleOff,
  MapPin,
  Nfc,
  QrCode,
  Search,
  ShieldAlert,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { CLOUD_PROFILE_EVENT, getCloudProfile, type CloudProfile } from '../cloud/config';
import { getPhotoUrl } from '../photos/photoStore';
import { loadData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData, PhotoReference, Technician, TechnicianStatus, Tool, ToolServiceState } from '../types';

const DAY_MS = 86_400_000;
const THRESHOLD_KEY = 'isivoltpro:loan-alert-days';

type OverviewMode = 'tools' | 'technicians';
type ToolFilter = 'all' | 'available' | 'loaned' | 'attention' | 'service' | 'missing-data';
type TechnicianFilter = 'all' | 'active' | 'with-material' | 'attention' | 'inactive';

type VisualState = {
  key: string;
  label: string;
  tone: 'green' | 'orange' | 'red' | 'purple' | 'yellow' | 'gray' | 'blue';
};

const serviceLabels: Record<ToolServiceState, string> = {
  ready: 'Preparada',
  reserved: 'Reservada',
  review: 'En revisión',
  repair: 'En reparación',
  lost: 'Perdida',
  retired: 'Retirada',
};

const technicianLabels: Record<TechnicianStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  absent: 'Ausente',
  vacation: 'Vacaciones',
  leave: 'Baja',
  blocked: 'Bloqueado',
};

function getThreshold() {
  const stored = Number(localStorage.getItem(THRESHOLD_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : 7;
}

function EntityPhoto({ photos, fallback }: { photos?: PhotoReference[]; fallback: 'tool' | 'technician' }) {
  const [url, setUrl] = useState<string | null>(null);
  const reference = photos?.find((photo) => photo.primary) ?? photos?.[0];

  useEffect(() => {
    let active = true;
    let current: string | null = null;
    if (!reference) {
      setUrl(null);
      return;
    }
    void getPhotoUrl(reference).then((next) => {
      if (!active) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      current = next;
      setUrl(next);
    });
    return () => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [reference?.id]);

  if (url) return <img className="status-photo" src={url} alt="" />;
  return <span className="status-photo placeholder">{fallback === 'tool' ? <Wrench size={24} /> : <UserRound size={25} />}</span>;
}

function lastLoanDate(tool: Tool, data: AppData) {
  return data.movements
    .filter((movement) => movement.toolId === tool.id && movement.type === 'loan')
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.occurredAt ?? tool.updatedAt;
}

function loanDays(tool: Tool, data: AppData, now: number) {
  if (tool.status !== 'loaned') return 0;
  return Math.max(0, Math.floor((now - new Date(lastLoanDate(tool, data)).getTime()) / DAY_MS));
}

function toolVisualState(tool: Tool, days: number, threshold: number): VisualState {
  if (tool.status === 'loaned' && days >= threshold) return { key: 'attention', label: `Atrasada · ${days} d`, tone: 'red' };
  if (tool.serviceState === 'lost') return { key: 'lost', label: 'Perdida', tone: 'red' };
  if (tool.serviceState === 'repair') return { key: 'repair', label: 'En reparación', tone: 'yellow' };
  if (tool.serviceState === 'review' || tool.status === 'review') return { key: 'review', label: 'En revisión', tone: 'purple' };
  if (tool.serviceState === 'reserved') return { key: 'reserved', label: 'Reservada', tone: 'blue' };
  if (tool.serviceState === 'retired' || tool.status === 'retired') return { key: 'retired', label: 'Retirada', tone: 'gray' };
  if (tool.status === 'loaned') return { key: 'loaned', label: `Prestada · ${days} d`, tone: 'orange' };
  return { key: 'available', label: 'Disponible', tone: 'green' };
}

export default function StatusOverview() {
  const [target, setTarget] = useState<Element | null>(null);
  const [data, setData] = useState<AppData>(() => loadData());
  const [profile, setProfile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [mode, setMode] = useState<OverviewMode>('tools');
  const [toolFilter, setToolFilter] = useState<ToolFilter>('all');
  const [technicianFilter, setTechnicianFilter] = useState<TechnicianFilter>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const resolve = () => setTarget(document.querySelector('.operational-center'));
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    const handleData = (event: Event) => setData((event as CustomEvent<AppData>).detail ?? loadData());
    const handleProfile = (event: Event) => setProfile((event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile());
    const refresh = () => setClock(Date.now());
    window.addEventListener(WORKSPACE_DATA_EVENT, handleData);
    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    window.addEventListener('focus', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleData);
      window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const threshold = getThreshold();
  const normalizedQuery = query.trim().toLocaleLowerCase('es-ES');
  const technicianScope = profile?.role === 'technician' ? profile.technicianExternalId : undefined;

  const toolRows = useMemo(() => data.tools.map((tool) => {
    const days = loanDays(tool, data, clock);
    const state = toolVisualState(tool, days, threshold);
    const technician = data.technicians.find((entry) => entry.id === tool.technicianId);
    return { tool, days, state, technician };
  }), [clock, data, threshold]);

  const visibleTools = toolRows.filter(({ tool, state }) => {
    if (technicianScope && tool.technicianId !== technicianScope) return false;
    const text = [tool.code, tool.name, tool.category, tool.location, tool.serialNumber ?? ''].join(' ').toLocaleLowerCase('es-ES');
    if (normalizedQuery && !text.includes(normalizedQuery)) return false;
    if (toolFilter === 'available') return state.key === 'available';
    if (toolFilter === 'loaned') return state.key === 'loaned' || state.key === 'attention';
    if (toolFilter === 'attention') return state.key === 'attention' || state.key === 'lost';
    if (toolFilter === 'service') return ['review', 'repair', 'reserved'].includes(state.key);
    if (toolFilter === 'missing-data') return !tool.locationId || !tool.photos?.length || !tool.nfcTag;
    return true;
  }).sort((a, b) => {
    const priority = { red: 0, yellow: 1, purple: 2, orange: 3, blue: 4, green: 5, gray: 6 } as const;
    return priority[a.state.tone] - priority[b.state.tone] || a.tool.code.localeCompare(b.tool.code, 'es');
  });

  const technicianRows = useMemo(() => data.technicians.map((technician) => {
    const assigned = toolRows.filter((entry) => entry.tool.technicianId === technician.id);
    const attention = assigned.filter((entry) => entry.state.tone === 'red').length;
    const lastMovement = data.movements
      .filter((movement) => movement.technicianId === technician.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    return { technician, assigned, attention, lastMovement };
  }), [data.movements, data.technicians, toolRows]);

  const visibleTechnicians = technicianRows.filter(({ technician, assigned, attention }) => {
    if (technicianScope && technician.id !== technicianScope) return false;
    const text = [technician.code, technician.name, technician.category, technician.department ?? ''].join(' ').toLocaleLowerCase('es-ES');
    if (normalizedQuery && !text.includes(normalizedQuery)) return false;
    const currentStatus = technician.status ?? (technician.active ? 'active' : 'inactive');
    if (technicianFilter === 'active') return currentStatus === 'active';
    if (technicianFilter === 'with-material') return assigned.length > 0;
    if (technicianFilter === 'attention') return attention > 0;
    if (technicianFilter === 'inactive') return currentStatus !== 'active';
    return true;
  }).sort((a, b) => b.attention - a.attention || b.assigned.length - a.assigned.length || a.technician.name.localeCompare(b.technician.name, 'es'));

  const toolMetrics = {
    available: toolRows.filter((entry) => entry.state.key === 'available').length,
    loaned: toolRows.filter((entry) => ['loaned', 'attention'].includes(entry.state.key)).length,
    attention: toolRows.filter((entry) => entry.state.tone === 'red').length,
    service: toolRows.filter((entry) => ['review', 'repair'].includes(entry.state.key)).length,
  };

  const shownTools = expanded ? visibleTools : visibleTools.slice(0, 12);
  const shownTechnicians = expanded ? visibleTechnicians : visibleTechnicians.slice(0, 10);
  const hiddenCount = mode === 'tools' ? visibleTools.length - shownTools.length : visibleTechnicians.length - shownTechnicians.length;

  if (!target) return null;

  return createPortal(
    <section className="surface status-overview">
      <header className="status-overview-header">
        <div><span><ShieldAlert size={20} /></span><div><h2>Estado operativo</h2><p>Situación visual de cada artículo y técnico en tiempo real.</p></div></div>
        <div className="status-mode-switch">
          <button className={mode === 'tools' ? 'active' : ''} type="button" onClick={() => { setMode('tools'); setExpanded(false); }}><Boxes size={17} /> Herramientas</button>
          <button className={mode === 'technicians' ? 'active' : ''} type="button" onClick={() => { setMode('technicians'); setExpanded(false); }}><UsersRound size={17} /> Técnicos</button>
        </div>
      </header>

      <div className="status-summary">
        <article className="tone-green"><CheckCircle2 size={18} /><div><strong>{toolMetrics.available}</strong><small>Disponibles</small></div></article>
        <article className="tone-orange"><CalendarClock size={18} /><div><strong>{toolMetrics.loaned}</strong><small>Prestadas</small></div></article>
        <article className="tone-red"><AlertTriangle size={18} /><div><strong>{toolMetrics.attention}</strong><small>Atención</small></div></article>
        <article className="tone-purple"><ShieldAlert size={18} /><div><strong>{toolMetrics.service}</strong><small>Revisión/rep.</small></div></article>
      </div>

      <div className="status-toolbar">
        <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === 'tools' ? 'Buscar código, herramienta, ubicación…' : 'Buscar técnico o especialidad…'} /></label>
        {mode === 'tools' ? (
          <div className="status-filter-chips">
            {[
              ['all', 'Todos'], ['available', 'Disponibles'], ['loaned', 'Prestadas'], ['attention', 'Atención'], ['service', 'Revisión'], ['missing-data', 'Datos pendientes'],
            ].map(([value, label]) => <button className={toolFilter === value ? 'active' : ''} key={value} type="button" onClick={() => { setToolFilter(value as ToolFilter); setExpanded(false); }}>{label}</button>)}
          </div>
        ) : (
          <div className="status-filter-chips">
            {[
              ['all', 'Todos'], ['active', 'Activos'], ['with-material', 'Con material'], ['attention', 'Con alertas'], ['inactive', 'No disponibles'],
            ].map(([value, label]) => <button className={technicianFilter === value ? 'active' : ''} key={value} type="button" onClick={() => { setTechnicianFilter(value as TechnicianFilter); setExpanded(false); }}>{label}</button>)}
          </div>
        )}
      </div>

      {mode === 'tools' ? (
        <div className="status-tool-grid">
          {shownTools.map(({ tool, days, state, technician }) => (
            <article className={`status-tool-card tone-${state.tone}`} key={tool.id}>
              <EntityPhoto photos={tool.photos} fallback="tool" />
              <div className="status-card-main">
                <div className="status-card-title"><div><small>{tool.code}</small><strong>{tool.name}</strong></div><em>{state.label}</em></div>
                <p>{tool.category}</p>
                <dl>
                  <div><dt><MapPin size={13} /> Ubicación</dt><dd>{tool.location || 'Sin ubicación'}</dd></div>
                  <div><dt><UserRound size={13} /> Responsable</dt><dd>{technician?.name ?? (tool.status === 'loaned' ? 'Sin identificar' : 'Almacén')}</dd></div>
                </dl>
                <footer>
                  <span className={tool.qrPayload ? 'ready' : ''}><QrCode size={14} /> QR</span>
                  <span className={tool.nfcTag ? 'ready' : ''}><Nfc size={14} /> NFC</span>
                  {tool.status === 'loaned' && <span className={days >= threshold ? 'attention' : 'ready'}><CalendarClock size={14} /> {days} d</span>}
                </footer>
              </div>
            </article>
          ))}
          {shownTools.length === 0 && <div className="status-empty"><CircleOff size={32} /><strong>No hay herramientas en este filtro</strong><p>Prueba con otro estado o término de búsqueda.</p></div>}
        </div>
      ) : (
        <div className="status-technician-grid">
          {shownTechnicians.map(({ technician, assigned, attention, lastMovement }) => {
            const currentStatus = technician.status ?? (technician.active ? 'active' : 'inactive');
            return (
              <article className={`status-technician-card ${attention > 0 ? 'attention' : ''}`} key={technician.id}>
                <EntityPhoto photos={technician.photos} fallback="technician" />
                <div><small>{technician.code}</small><strong>{technician.name}</strong><p>{technician.category}</p></div>
                <span className={`technician-state state-${currentStatus}`}>{technicianLabels[currentStatus]}</span>
                <dl><div><dt>Asignadas</dt><dd>{assigned.length}</dd></div><div><dt>Alertas</dt><dd>{attention}</dd></div></dl>
                <footer>{lastMovement ? `Última actividad: ${new Date(lastMovement.occurredAt).toLocaleDateString('es-ES')}` : 'Sin actividad registrada'}</footer>
              </article>
            );
          })}
          {shownTechnicians.length === 0 && <div className="status-empty"><CircleOff size={32} /><strong>No hay técnicos en este filtro</strong><p>Prueba con otro estado o término de búsqueda.</p></div>}
        </div>
      )}

      {(hiddenCount > 0 || expanded) && <button className="status-expand" type="button" onClick={() => setExpanded((current) => !current)}>{expanded ? <><ChevronUp size={17} /> Mostrar menos</> : <><ChevronDown size={17} /> Ver {hiddenCount} más</>}</button>}
    </section>,
    target,
  );
}
