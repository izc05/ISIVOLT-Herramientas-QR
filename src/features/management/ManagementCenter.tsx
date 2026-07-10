import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileSpreadsheet,
  MapPin,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AppData,
  MaintenanceRecord,
  Technician,
  Tool,
  ToolAccessory,
  ToolServiceStatus,
} from '../../domain/types';
import { saveAppData } from '../../services/storage';
import { buildManagementAlerts } from './alerts';
import { importInventoryExcel, type InventoryImportResult } from './inventoryImport';
import {
  archiveAccessory,
  createAccessory,
  createMaintenanceRecord,
  createManagedTechnician,
  createManagedTool,
  getManagementData,
  saveAccessory,
  saveMaintenanceRecord,
  saveManagedTechnician,
  saveManagedTool,
} from './managementService';

type ManagementTab = 'summary' | 'tools' | 'technicians' | 'import';

type ManagementCenterProps = {
  onSaved: () => void;
};

const serviceLabels: Record<NonNullable<ToolServiceStatus>, string> = {
  none: 'Sin estado especial',
  reserved: 'Reservada',
  repair: 'En reparación',
  waiting_parts: 'Pendiente de repuesto',
  calibration: 'En calibración',
  out_of_service: 'Fuera de servicio',
  lost: 'Extraviada',
};

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha inválida'
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
};

