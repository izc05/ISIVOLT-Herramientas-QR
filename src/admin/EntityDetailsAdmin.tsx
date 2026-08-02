import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Check, UserRound } from 'lucide-react';
import PhotoManager from '../photos/PhotoManager';
import { saveData } from '../storage';
import type {
  AppData,
  Technician,
  TechnicianStatus,
  Tool,
  ToolKind,
  ToolServiceState,
} from '../types';

type EntityDetailsAdminProps = {
  data: AppData;
  onDataChange(data: AppData): void;
  onMessage(message: string): void;
};

type EntityMode = 'tool' | 'technician';

const toolKinds: Array<{ value: ToolKind; label: string }> = [
  { value: 'returnable-tool', label: 'Herramienta retornable' },
  { value: 'loanable-material', label: 'Material prestable' },
  { value: 'measuring-equipment', label: 'Equipo de medida' },
  { value: 'kit', label: 'Maletín o conjunto' },
  { value: 'ppe', label: 'EPI' },
  { value: 'consumable', label: 'Consumible' },
  { value: 'other', label: 'Otro' },
];

const serviceStates: Array<{ value: ToolServiceState; label: string }> = [
  { value: 'ready', label: 'Preparada' },
  { value: 'reserved', label: 'Reservada' },
  { value: 'review', label: 'En revisión' },
  { value: 'repair', label: 'En reparación' },
  { value: 'lost', label: 'Perdida' },
  { value: 'retired', label: 'Retirada' },
];

const technicianStatuses: Array<{ value: TechnicianStatus; label: string }> = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'absent', label: 'Ausente' },
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'leave', label: 'Baja' },
  { value: 'blocked', label: 'Bloqueado' },
];

const optionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export default function EntityDetailsAdmin({ data, onDataChange, onMessage }: EntityDetailsAdminProps) {
  const [mode, setMode] = useState<EntityMode>('tool');
  const [selectedId, setSelectedId] = useState('');
  const [toolDraft, setToolDraft] = useState<Tool | null>(null);
  const [technicianDraft, setTechnicianDraft] = useState<Technician | null>(null);

  const sortedTools = useMemo(() => [...data.tools].sort((a, b) => a.code.localeCompare(b.code, 'es')), [data.tools]);
  const sortedTechnicians = useMemo(() => [...data.technicians].sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.technicians]);
  const toolCategories = useMemo(() => (data.toolCategories ?? []).filter((entry) => entry.active).sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.toolCategories]);
  const technicianCategories = useMemo(() => (data.technicianCategories ?? []).filter((entry) => entry.active).sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.technicianCategories]);
  const locations = useMemo(() => (data.locations ?? []).filter((entry) => entry.active).sort((a, b) => a.name.localeCompare(b.name, 'es')), [data.locations]);

  useEffect(() => {
    if (mode === 'tool') {
      const selected = data.tools.find((tool) => tool.id === selectedId) ?? null;
      setToolDraft(selected ? { ...selected, photos: [...(selected.photos ?? [])] } : null);
      setTechnicianDraft(null);
    } else {
      const selected = data.technicians.find((technician) => technician.id === selectedId) ?? null;
      setTechnicianDraft(selected ? { ...selected, photos: [...(selected.photos ?? [])] } : null);
      setToolDraft(null);
    }
  }, [mode, selectedId, data.tools, data.technicians]);

  const changeMode = (next: EntityMode) => {
    setMode(next);
    setSelectedId('');
    setToolDraft(null);
    setTechnicianDraft(null);
  };

  const commit = (next: AppData) => {
    saveData(next);
    onDataChange(next);
  };

  const saveTool = () => {
    if (!toolDraft) return;
    const category = (data.toolCategories ?? []).find((entry) => entry.id === toolDraft.categoryId);
    const location = (data.locations ?? []).find((entry) => entry.id === toolDraft.locationId);
    if (!toolDraft.name.trim() || !category) {
      onMessage('Nombre y categoría son obligatorios.');
      return;
    }
    const updatedAt = new Date().toISOString();
    const normalized: Tool = {
      ...toolDraft,
      name: toolDraft.name.trim(),
      category: category.name,
      categoryId: category.id,
      location: location?.name ?? 'Sin ubicación',
      locationId: location?.id,
      kind: toolDraft.kind ?? 'returnable-tool',
      serviceState: toolDraft.serviceState ?? 'ready',
      description: toolDraft.description?.trim() || undefined,
      notes: toolDraft.notes?.trim() || undefined,
      brand: toolDraft.brand?.trim() || undefined,
      model: toolDraft.model?.trim() || undefined,
      serialNumber: toolDraft.serialNumber?.trim() || undefined,
      unit: toolDraft.unit?.trim() || undefined,
      updatedAt,
    };
    const next = { ...data, tools: data.tools.map((tool) => tool.id === normalized.id ? normalized : tool) };
    commit(next);
    setToolDraft(normalized);
    onMessage(`Ficha de ${normalized.code} actualizada.`);
  };

  const saveTechnician = () => {
    if (!technicianDraft) return;
    const category = (data.technicianCategories ?? []).find((entry) => entry.id === technicianDraft.categoryId);
    if (!technicianDraft.name.trim() || !category) {
      onMessage('Nombre y especialidad son obligatorios.');
      return;
    }
    const status = technicianDraft.status ?? (technicianDraft.active ? 'active' : 'inactive');
    const updatedAt = new Date().toISOString();
    const normalized: Technician = {
      ...technicianDraft,
      name: technicianDraft.name.trim(),
      category: category.name,
      categoryId: category.id,
      status,
      active: status !== 'inactive' && status !== 'blocked' && status !== 'leave',
      company: technicianDraft.company?.trim() || undefined,
      department: technicianDraft.department?.trim() || undefined,
      phone: technicianDraft.phone?.trim() || undefined,
      email: technicianDraft.email?.trim() || undefined,
      notes: technicianDraft.notes?.trim() || undefined,
      updatedAt,
    };
    const next = { ...data, technicians: data.technicians.map((technician) => technician.id === normalized.id ? normalized : technician) };
    commit(next);
    setTechnicianDraft(normalized);
    onMessage(`Ficha de ${normalized.name} actualizada.`);
  };

  const assignedTools = technicianDraft ? data.tools.filter((tool) => tool.technicianId === technicianDraft.id) : [];
  const entityMovements = data.movements.filter((movement) => mode === 'tool' ? movement.toolId === selectedId : movement.technicianId === selectedId);

  return (
    <div className="entity-details-admin">
      <div className="entity-mode-switch">
        <button className={mode === 'tool' ? 'active' : ''} type="button" onClick={() => changeMode('tool')}><BriefcaseBusiness size={18} /> Herramientas y material</button>
        <button className={mode === 'technician' ? 'active' : ''} type="button" onClick={() => changeMode('technician')}><UserRound size={18} /> Técnicos</button>
      </div>

      <section className="entity-selector-card">
        <label>{mode === 'tool' ? 'Artículo' : 'Técnico'}
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Selecciona una ficha</option>
            {(mode === 'tool' ? sortedTools : sortedTechnicians).map((entry) => <option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}
          </select>
        </label>
        {selectedId && <div className="entity-summary"><span>{entityMovements.length}</span><small>movimientos registrados</small>{mode === 'technician' && <><span>{assignedTools.length}</span><small>artículos asignados</small></>}</div>}
      </section>

      {toolDraft && (
        <section className="entity-details-card">
          <header><div><small>{toolDraft.code}</small><h3>{toolDraft.name}</h3><p>{toolDraft.category} · {toolDraft.location}</p></div><span className={`entity-state state-${toolDraft.serviceState ?? 'ready'}`}>{serviceStates.find((entry) => entry.value === (toolDraft.serviceState ?? 'ready'))?.label}</span></header>
          <div className="entity-form-grid">
            <label>Nombre<input value={toolDraft.name} onChange={(event) => setToolDraft({ ...toolDraft, name: event.target.value })} /></label>
            <label>Tipo de artículo<select value={toolDraft.kind ?? 'returnable-tool'} onChange={(event) => setToolDraft({ ...toolDraft, kind: event.target.value as ToolKind })}>{toolKinds.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
            <label>Categoría<select value={toolDraft.categoryId ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, categoryId: event.target.value })}><option value="">Selecciona</option>{toolCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label>Ubicación<select value={toolDraft.locationId ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, locationId: event.target.value || undefined })}><option value="">Sin ubicación</option>{locations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label>Estado técnico<select value={toolDraft.serviceState ?? 'ready'} onChange={(event) => setToolDraft({ ...toolDraft, serviceState: event.target.value as ToolServiceState })}>{serviceStates.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
            <label>Marca<input value={toolDraft.brand ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, brand: event.target.value })} /></label>
            <label>Modelo<input value={toolDraft.model ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, model: event.target.value })} /></label>
            <label>Número de serie<input value={toolDraft.serialNumber ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, serialNumber: event.target.value })} /></label>
            <label>Fecha de compra<input type="date" value={toolDraft.purchaseDate ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, purchaseDate: event.target.value || undefined })} /></label>
            <label>Precio de compra<input type="number" min="0" step="0.01" value={toolDraft.purchasePrice ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, purchasePrice: optionalNumber(event.target.value) })} /></label>
            <label>Próxima revisión<input type="date" value={toolDraft.reviewDueDate ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, reviewDueDate: event.target.value || undefined })} /></label>
            <label>Próxima calibración<input type="date" value={toolDraft.calibrationDueDate ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, calibrationDueDate: event.target.value || undefined })} /></label>
            {toolDraft.kind === 'consumable' && <>
              <label>Cantidad<input type="number" min="0" step="0.01" value={toolDraft.quantity ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, quantity: optionalNumber(event.target.value) })} /></label>
              <label>Stock mínimo<input type="number" min="0" step="0.01" value={toolDraft.minStock ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, minStock: optionalNumber(event.target.value) })} /></label>
              <label>Unidad<input value={toolDraft.unit ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, unit: event.target.value })} placeholder="ud, m, kg…" /></label>
            </>}
            <label className="entity-wide">Descripción<textarea rows={3} value={toolDraft.description ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, description: event.target.value })} /></label>
            <label className="entity-wide">Observaciones<textarea rows={3} value={toolDraft.notes ?? ''} onChange={(event) => setToolDraft({ ...toolDraft, notes: event.target.value })} /></label>
          </div>
          <PhotoManager entityId={toolDraft.id} photos={toolDraft.photos ?? []} onChange={(photos) => setToolDraft({ ...toolDraft, photos })} onMessage={onMessage} />
          <button className="admin-primary" type="button" onClick={saveTool}><Check size={18} /> Guardar ficha completa</button>
        </section>
      )}

      {technicianDraft && (
        <section className="entity-details-card">
          <header><div><small>{technicianDraft.code}</small><h3>{technicianDraft.name}</h3><p>{technicianDraft.category} · {technicianDraft.department || 'Sin departamento'}</p></div><span className={`entity-state state-${technicianDraft.status ?? 'active'}`}>{technicianStatuses.find((entry) => entry.value === (technicianDraft.status ?? 'active'))?.label}</span></header>
          <div className="entity-form-grid">
            <label>Nombre<input value={technicianDraft.name} onChange={(event) => setTechnicianDraft({ ...technicianDraft, name: event.target.value })} /></label>
            <label>Especialidad<select value={technicianDraft.categoryId ?? ''} onChange={(event) => setTechnicianDraft({ ...technicianDraft, categoryId: event.target.value })}><option value="">Selecciona</option>{technicianCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label>Estado<select value={technicianDraft.status ?? 'active'} onChange={(event) => setTechnicianDraft({ ...technicianDraft, status: event.target.value as TechnicianStatus })}>{technicianStatuses.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
            <label>Empresa<input value={technicianDraft.company ?? ''} onChange={(event) => setTechnicianDraft({ ...technicianDraft, company: event.target.value })} /></label>
            <label>Departamento<input value={technicianDraft.department ?? ''} onChange={(event) => setTechnicianDraft({ ...technicianDraft, department: event.target.value })} /></label>
            <label>Teléfono<input value={technicianDraft.phone ?? ''} onChange={(event) => setTechnicianDraft({ ...technicianDraft, phone: event.target.value })} /></label>
            <label>Correo<input type="email" value={technicianDraft.email ?? ''} onChange={(event) => setTechnicianDraft({ ...technicianDraft, email: event.target.value })} /></label>
            <label className="entity-wide">Observaciones<textarea rows={4} value={technicianDraft.notes ?? ''} onChange={(event) => setTechnicianDraft({ ...technicianDraft, notes: event.target.value })} /></label>
          </div>
          <PhotoManager entityId={technicianDraft.id} photos={technicianDraft.photos ?? []} onChange={(photos) => setTechnicianDraft({ ...technicianDraft, photos })} onMessage={onMessage} />
          <button className="admin-primary" type="button" onClick={saveTechnician}><Check size={18} /> Guardar ficha completa</button>
        </section>
      )}

      {!selectedId && <div className="entity-details-empty"><BriefcaseBusiness size={38} /><strong>Selecciona una ficha</strong><p>Consulta y edita fotografías, estado, datos técnicos y mantenimiento.</p></div>}
    </div>
  );
}
