import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  History,
  PackageCheck,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  AppData,
  Movement,
  OperationMode,
  ReturnCondition,
  Technician,
  Tool,
  ToolStatus,
} from './domain/types';
import { hospitalTechnicians, technicianSpecialties } from './data/technicians';
import { loadAppData, resetAppData, saveAppData } from './services/storage';

const OPERATOR_NAME = 'Isi';
const LEGACY_DEMO_TECHNICIANS = new Set(['tech-antonio', 'tech-marta', 'tech-carlos']);

type View = 'dashboard' | 'inventory' | 'technicians' | 'movements';
type Toast = { title: string; detail: string; points?: number } | null;

type OperationPayload = {
  mode: OperationMode;
  toolIds: string[];
  technicianId?: string;
  condition: ReturnCondition;
  notes: string;
};

const viewLabels: Record<View, string> = {
  dashboard: 'Inicio',
  inventory: 'Inventario',
  technicians: 'Técnicos',
  movements: 'Movimientos',
};

const statusMeta: Record<ToolStatus, { label: string; className: string }> = {
  available: { label: 'Disponible', className: 'status-available' },
  loaned: { label: 'Prestada', className: 'status-loaned' },
  review: { label: 'En revisión', className: 'status-review' },
  damaged: { label: 'Averiada', className: 'status-damaged' },
  retired: { label: 'Baja', className: 'status-retired' },
};

const movementMeta = {
  delivery: { label: 'Entrega', icon: ArrowUpFromLine },
  return: { label: 'Devolución', icon: ArrowDownToLine },
  incident: { label: 'Incidencia', icon: AlertTriangle },
  adjustment: { label: 'Ajuste', icon: RotateCcw },
} as const;

const newId = (prefix: string) => {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

const hoursSince = (iso?: string) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
};