const numberOrUndefined = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return <label className={`management-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}

function ToolEditor({
  tool,
  data,
  onClose,
  onSaved,
}: {
  tool: Tool;
  data: AppData;
  onClose: () => void;
  onSaved: (data: AppData) => void;
}) {
  const [draft, setDraft] = useState(tool);
  const [error, setError] = useState('');
  const [accessoryName, setAccessoryName] = useState('');
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceRecord>(() => createMaintenanceRecord(tool.id));
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const accessories = (data.accessories ?? []).filter((item) => item.toolId === tool.id && item.active);
  const maintenance = (data.maintenanceRecords ?? []).filter((item) => item.toolId === tool.id);

  const patch = <K extends keyof Tool>(key: K, value: Tool[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const saveTool = () => {
    try {
      setError('');
      onSaved(saveManagedTool(draft));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar la herramienta.');
    }
  };

  const addAccessory = () => {
    try {
      const accessory = { ...createAccessory(tool.id), name: accessoryName };
      const next = saveAccessory(accessory);
      setAccessoryName('');
      onSaved(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido añadir el accesorio.');
    }
  };

  const updateAccessory = (accessory: ToolAccessory, patchValue: Partial<ToolAccessory>) => {
    try {
      onSaved(saveAccessory({ ...accessory, ...patchValue }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido actualizar el accesorio.');
    }
  };

  const addMaintenance = () => {
    try {
      const next = saveMaintenanceRecord(maintenanceDraft);
      onSaved(next);
      setMaintenanceDraft(createMaintenanceRecord(tool.id));
      setMaintenanceOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido registrar la actuación.');
    }
  };

  return (
    <motion.div className="management-editor-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.section className="management-editor" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 280 }} onClick={(event) => event.stopPropagation()}>
        <header className="management-editor-header">
          <div><span><Wrench size={22} /></span><div><small>Ficha administrativa</small><h2>{draft.name || 'Nueva herramienta'}</h2><p>{draft.code || 'Código pendiente'}</p></div></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
        </header>

        <div className="management-editor-scroll">
          <section className="management-form-section">
            <h3><Boxes size={18} /> Identificación</h3>
            <div className="management-form-grid">
              <Field label="Código"><input value={draft.code} onChange={(event) => patch('code', event.target.value.toUpperCase())} /></Field>
              <Field label="Nombre" wide><input value={draft.name} onChange={(event) => patch('name', event.target.value)} /></Field>
              <Field label="Categoría"><input value={draft.category} onChange={(event) => patch('category', event.target.value)} list="management-categories" /></Field>
              <Field label="Ubicación"><input value={draft.location} onChange={(event) => patch('location', event.target.value)} list="management-locations" /></Field>
              <Field label="Marca"><input value={draft.brand ?? ''} onChange={(event) => patch('brand', event.target.value || undefined)} /></Field>
              <Field label="Modelo"><input value={draft.model ?? ''} onChange={(event) => patch('model', event.target.value || undefined)} /></Field>
              <Field label="Número de serie" wide><input value={draft.serialNumber ?? ''} onChange={(event) => patch('serialNumber', event.target.value || undefined)} /></Field>
            </div>
          </section>

          <section className="management-form-section">
            <h3><ShieldCheck size={18} /> Estado y disponibilidad</h3>
            <div className="management-form-grid">
              <Field label="Estado base">
                <select value={draft.status} onChange={(event) => patch('status', event.target.value as Tool['status'])} disabled={draft.status === 'loaned'}>
                  <option value="available">Disponible</option>
                  <option value="review">En revisión</option>
                  <option value="damaged">Averiada</option>
                  <option value="retired">Baja</option>
                  {draft.status === 'loaned' && <option value="loaned">Prestada</option>}
                </select>
              </Field>
              <Field label="Situación especial">
                <select value={draft.serviceStatus ?? 'none'} onChange={(event) => patch('serviceStatus', event.target.value as ToolServiceStatus)}>
                  {Object.entries(serviceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </Field>
              {draft.serviceStatus === 'reserved' && (
                <Field label="Reservada para" wide>
                  <select value={draft.reservedTechnicianId ?? ''} onChange={(event) => patch('reservedTechnicianId', event.target.value || undefined)}>
                    <option value="">Selecciona técnico</option>
                    {data.technicians.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Plazo máximo de préstamo (días)" wide><input inputMode="numeric" value={draft.maxLoanDays ?? ''} onChange={(event) => patch('maxLoanDays', numberOrUndefined(event.target.value))} /></Field>
            </div>
          </section>

          <section className="management-form-section">
            <h3><CircleDollarSign size={18} /> Compra y proveedor</h3>
            <div className="management-form-grid">
              <Field label="Fecha de compra"><input type="date" value={draft.purchaseDate ?? ''} onChange={(event) => patch('purchaseDate', event.target.value || undefined)} /></Field>
              <Field label="Coste (€)"><input inputMode="decimal" value={draft.purchaseCost ?? ''} onChange={(event) => patch('purchaseCost', numberOrUndefined(event.target.value))} /></Field>
              <Field label="Proveedor" wide><input value={draft.supplier ?? ''} onChange={(event) => patch('supplier', event.target.value || undefined)} /></Field>
            </div>
          </section>

          <section className="management-form-section">
            <h3><CalendarClock size={18} /> Revisiones y calibración</h3>
            <div className="management-form-grid">
              <Field label="Próxima revisión"><input type="date" value={draft.nextReviewDate ?? ''} onChange={(event) => patch('nextReviewDate', event.target.value || undefined)} /></Field>
              <Field label="Próxima calibración"><input type="date" value={draft.nextCalibrationDate ?? ''} onChange={(event) => patch('nextCalibrationDate', event.target.value || undefined)} /></Field>
              <Field label="Observaciones" wide><textarea rows={3} value={draft.notes ?? ''} onChange={(event) => patch('notes', event.target.value || undefined)} /></Field>
            </div>
          </section>

          <section className="management-form-section">
            <h3><PackagePlus size={18} /> Accesorios</h3>
            <div className="accessory-add-row">
              <input value={accessoryName} onChange={(event) => setAccessoryName(event.target.value)} placeholder="Batería, cargador, maletín…" />
              <button type="button" onClick={addAccessory} disabled={!accessoryName.trim()}><Plus size={17} /> Añadir</button>
            </div>
            <div className="management-accessory-list">
              {accessories.length === 0 ? <p>Sin accesorios definidos.</p> : accessories.map((accessory) => (
                <article key={accessory.id}>
                  <div><strong>{accessory.name}</strong><small>{accessory.required ? 'Obligatorio' : 'Opcional'}</small></div>
                  <select value={accessory.condition ?? 'not_checked'} onChange={(event) => updateAccessory(accessory, { condition: event.target.value as ToolAccessory['condition'] })}>
                    <option value="not_checked">Sin comprobar</option>
                    <option value="ok">Correcto</option>
                    <option value="missing">Falta</option>
                    <option value="damaged">Dañado</option>
                  </select>
                  <button type="button" onClick={() => onSaved(archiveAccessory(accessory.id))} aria-label="Archivar accesorio"><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
          </section>

          <section className="management-form-section">
            <div className="management-section-heading"><h3><ClipboardList size={18} /> Mantenimiento</h3><button type="button" onClick={() => setMaintenanceOpen((value) => !value)}><Plus size={16} /> Nueva actuación</button></div>
            {maintenanceOpen && (
              <div className="maintenance-create-card">
                <div className="management-form-grid">
                  <Field label="Tipo"><select value={maintenanceDraft.type} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, type: event.target.value as MaintenanceRecord['type'] }))}><option value="incident">Incidencia</option><option value="inspection">Inspección</option><option value="repair">Reparación</option><option value="calibration">Calibración</option><option value="status_change">Cambio de estado</option></select></Field>
                  <Field label="Estado"><select value={maintenanceDraft.status} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, status: event.target.value as MaintenanceRecord['status'] }))}><option value="open">Abierta</option><option value="in_progress">En curso</option><option value="waiting_parts">Esperando repuesto</option><option value="completed">Terminada</option><option value="cancelled">Cancelada</option></select></Field>
                  <Field label="Título" wide><input value={maintenanceDraft.title} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, title: event.target.value }))} /></Field>
                  <Field label="Descripción" wide><textarea rows={3} value={maintenanceDraft.description} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, description: event.target.value }))} /></Field>
                  <Field label="Fecha límite"><input type="date" value={maintenanceDraft.dueAt?.slice(0, 10) ?? ''} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, dueAt: event.target.value || undefined }))} /></Field>
                  <Field label="Asignado a"><input value={maintenanceDraft.assignedTo ?? ''} onChange={(event) => setMaintenanceDraft((current) => ({ ...current, assignedTo: event.target.value || undefined }))} /></Field>
                </div>
                <button className="management-primary" type="button" onClick={addMaintenance}><Check size={17} /> Registrar actuación</button>
              </div>
            )}
            <div className="maintenance-list">
              {maintenance.length === 0 ? <p>Sin expedientes de mantenimiento.</p> : maintenance.slice(0, 8).map((record) => (
                <article key={record.id} className={`maintenance-${record.status}`}>
                  <div><strong>{record.title}</strong><small>{record.type} · {formatDate(record.openedAt)}</small></div>
                  <span>{record.status.replace('_', ' ')}</span>
                </article>
              ))}
            </div>
          </section>

          {error && <p className="management-error"><AlertTriangle size={17} /> {error}</p>}
        </div>

        <footer className="management-editor-footer">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="management-primary" type="button" onClick={saveTool}><Check size={18} /> Guardar ficha</button>
        </footer>

        <datalist id="management-categories">{[...new Set(data.tools.map((item) => item.category))].map((value) => <option value={value} key={value} />)}</datalist>
        <datalist id="management-locations">{[...new Set(data.tools.map((item) => item.location))].map((value) => <option value={value} key={value} />)}</datalist>
      </motion.section>
    </motion.div>
  );
}

function TechnicianEditor({
  technician,
  onClose,
  onSaved,
}: {
  technician: Technician;
  onClose: () => void;
  onSaved: (data: AppData) => void;
}) {
  const [draft, setDraft] = useState(technician);
  const [error, setError] = useState('');
  const patch = <K extends keyof Technician>(key: K, value: Technician[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = () => {
    try {
      onSaved(saveManagedTechnician(draft));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar el técnico.');
    }
  };

  return (
    <motion.div className="management-editor-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.section className="management-editor management-editor-compact" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} onClick={(event) => event.stopPropagation()}>
        <header className="management-editor-header"><div><span><UserRound size={22} /></span><div><small>Directorio profesional</small><h2>{draft.name || 'Nuevo técnico'}</h2><p>{draft.code}</p></div></div><button onClick={onClose}><X size={22} /></button></header>
        <div className="management-editor-scroll">
          <div className="management-form-grid">
            <Field label="Código"><input value={draft.code} onChange={(event) => patch('code', event.target.value.toUpperCase())} /></Field>
            <Field label="Nombre" wide><input value={draft.name} onChange={(event) => patch('name', event.target.value)} /></Field>
            <Field label="Especialidad"><input value={draft.specialty} onChange={(event) => patch('specialty', event.target.value)} /></Field>
            <Field label="Cargo"><input value={draft.role ?? ''} onChange={(event) => patch('role', event.target.value || undefined)} /></Field>
            <Field label="Teléfono"><input inputMode="tel" value={draft.phone ?? ''} onChange={(event) => patch('phone', event.target.value || undefined)} /></Field>
            <Field label="Extensión"><input inputMode="numeric" value={draft.extension ?? ''} onChange={(event) => patch('extension', event.target.value || undefined)} /></Field>
            <Field label="Correo" wide><input type="email" value={draft.email ?? ''} onChange={(event) => patch('email', event.target.value || undefined)} /></Field>
            <label className="management-toggle wide"><input type="checkbox" checked={draft.active} onChange={(event) => patch('active', event.target.checked)} /><span><strong>Técnico activo</strong><small>Puede recibir herramientas y aparecer en operaciones.</small></span></label>
          </div>
          {error && <p className="management-error"><AlertTriangle size={17} /> {error}</p>}
        </div>
        <footer className="management-editor-footer"><button type="button" onClick={onClose}>Cancelar</button><button className="management-primary" type="button" onClick={save}><Check size={18} /> Guardar técnico</button></footer>
      </motion.section>
    </motion.div>
  );
}

export default function ManagementCenter({ onSaved }: ManagementCenterProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ManagementTab>('summary');
  const [data, setData] = useState<AppData>(() => getManagementData());
  const [query, setQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [importResult, setImportResult] = useState<InventoryImportResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const alerts = useMemo(() => buildManagementAlerts(data), [data]);
  const normalizedQuery = query.trim().toLowerCase();

  const commit = (next: AppData) => {
    setData({ ...next, accessories: next.accessories ?? [], maintenanceRecords: next.maintenanceRecords ?? [] });
    onSaved();
  };

  const openCenter = () => {
    setData(getManagementData());
    setOpen(true);
  };

  const filteredTools = data.tools.filter((tool) => [tool.code, tool.name, tool.category, tool.location, tool.brand ?? '', tool.model ?? ''].some((value) => value.toLowerCase().includes(normalizedQuery)));
  const filteredTechnicians = data.technicians.filter((technician) => [technician.code, technician.name, technician.specialty, technician.role ?? ''].some((value) => value.toLowerCase().includes(normalizedQuery)));

  const importFile = async (file?: File) => {
    if (!file) return;
    setImportBusy(true);
    setError('');
    try {
      const result = await importInventoryExcel(file, data);
      saveAppData(result.data);
      setImportResult(result);
      commit(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido importar el archivo.');
    } finally {
      setImportBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const tabs: Array<{ id: ManagementTab; label: string; icon: typeof Boxes; count?: number }> = [
    { id: 'summary', label: 'Control', icon: ShieldCheck, count: alerts.filter((item) => item.severity !== 'info').length },
    { id: 'tools', label: 'Inventario', icon: Boxes, count: data.tools.length },
    { id: 'technicians', label: 'Técnicos', icon: Users, count: data.technicians.length },
    { id: 'import', label: 'Excel', icon: FileSpreadsheet },
  ];

  return (
    <>
      <motion.button className="management-launcher" type="button" onClick={openCenter} whileTap={{ scale: 0.9 }} aria-label="Abrir gestión avanzada">
        <Settings2 size={21} /><span>Gestión</span>{alerts.some((item) => item.severity === 'critical') && <i />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="management-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.section className="management-center" initial={{ opacity: 0, y: 45, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 25, scale: 0.98 }}>
              <header className="management-topbar">
                <div><span><Settings2 size={24} /></span><div><small>Administración local</small><h1>Centro de gestión</h1><p>{data.tools.length} activos · {alerts.length} avisos</p></div></div>
                <button onClick={() => setOpen(false)} aria-label="Cerrar gestión"><X size={23} /></button>
              </header>

              <nav className="management-tabs">
                {tabs.map(({ id, label, icon: Icon, count }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setQuery(''); }}><Icon size={18} /><span>{label}</span>{count !== undefined && <b>{count}</b>}</button>)}
              </nav>

              {(tab === 'tools' || tab === 'technicians') && <label className="management-search"><Search size={18} /><input placeholder="Buscar…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}

              <main className="management-content">
                {tab === 'summary' && (
                  <div className="management-dashboard">
                    <section className="management-kpis">
                      <article><Boxes size={21} /><span><strong>{data.tools.length}</strong><small>Herramientas</small></span></article>
                      <article><Users size={21} /><span><strong>{data.technicians.filter((item) => item.active).length}</strong><small>Técnicos activos</small></span></article>
                      <article><AlertTriangle size={21} /><span><strong>{alerts.filter((item) => item.severity === 'critical').length}</strong><small>Críticas</small></span></article>
                      <article><ClipboardList size={21} /><span><strong>{(data.maintenanceRecords ?? []).filter((item) => !['completed', 'cancelled'].includes(item.status)).length}</strong><small>Actuaciones abiertas</small></span></article>
                    </section>
                    <section className="management-alert-panel">
                      <div className="management-section-heading"><h2><AlertTriangle size={19} /> Alertas del almacén</h2><span>{alerts.length}</span></div>
                      {alerts.length === 0 ? <div className="management-empty"><ShieldCheck size={36} /><strong>Sin alertas</strong><span>El inventario no presenta vencimientos ni incidencias.</span></div> : alerts.map((alert) => {
                        const tool = data.tools.find((item) => item.id === alert.toolId);
                        return <button key={alert.id} className={`management-alert alert-${alert.severity}`} onClick={() => tool && setSelectedTool(tool)}><span><AlertTriangle size={18} /></span><div><strong>{alert.title}</strong><small>{alert.detail}</small></div><ChevronRight size={18} /></button>;
                      })}
                    </section>
                  </div>
                )}

                {tab === 'tools' && (
                  <section className="management-list-section">
                    <div className="management-section-heading"><h2>Inventario completo</h2><button onClick={() => setSelectedTool(createManagedTool())}><Plus size={17} /> Nueva</button></div>
                    <div className="management-card-list">
                      {filteredTools.map((tool) => <button className="management-tool-card" key={tool.id} onClick={() => setSelectedTool(tool)}><span className={`management-status-dot status-${tool.status}`} /><div><small>{tool.code} · {tool.category}</small><strong>{tool.name}</strong><span><MapPin size={13} /> {tool.location}{tool.serviceStatus && tool.serviceStatus !== 'none' ? ` · ${serviceLabels[tool.serviceStatus]}` : ''}</span></div><Pencil size={18} /></button>)}
                    </div>
                  </section>
                )}

                {tab === 'technicians' && (
                  <section className="management-list-section">
                    <div className="management-section-heading"><h2>Directorio técnico</h2><button onClick={() => setSelectedTechnician(createManagedTechnician())}><Plus size={17} /> Nuevo</button></div>
                    <div className="management-card-list">
                      {filteredTechnicians.map((technician) => <button className="management-tool-card" key={technician.id} onClick={() => setSelectedTechnician(technician)}><span className={`management-person-avatar ${technician.active ? '' : 'inactive'}`}>{technician.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><small>{technician.code} · {technician.specialty}</small><strong>{technician.name}</strong><span>{technician.role || 'Sin cargo definido'} · {technician.active ? 'Activo' : 'Inactivo'}</span></div><Pencil size={18} /></button>)}
                    </div>
                  </section>
                )}

                {tab === 'import' && (
                  <section className="management-import-section">
                    <div className="management-import-hero"><span><FileSpreadsheet size={38} /></span><h2>Importar inventario desde Excel</h2><p>Crea herramientas nuevas y actualiza las existentes utilizando el código interno como identificador. Los préstamos actuales no se sobrescriben.</p><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => { void importFile(event.target.files?.[0]); }} /><button className="management-primary" onClick={() => inputRef.current?.click()} disabled={importBusy}><Upload size={19} /> {importBusy ? 'Procesando…' : 'Seleccionar archivo Excel'}</button></div>
                    <div className="management-import-columns"><h3>Columnas reconocidas</h3><div>{['Código', 'Nombre / Herramienta', 'Categoría', 'Marca', 'Modelo', 'Nº serie', 'Ubicación', 'Estado', 'Fecha compra', 'Coste', 'Proveedor', 'Próxima revisión', 'Próxima calibración', 'Días máximos'].map((item) => <span key={item}>{item}</span>)}</div></div>
                    {importResult && <div className="management-import-result"><Check size={24} /><div><strong>Importación terminada</strong><span>{importResult.created} creadas · {importResult.updated} actualizadas · {importResult.skipped} omitidas</span>{importResult.errors.length > 0 && <details><summary>Ver avisos ({importResult.errors.length})</summary>{importResult.errors.slice(0, 30).map((item) => <p key={item}>{item}</p>)}</details>}</div></div>}
                    {error && <p className="management-error"><AlertTriangle size={17} /> {error}</p>}
                  </section>
                )}
              </main>
            </motion.section>
          </motion.div>
        )}

        {selectedTool && <ToolEditor tool={selectedTool} data={data} onClose={() => setSelectedTool(null)} onSaved={commit} />}
        {selectedTechnician && <TechnicianEditor technician={selectedTechnician} onClose={() => setSelectedTechnician(null)} onSaved={commit} />}
      </AnimatePresence>
    </>
  );
}