const normalizeData = (source: AppData): AppData => {
  const hospitalIds = new Set(hospitalTechnicians.map((technician) => technician.id));
  const customTechnicians = source.technicians.filter(
    (technician) => !LEGACY_DEMO_TECHNICIANS.has(technician.id) && !hospitalIds.has(technician.id),
  );
  const technicians = [...hospitalTechnicians, ...customTechnicians];
  const validTechnicianIds = new Set(technicians.map((technician) => technician.id));

  const tools = source.tools.map((tool) => {
    if (!tool.holderTechnicianId || validTechnicianIds.has(tool.holderTechnicianId)) return tool;
    return {
      ...tool,
      status: 'available' as ToolStatus,
      holderTechnicianId: undefined,
      loanedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
  });

  const movements = source.movements.filter(
    (movement) => !movement.technicianId || validTechnicianIds.has(movement.technicianId),
  );

  return { ...source, technicians, tools, movements };
};

function GameBackdrop() {
  const particles = [
    { left: '8%', delay: 0, duration: 11, size: 3 },
    { left: '18%', delay: 2, duration: 14, size: 2 },
    { left: '31%', delay: 5, duration: 12, size: 4 },
    { left: '47%', delay: 1, duration: 15, size: 2 },
    { left: '61%', delay: 4, duration: 13, size: 3 },
    { left: '74%', delay: 7, duration: 16, size: 2 },
    { left: '86%', delay: 3, duration: 12, size: 4 },
    { left: '94%', delay: 6, duration: 15, size: 2 },
  ];

  return (
    <div className="ambient game-ambient" aria-hidden="true">
      <motion.div
        className="orb orb-one"
        animate={{ x: [0, 45, -25, 0], y: [0, -30, 22, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb orb-two"
        animate={{ x: [0, -52, 28, 0], y: [0, 36, -18, 0], scale: [1, 0.93, 1.12, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="grid-glow" />
      <div className="game-scan-sweep" />
      <div className="particle-field">
        {particles.map((particle, index) => (
          <span
            key={index}
            style={{
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ModalFrame({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className={`core-modal game-modal ${wide ? 'core-modal-wide' : ''}`}
        initial={{ opacity: 0, scale: 0.9, y: 44, rotateX: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: 'spring', stiffness: 260, damping: 23 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <span className="hud-corner hud-corner-tl" />
        <span className="hud-corner hud-corner-br" />
        <button className="icon-button modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        {children}
      </motion.section>
    </motion.div>
  );
}

function ScannerModal({
  data,
  onClose,
  onDetected,
}: {
  data: AppData;
  onClose: () => void;
  onDetected: (mode: OperationMode, toolId: string) => void;
}) {
  const [mode, setMode] = useState<OperationMode>('delivery');
  const [isReading, setIsReading] = useState(false);

  const candidate = data.tools.find((tool) =>
    mode === 'delivery' ? tool.status === 'available' : tool.status === 'loaned',
  );

  const simulateScan = () => {
    if (isReading || !candidate) return;
    setIsReading(true);
    window.setTimeout(() => onDetected(mode, candidate.id), 950);
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow"><Zap size={14} /> Escáner táctico</span>
        <h2>Identificación QR</h2>
        <p>La cámara real llegará con la APK. Esta demo activa el mismo flujo de entrega y devolución.</p>
      </div>

      <div className="segmented-control">
        <button className={mode === 'delivery' ? 'active' : ''} onClick={() => setMode('delivery')}>
          <ArrowUpFromLine size={17} /> Entrega
        </button>
        <button className={mode === 'return' ? 'active' : ''} onClick={() => setMode('return')}>
          <ArrowDownToLine size={17} /> Devolución
        </button>
      </div>

      <button className="scanner-viewport game-scanner" onClick={simulateScan} type="button" disabled={!candidate}>
        <span className="scanner-orbit scanner-orbit-one" />
        <span className="scanner-orbit scanner-orbit-two" />
        <div className="scanner-corner corner-tl" />
        <div className="scanner-corner corner-tr" />
        <div className="scanner-corner corner-bl" />
        <div className="scanner-corner corner-br" />
        <motion.div
          className="scan-line"
          animate={{ y: [18, 220, 18] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="scan-target"
          animate={isReading
            ? { scale: [1, 1.14, 0.92, 1], rotate: [0, 4, -4, 0], opacity: [0.72, 1, 0.75, 1] }
            : { scale: [1, 1.05, 1], rotate: [0, 1.5, 0] }}
          transition={{ duration: isReading ? 0.58 : 2.2, repeat: Infinity }}
        >
          <QrCode size={78} strokeWidth={1.25} />
        </motion.div>
        <span>
          {!candidate
            ? `No hay herramientas para ${mode === 'delivery' ? 'entregar' : 'devolver'}`
            : isReading
              ? 'Objetivo identificado…'
              : 'Toca para simular una lectura'}
        </span>
      </button>

      <div className="scanner-status">
        <span className="live-dot" />
        Lector preparado · modo local
      </div>
    </ModalFrame>
  );
}

function OperationModal({
  data,
  mode,
  preselectedToolId,
  onClose,
  onConfirm,
}: {
  data: AppData;
  mode: OperationMode;
  preselectedToolId?: string;
  onClose: () => void;
  onConfirm: (payload: OperationPayload) => void;
}) {
  const candidates = data.tools.filter((tool) =>
    mode === 'delivery' ? tool.status === 'available' : tool.status === 'loaned',
  );
  const activeTechnicians = data.technicians.filter((technician) => technician.active);
  const [technicianId, setTechnicianId] = useState(activeTechnicians[0]?.id ?? '');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(
    preselectedToolId && candidates.some((tool) => tool.id === preselectedToolId) ? [preselectedToolId] : [],
  );
  const [condition, setCondition] = useState<ReturnCondition>('ok');
  const [notes, setNotes] = useState('');

  const toggleTool = (toolId: string) => {
    setSelectedToolIds((current) =>
      current.includes(toolId) ? current.filter((id) => id !== toolId) : [...current, toolId],
    );
  };

  const canConfirm = selectedToolIds.length > 0 && (mode === 'return' || Boolean(technicianId));

  return (
    <ModalFrame onClose={onClose} wide>
      <div className="modal-heading">
        <span className="eyebrow">
          {mode === 'delivery' ? <ArrowUpFromLine size={14} /> : <ArrowDownToLine size={14} />}
          Misión trazable
        </span>
        <h2>{mode === 'delivery' ? 'Entregar herramientas' : 'Registrar devolución'}</h2>
        <p>
          {mode === 'delivery'
            ? 'Selecciona el técnico y una o varias herramientas disponibles.'
            : 'Selecciona las herramientas que regresan y comprueba su estado.'}
        </p>
      </div>

      {mode === 'delivery' && (
        <label className="field-label">
          Técnico responsable
          <select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
            {activeTechnicians.map((technician) => (
              <option value={technician.id} key={technician.id}>
                {technician.name} · {technician.specialty}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="operation-tools">
        {candidates.length === 0 ? (
          <div className="empty-state compact-empty">
            <Boxes size={30} />
            <strong>No hay herramientas disponibles para esta operación</strong>
          </div>
        ) : (
          candidates.map((tool) => {
            const technician = data.technicians.find((item) => item.id === tool.holderTechnicianId);
            const selected = selectedToolIds.includes(tool.id);
            return (
              <motion.button
                key={tool.id}
                className={`select-tool ${selected ? 'selected' : ''}`}
                onClick={() => toggleTool(tool.id)}
                type="button"
                whileTap={{ scale: 0.975 }}
                layout
              >
                <span className="select-check">{selected && <Check size={16} />}</span>
                <span className="tool-avatar"><Wrench size={21} /></span>
                <span>
                  <strong>{tool.name}</strong>
                  <small>{tool.code} · {mode === 'return' ? technician?.name ?? 'Sin responsable' : tool.location}</small>
                </span>
              </motion.button>
            );
          })
        )}
      </div>

      {mode === 'return' && selectedToolIds.length > 0 && (
        <div className="condition-grid">
          {([
            ['ok', 'Correcta', 'Vuelve a disponible'],
            ['review', 'Revisar', 'Queda bloqueada'],
            ['damaged', 'Averiada', 'Fuera de uso'],
          ] as const).map(([value, label, detail]) => (
            <button
              key={value}
              className={condition === value ? 'active' : ''}
              onClick={() => setCondition(value)}
              type="button"
            >
              <strong>{label}</strong>
              <small>{detail}</small>
            </button>
          ))}
        </div>
      )}

      <label className="field-label">
        Observaciones opcionales
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Accesorios entregados, estado o incidencia…"
          rows={3}
        />
      </label>

      <div className="modal-footer">
        <span>{selectedToolIds.length} herramienta{selectedToolIds.length === 1 ? '' : 's'} seleccionada{selectedToolIds.length === 1 ? '' : 's'}</span>
        <motion.button
          className="primary-button mission-button"
          disabled={!canConfirm}
          onClick={() => onConfirm({ mode, toolIds: selectedToolIds, technicianId, condition, notes })}
          whileTap={{ scale: 0.96 }}
        >
          <Check size={18} /> Confirmar {mode === 'delivery' ? 'entrega' : 'devolución'}
        </motion.button>
      </div>
    </ModalFrame>
  );
}

function ToolFormModal({ onClose, onSave }: { onClose: () => void; onSave: (tool: Tool) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Herramienta general');
  const [location, setLocation] = useState('Almacén principal');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');

  const save = () => {
    if (!name.trim() || !code.trim()) return;
    const timestamp = new Date().toISOString();
    onSave({
      id: newId('tool'),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      qrCode: `ISIVOLT:TOOL:${code.trim().toUpperCase()}`,
      category: category.trim() || 'Sin categoría',
      location: location.trim() || 'Sin ubicación',
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      status: 'available',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow"><Plus size={14} /> Inventario</span>
        <h2>Nueva herramienta</h2>
        <p>El QR interno se genera automáticamente a partir del código.</p>
      </div>
      <div className="form-grid">
        <label className="field-label full-field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Taladro Hilti TE 30" /></label>
        <label className="field-label">Código<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="HER-015" /></label>
        <label className="field-label">Categoría<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        <label className="field-label">Marca<input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Hilti" /></label>
        <label className="field-label">Modelo<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="TE 30" /></label>
        <label className="field-label full-field">Ubicación<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
      </div>
      <div className="modal-footer">
        <span>Estado inicial: Disponible</span>
        <button className="primary-button" disabled={!name.trim() || !code.trim()} onClick={save}>
          <Plus size={18} /> Crear herramienta
        </button>
      </div>
    </ModalFrame>
  );
}

function TechnicianFormModal({
  technicianCount,
  onClose,
  onSave,
}: {
  technicianCount: number;
  onClose: () => void;
  onSave: (technician: Technician) => void;
}) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('Mantenimiento');

  const save = () => {
    if (!name.trim()) return;
    const timestamp = new Date().toISOString();
    onSave({
      id: newId('tech'),
      name: name.trim(),
      code: `TEC-${String(technicianCount + 1).padStart(3, '0')}`,
      specialty: specialty.trim() || 'Mantenimiento',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow"><UserRound size={14} /> Personal</span>
        <h2>Nuevo técnico</h2>
        <p>Se añadirá al directorio y podrá recibir herramientas inmediatamente.</p>
      </div>
      <div className="form-grid">
        <label className="field-label full-field">Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre y apellidos" /></label>
        <label className="field-label full-field">Especialidad<input value={specialty} onChange={(event) => setSpecialty(event.target.value)} /></label>
      </div>
      <div className="modal-footer">
        <span>Código automático: TEC-{String(technicianCount + 1).padStart(3, '0')}</span>
        <button className="primary-button" disabled={!name.trim()} onClick={save}>
          <Plus size={18} /> Crear técnico
        </button>
      </div>
    </ModalFrame>
  );
}

function AppHeader({ view, onSearch }: { view: View; onSearch: (value: string) => void }) {
  return (
    <header className="topbar core-topbar game-topbar">
      <motion.button
        className="brand brand-button"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <motion.span
          className="brand-mark game-brand-mark"
          animate={{ boxShadow: ['0 0 16px rgba(40,215,255,.18)', '0 0 30px rgba(40,215,255,.42)', '0 0 16px rgba(40,215,255,.18)'] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        >
          <Wrench size={22} />
        </motion.span>
        <span><strong>ISIVOLT</strong><small>Herramientas QR · {viewLabels[view]}</small></span>
      </motion.button>
      <div className="header-search">
        <Search size={17} />
        <input aria-label="Buscar" placeholder="Buscar herramienta o técnico…" onChange={(event) => onSearch(event.target.value)} />
      </div>
      <button className="profile-button" aria-label="Perfil de responsable"><span>IZ</span><i /></button>
    </header>
  );
}

function StatusBadge({ status }: { status: ToolStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-badge ${meta.className}`}>{meta.label}</span>;
}

function MovementRow({ movement, data, index = 0 }: { movement: Movement; data: AppData; index?: number }) {
  const tool = data.tools.find((item) => item.id === movement.toolId);
  const technician = data.technicians.find((item) => item.id === movement.technicianId);
  const meta = movementMeta[movement.type];
  const Icon = meta.icon;
  return (
    <motion.article
      className={`movement movement-${movement.nextStatus} game-movement`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ x: 5, scale: 1.005 }}
    >
      <span className="movement-icon"><Icon size={18} /></span>
      <span className="movement-main"><strong>{tool?.name ?? 'Herramienta eliminada'}</strong><span>{meta.label} · {technician?.name ?? 'Almacén'}</span></span>
      <time><Clock3 size={14} /> {formatDateTime(movement.occurredAt)}</time>
    </motion.article>
  );
}

function Dashboard({
  data,
  onOperation,
  onView,
  onScan,
}: {
  data: AppData;
  onOperation: (mode: OperationMode, toolId?: string) => void;
  onView: (view: View) => void;
  onScan: () => void;
}) {
  const stats = useMemo(() => ({
    available: data.tools.filter((tool) => tool.status === 'available').length,
    loaned: data.tools.filter((tool) => tool.status === 'loaned').length,
    attention: data.tools.filter((tool) => tool.status === 'review' || tool.status === 'damaged').length,
    technicians: data.technicians.filter((technician) => technician.active).length,
  }), [data]);

  const currentDate = useMemo(
    () => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [],
  );

  const recentMovements = [...data.movements]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);

  return (
    <>
      <motion.section className="hero command-hero game-hero" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Centro de control operativo</span>
          <h1>Buenos días, Isi</h1>
          <p className="hero-date">{currentDate} · {data.technicians.length} profesionales sincronizados</p>
        </div>
        <motion.button className="scan-main-button game-scan-main" onClick={onScan} whileHover={{ scale: 1.025, y: -3 }} whileTap={{ scale: 0.95 }}>
          <motion.span className="button-aura" animate={{ scale: [1, 1.28, 1], opacity: [0.38, 0, 0.38] }} transition={{ duration: 2, repeat: Infinity }} />
          <QrCode size={25} />
          <span><strong>Escanear QR</strong><small>Inicia una entrega o devolución</small></span>
          <ChevronRight size={20} />
        </motion.button>
      </motion.section>

      <section className="status-line game-status-line">
        <span className="live-dot" /> Sistema operativo
        <span className="status-divider" />
        <ShieldCheck size={15} /> Datos protegidos localmente
        <span className="status-divider" />
        <span className="system-level">NIVEL 02</span>
      </section>

      <section className="stats-grid core-stats">
        {[
          ['Disponibles', stats.available, PackageCheck, 'success'],
          ['Prestadas', stats.loaned, Users, 'warning'],
          ['Requieren atención', stats.attention, AlertTriangle, 'danger'],
          ['Técnicos activos', stats.technicians, UserRound, 'violet'],
        ].map(([label, value, Icon, tone], index) => {
          const CardIcon = Icon as typeof PackageCheck;
          return (
            <motion.article
              className={`stat-card tone-${tone} game-card`}
              key={String(label)}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.07 }}
              whileHover={{ y: -7, scale: 1.015 }}
            >
              <span className="card-shimmer" />
              <div className="stat-card-header"><span className="stat-icon"><CardIcon size={20} /></span><span className="mini-trend">EN VIVO</span></div>
              <motion.strong key={String(value)} initial={{ scale: 0.68, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>{String(value)}</motion.strong>
              <h3>{String(label)}</h3>
              <p>{label === 'Prestadas' ? 'Asignadas a técnicos' : label === 'Técnicos activos' ? 'Directorio hospitalario' : 'Actualización automática'}</p>
            </motion.article>
          );
        })}
      </section>

      <section className="content-grid core-content-grid">
        <div className="panel actions-panel game-panel">
          <div className="section-heading"><div><span className="eyebrow">Operaciones</span><h2>Acciones rápidas</h2></div><span className="hud-tag">CONTROL</span></div>
          <div className="quick-actions">
            <motion.button className="quick-action action-primary" onClick={() => onOperation('delivery')} whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }}><span className="quick-icon"><ArrowUpFromLine /></span><span><strong>Entregar</strong><small>Asignar varias herramientas</small></span><ChevronRight /></motion.button>
            <motion.button className="quick-action action-secondary" onClick={() => onOperation('return')} whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }}><span className="quick-icon"><ArrowDownToLine /></span><span><strong>Devolver</strong><small>Comprobar y registrar estado</small></span><ChevronRight /></motion.button>
            <motion.button className="quick-action action-neutral" onClick={() => onView('inventory')} whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }}><span className="quick-icon"><Boxes /></span><span><strong>Inventario</strong><small>Consultar disponibilidad y ubicación</small></span><ChevronRight /></motion.button>
            <motion.button className="quick-action action-neutral" onClick={() => onView('technicians')} whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }}><span className="quick-icon"><Users /></span><span><strong>Técnicos</strong><small>Ver las 12 especialidades</small></span><ChevronRight /></motion.button>
          </div>
        </div>

        <div className="panel movements-panel game-panel">
          <div className="section-heading"><div><span className="eyebrow"><span className="live-dot" /> Actividad</span><h2>Últimos movimientos</h2></div><button className="text-button" onClick={() => onView('movements')}>Ver todos</button></div>
          <div className="movement-list core-movement-list">
            {recentMovements.length === 0
              ? <div className="empty-state compact-empty"><History size={30} /><strong>Sin movimientos todavía</strong><span>Realiza la primera entrega para activar el historial.</span></div>
              : recentMovements.map((movement, index) => <MovementRow key={movement.id} movement={movement} data={data} index={index} />)}
          </div>
        </div>
      </section>
    </>
  );
}

function InventoryView({
  data,
  query,
  onAdd,
  onOperation,
}: {
  data: AppData;
  query: string;
  onAdd: () => void;
  onOperation: (mode: OperationMode, toolId?: string) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const filtered = data.tools.filter((tool) =>
    [tool.name, tool.code, tool.category, tool.location, tool.brand ?? '', tool.model ?? ''].some((value) => value.toLowerCase().includes(normalized)),
  );

  return (
    <section className="page-section">
      <div className="page-heading"><div><span className="eyebrow"><Boxes size={14} /> Control de activos</span><h1>Inventario</h1><p>{filtered.length} herramientas visibles · {data.tools.length} registradas</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> Nueva herramienta</button></div>
      <div className="tool-grid">
        {filtered.map((tool, index) => {
          const holder = data.technicians.find((technician) => technician.id === tool.holderTechnicianId);
          return (
            <motion.article
              className="tool-card game-card"
              key={tool.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.035 }}
              whileHover={{ y: -6, scale: 1.01 }}
              layout
            >
              <span className="card-shimmer" />
              <div className="tool-card-top"><span className="tool-avatar large-avatar"><Wrench size={24} /></span><StatusBadge status={tool.status} /></div>
              <div className="tool-card-body"><span className="tool-code">{tool.code}</span><h3>{tool.name}</h3><p>{tool.brand ? `${tool.brand}${tool.model ? ` · ${tool.model}` : ''}` : tool.category}</p></div>
              <dl className="tool-details"><div><dt>Ubicación</dt><dd>{tool.status === 'loaned' ? holder?.name ?? 'Sin responsable' : tool.location}</dd></div><div><dt>QR</dt><dd>{tool.qrCode}</dd></div>{tool.loanedAt && <div><dt>Tiempo fuera</dt><dd>{hoursSince(tool.loanedAt)} h</dd></div>}</dl>
              <div className="tool-card-actions">
                {tool.status === 'available' && <button onClick={() => onOperation('delivery', tool.id)}><ArrowUpFromLine size={16} /> Entregar</button>}
                {tool.status === 'loaned' && <button onClick={() => onOperation('return', tool.id)}><ArrowDownToLine size={16} /> Devolver</button>}
                {(tool.status === 'review' || tool.status === 'damaged') && <span className="blocked-label"><AlertTriangle size={15} /> Entrega bloqueada</span>}
              </div>
            </motion.article>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="empty-state"><Search size={34} /><strong>No hay resultados</strong><span>Prueba con otro código, nombre o ubicación.</span></div>}
    </section>
  );
}

function TechniciansView({ data, query, onAdd }: { data: AppData; query: string; onAdd: () => void }) {
  const [specialty, setSpecialty] = useState('Todas');
  const normalized = query.trim().toLowerCase();
  const filtered = data.technicians.filter((technician) => {
    const matchesSearch = [technician.name, technician.code, technician.specialty].some((value) => value.toLowerCase().includes(normalized));
    const matchesSpecialty = specialty === 'Todas' || technician.specialty === specialty;
    return matchesSearch && matchesSpecialty;
  });

  return (
    <section className="page-section">
      <div className="page-heading">
        <div><span className="eyebrow"><Users size={14} /> Directorio operativo</span><h1>Técnicos</h1><p>{filtered.length} visibles · {data.technicians.length} profesionales · 12 secciones</p></div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Nuevo técnico</button>
      </div>

      <div className="specialty-filter" role="tablist" aria-label="Filtrar por especialidad">
        {['Todas', ...technicianSpecialties].map((item) => (
          <button key={item} className={specialty === item ? 'active' : ''} onClick={() => setSpecialty(item)}>
            {item}
            <span>{item === 'Todas' ? data.technicians.length : data.technicians.filter((technician) => technician.specialty === item).length}</span>
          </button>
        ))}
      </div>

      <div className="technician-grid game-technician-grid">
        {filtered.map((technician, index) => {
          const assigned = data.tools.filter((tool) => tool.holderTechnicianId === technician.id && tool.status === 'loaned');
          return (
            <motion.article
              className="technician-card game-card technician-game-card"
              key={technician.id}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: Math.min(index, 12) * 0.025 }}
              whileHover={{ y: -7, scale: 1.012 }}
              layout
            >
              <span className="card-shimmer" />
              <div className="technician-head">
                <motion.span className="technician-avatar" whileHover={{ rotate: [0, -4, 4, 0] }}>
                  {technician.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </motion.span>
                <span className={technician.active ? 'active-person' : 'inactive-person'}>{technician.active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <span className="tool-code">{technician.code}</span>
              <h3>{technician.name}</h3>
              <p className="specialty-line">{technician.specialty}</p>
              <div className="assigned-summary"><strong>{assigned.length}</strong><span>herramientas asignadas</span></div>
              <div className="assigned-list">{assigned.length === 0 ? <small>Sin material prestado</small> : assigned.map((tool) => <span key={tool.id}><Wrench size={14} /> {tool.name}</span>)}</div>
            </motion.article>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="empty-state"><Users size={34} /><strong>No hay técnicos en este filtro</strong><span>Selecciona otra especialidad o cambia la búsqueda.</span></div>}
    </section>
  );
}

function MovementsView({ data, query }: { data: AppData; query: string }) {
  const normalized = query.trim().toLowerCase();
  const filtered = [...data.movements]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .filter((movement) => {
      const tool = data.tools.find((item) => item.id === movement.toolId);
      const technician = data.technicians.find((item) => item.id === movement.technicianId);
      return [tool?.name ?? '', tool?.code ?? '', technician?.name ?? '', movementMeta[movement.type].label].some((value) => value.toLowerCase().includes(normalized));
    });

  return (
    <section className="page-section">
      <div className="page-heading"><div><span className="eyebrow"><ClipboardList size={14} /> Auditoría</span><h1>Historial de movimientos</h1><p>Los movimientos permanecen registrados para mantener la trazabilidad.</p></div><span className="record-counter">{filtered.length} registros</span></div>
      <div className="panel movement-history game-panel">
        {filtered.length === 0
          ? <div className="empty-state"><History size={34} /><strong>Sin movimientos registrados</strong><span>Las entregas y devoluciones aparecerán aquí.</span></div>
          : filtered.map((movement, index) => <MovementRow movement={movement} data={data} index={index} key={movement.id} />)}
      </div>
    </section>
  );
}

export default function AppV2() {
  const [data, setData] = useState<AppData>(() => normalizeData(loadAppData()));
  const [view, setView] = useState<View>('dashboard');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [operation, setOperation] = useState<{ mode: OperationMode; toolId?: string } | null>(null);
  const [toolFormOpen, setToolFormOpen] = useState(false);
  const [technicianFormOpen, setTechnicianFormOpen] = useState(false);

  useEffect(() => saveAppData(data), [data]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const openOperation = (mode: OperationMode, toolId?: string) => setOperation({ mode, toolId });

  const commitOperation = (payload: OperationPayload) => {
    const occurredAt = new Date().toISOString();
    let movementCount = 0;

    setData((current) => {
      const movementBatch: Movement[] = [];
      const tools = current.tools.map((tool) => {
        if (!payload.toolIds.includes(tool.id)) return tool;
        movementCount += 1;

        if (payload.mode === 'delivery') {
          movementBatch.push({
            id: newId('mov'),
            type: 'delivery',
            toolId: tool.id,
            technicianId: payload.technicianId,
            operatorName: OPERATOR_NAME,
            occurredAt,
            previousStatus: tool.status,
            nextStatus: 'loaned',
            notes: payload.notes || undefined,
          });
          return {
            ...tool,
            status: 'loaned' as ToolStatus,
            holderTechnicianId: payload.technicianId,
            loanedAt: occurredAt,
            updatedAt: occurredAt,
          };
        }

        const nextStatus: ToolStatus = payload.condition === 'ok' ? 'available' : payload.condition === 'review' ? 'review' : 'damaged';
        movementBatch.push({
          id: newId('mov'),
          type: payload.condition === 'ok' ? 'return' : 'incident',
          toolId: tool.id,
          technicianId: tool.holderTechnicianId,
          operatorName: OPERATOR_NAME,
          occurredAt,
          previousStatus: tool.status,
          nextStatus,
          condition: payload.condition,
          notes: payload.notes || undefined,
        });
        return {
          ...tool,
          status: nextStatus,
          holderTechnicianId: undefined,
          loanedAt: undefined,
          updatedAt: occurredAt,
          notes: payload.notes || tool.notes,
        };
      });

      return { ...current, tools, movements: [...movementBatch, ...current.movements] };
    });

    setOperation(null);
    setToast({
      title: payload.mode === 'delivery' ? 'Entrega registrada' : 'Devolución registrada',
      detail: `${movementCount || payload.toolIds.length} movimiento${payload.toolIds.length === 1 ? '' : 's'} guardado${payload.toolIds.length === 1 ? '' : 's'} correctamente.`,
      points: payload.toolIds.length * 10,
    });
  };

  const addTool = (tool: Tool) => {
    setData((current) => ({ ...current, tools: [tool, ...current.tools] }));
    setToolFormOpen(false);
    setToast({ title: 'Herramienta creada', detail: `${tool.name} ya está disponible en el inventario.`, points: 25 });
  };

  const addTechnician = (technician: Technician) => {
    setData((current) => ({ ...current, technicians: [technician, ...current.technicians] }));
    setTechnicianFormOpen(false);
    setToast({ title: 'Técnico creado', detail: `${technician.name} ya puede recibir herramientas.`, points: 25 });
  };

  const navItems: Array<{ id: View; label: string; icon: typeof Boxes }> = [
    { id: 'dashboard', label: 'Inicio', icon: Sparkles },
    { id: 'inventory', label: 'Inventario', icon: Boxes },
    { id: 'technicians', label: 'Técnicos', icon: Users },
    { id: 'movements', label: 'Historial', icon: History },
  ];

  const renderNavItem = ({ id, label, icon: Icon }: (typeof navItems)[number]) => (
    <motion.button
      key={id}
      className={view === id ? 'active nav-active' : ''}
      onClick={() => { setView(id); setQuery(''); }}
      whileTap={{ scale: 0.9 }}
    >
      <Icon size={19} />
      <span>{label}</span>
      {view === id && <motion.i className="nav-active-indicator" layoutId="nav-active-indicator" />}
    </motion.button>
  );

  return (
    <div className="app-shell core-app-shell game-app-shell">
      <GameBackdrop />
      <AppHeader view={view} onSearch={setQuery} />

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="view-stage"
            initial={{ opacity: 0, x: 18, filter: 'blur(5px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -14, filter: 'blur(4px)' }}
            transition={{ duration: 0.27, ease: 'easeOut' }}
          >
            {view === 'dashboard' && <Dashboard data={data} onOperation={openOperation} onView={setView} onScan={() => setScannerOpen(true)} />}
            {view === 'inventory' && <InventoryView data={data} query={query} onAdd={() => setToolFormOpen(true)} onOperation={openOperation} />}
            {view === 'technicians' && <TechniciansView data={data} query={query} onAdd={() => setTechnicianFormOpen(true)} />}
            {view === 'movements' && <MovementsView data={data} query={query} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottom-nav core-bottom-nav game-bottom-nav" aria-label="Navegación principal">
        {navItems.slice(0, 2).map(renderNavItem)}
        <motion.button
          className="nav-scan-button"
          onClick={() => setScannerOpen(true)}
          whileHover={{ y: -4, scale: 1.04 }}
          whileTap={{ scale: 0.88 }}
          aria-label="Escanear código QR"
        >
          <motion.span
            className="nav-scan-ring"
            animate={{ scale: [0.9, 1.35, 1.35], opacity: [0.55, 0, 0] }}
            transition={{ duration: 1.9, repeat: Infinity }}
          />
          <span className="nav-scan-core"><QrCode size={28} /></span>
          <span className="nav-scan-label">Escanear</span>
        </motion.button>
        {navItems.slice(2).map(renderNavItem)}
      </nav>

      <button
        className="demo-reset"
        onClick={() => {
          setData(normalizeData(resetAppData()));
          setToast({ title: 'Datos restaurados', detail: 'Se ha recuperado la configuración inicial y los 76 técnicos.', points: 0 });
        }}
      >
        Restaurar demo
      </button>

      <AnimatePresence>
        {scannerOpen && <ScannerModal data={data} onClose={() => setScannerOpen(false)} onDetected={(mode, toolId) => { setScannerOpen(false); openOperation(mode, toolId); }} />}
        {operation && <OperationModal data={data} mode={operation.mode} preselectedToolId={operation.toolId} onClose={() => setOperation(null)} onConfirm={commitOperation} />}
        {toolFormOpen && <ToolFormModal onClose={() => setToolFormOpen(false)} onSave={addTool} />}
        {technicianFormOpen && <TechnicianFormModal technicianCount={data.technicians.length} onClose={() => setTechnicianFormOpen(false)} onSave={addTechnician} />}
        {toast && (
          <motion.div className="success-toast core-toast game-toast" initial={{ opacity: 0, y: 32, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.96 }}>
            <span className="toast-check"><Check size={20} /></span>
            <span><strong>{toast.title}</strong><small>{toast.detail}</small></span>
            {toast.points ? <motion.b initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>+{toast.points} XP</motion.b> : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
