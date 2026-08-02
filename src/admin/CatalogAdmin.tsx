import { useMemo, useState } from 'react';
import {
  Check,
  MapPin,
  Plus,
  Power,
  RotateCcw,
  Tag,
  Users,
} from 'lucide-react';
import { saveData } from '../storage';
import type { AppData, CatalogEntry, LocationEntry } from '../types';

type CatalogKind = 'tools' | 'technicians' | 'locations';

type CatalogAdminProps = {
  data: AppData;
  onDataChange(data: AppData): void;
  onMessage(message: string): void;
};

type Draft = {
  id?: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  parentId: string;
  description: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  code: '',
  color: '#0b63ce',
  icon: '',
  parentId: '',
  description: '',
});

const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const normalize = (value: string) => value.trim().toLocaleLowerCase('es-ES');
const generatedCode = (name: string, fallback: string) => {
  const compact = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 5)
    .toUpperCase();
  return compact || fallback;
};

export default function CatalogAdmin({ data, onDataChange, onMessage }: CatalogAdminProps) {
  const [kind, setKind] = useState<CatalogKind>('tools');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());

  const entries = kind === 'tools'
    ? data.toolCategories ?? []
    : kind === 'technicians'
      ? data.technicianCategories ?? []
      : data.locations ?? [];

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es')),
    [entries],
  );

  const locationMap = useMemo(
    () => new Map((data.locations ?? []).map((entry) => [entry.id, entry])),
    [data.locations],
  );

  const locationPath = (entry: LocationEntry): string => {
    const parts = [entry.name];
    const visited = new Set([entry.id]);
    let parentId = entry.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = locationMap.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parentId;
    }
    return parts.join(' › ');
  };

  const usage = (entry: CatalogEntry): number => {
    if (kind === 'tools') return data.tools.filter((tool) => tool.categoryId === entry.id || (!tool.categoryId && normalize(tool.category) === normalize(entry.name))).length;
    if (kind === 'technicians') return data.technicians.filter((technician) => technician.categoryId === entry.id || (!technician.categoryId && normalize(technician.category) === normalize(entry.name))).length;
    return data.tools.filter((tool) => tool.locationId === entry.id || (!tool.locationId && normalize(tool.location) === normalize(entry.name))).length;
  };

  const descendantsOf = (id: string): Set<string> => {
    const result = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const location of data.locations ?? []) {
        if (location.parentId === id || (location.parentId && result.has(location.parentId))) {
          if (!result.has(location.id)) {
            result.add(location.id);
            changed = true;
          }
        }
      }
    }
    return result;
  };

  const resetDraft = () => setDraft(emptyDraft());

  const edit = (entry: CatalogEntry) => {
    const location = entry as LocationEntry;
    setDraft({
      id: entry.id,
      name: entry.name,
      code: entry.code ?? '',
      color: entry.color ?? '#0b63ce',
      icon: entry.icon ?? '',
      parentId: kind === 'locations' ? location.parentId ?? '' : '',
      description: kind === 'locations' ? location.description ?? '' : '',
    });
  };

  const commit = (next: AppData) => {
    saveData(next);
    onDataChange(next);
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      onMessage('El nombre es obligatorio.');
      return;
    }
    const duplicate = entries.some((entry) => entry.id !== draft.id && normalize(entry.name) === normalize(name));
    if (duplicate) {
      onMessage(`Ya existe un registro llamado “${name}”.`);
      return;
    }

    const code = (draft.code.trim() || generatedCode(name, kind === 'locations' ? 'UBI' : kind === 'technicians' ? 'TEC' : 'CAT')).toUpperCase();
    if (entries.some((entry) => entry.id !== draft.id && normalize(entry.code ?? '') === normalize(code))) {
      onMessage(`El código ${code} ya está utilizado.`);
      return;
    }

    if (kind === 'locations' && draft.id && draft.parentId) {
      const descendants = descendantsOf(draft.id);
      if (draft.parentId === draft.id || descendants.has(draft.parentId)) {
        onMessage('Una ubicación no puede depender de sí misma ni de una ubicación inferior.');
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const current = draft.id ? entries.find((entry) => entry.id === draft.id) : undefined;
    const base: CatalogEntry = {
      id: current?.id ?? uid(kind === 'locations' ? 'location' : kind === 'technicians' ? 'technician-category' : 'tool-category'),
      name,
      code,
      color: draft.color || '#0b63ce',
      icon: draft.icon.trim() || undefined,
      active: current?.active ?? true,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const savedEntry: CatalogEntry | LocationEntry = kind === 'locations'
      ? { ...base, parentId: draft.parentId || undefined, description: draft.description.trim() || undefined }
      : base;

    let next: AppData;
    if (kind === 'tools') {
      const nextEntries = draft.id
        ? (data.toolCategories ?? []).map((entry) => entry.id === draft.id ? savedEntry : entry)
        : [...(data.toolCategories ?? []), savedEntry];
      next = {
        ...data,
        toolCategories: nextEntries,
        tools: data.tools.map((tool) => tool.categoryId === savedEntry.id
          ? { ...tool, category: savedEntry.name, updatedAt: timestamp }
          : tool),
      };
    } else if (kind === 'technicians') {
      const nextEntries = draft.id
        ? (data.technicianCategories ?? []).map((entry) => entry.id === draft.id ? savedEntry : entry)
        : [...(data.technicianCategories ?? []), savedEntry];
      next = {
        ...data,
        technicianCategories: nextEntries,
        technicians: data.technicians.map((technician) => technician.categoryId === savedEntry.id
          ? { ...technician, category: savedEntry.name, updatedAt: timestamp }
          : technician),
      };
    } else {
      const nextEntries = draft.id
        ? (data.locations ?? []).map((entry) => entry.id === draft.id ? savedEntry as LocationEntry : entry)
        : [...(data.locations ?? []), savedEntry as LocationEntry];
      next = {
        ...data,
        locations: nextEntries,
        tools: data.tools.map((tool) => tool.locationId === savedEntry.id
          ? { ...tool, location: savedEntry.name, updatedAt: timestamp }
          : tool),
      };
    }

    commit(next);
    onMessage(draft.id ? `${name} actualizado.` : `${name} creado.`);
    resetDraft();
  };

  const toggleActive = (entry: CatalogEntry) => {
    if (entry.active) {
      const used = usage(entry);
      if (used > 0) {
        onMessage(`No se puede desactivar: está utilizado en ${used} registro${used === 1 ? '' : 's'}.`);
        return;
      }
      if (kind === 'locations' && (data.locations ?? []).some((location) => location.parentId === entry.id && location.active)) {
        onMessage('No se puede desactivar una ubicación con ubicaciones hijas activas.');
        return;
      }
    }

    const timestamp = new Date().toISOString();
    const update = <T extends CatalogEntry>(list: T[]) => list.map((item) => item.id === entry.id
      ? { ...item, active: !item.active, updatedAt: timestamp }
      : item);
    const next = kind === 'tools'
      ? { ...data, toolCategories: update(data.toolCategories ?? []) }
      : kind === 'technicians'
        ? { ...data, technicianCategories: update(data.technicianCategories ?? []) }
        : { ...data, locations: update(data.locations ?? []) };
    commit(next);
    onMessage(entry.active ? `${entry.name} desactivado.` : `${entry.name} reactivado.`);
    if (draft.id === entry.id) resetDraft();
  };

  const excludedParents = draft.id ? descendantsOf(draft.id) : new Set<string>();

  return (
    <div className="catalog-admin">
      <div className="catalog-kind-switch" role="tablist" aria-label="Tipo de catálogo">
        <button className={kind === 'tools' ? 'active' : ''} type="button" onClick={() => { setKind('tools'); resetDraft(); }}><Tag size={17} /> Material</button>
        <button className={kind === 'technicians' ? 'active' : ''} type="button" onClick={() => { setKind('technicians'); resetDraft(); }}><Users size={17} /> Técnicos</button>
        <button className={kind === 'locations' ? 'active' : ''} type="button" onClick={() => { setKind('locations'); resetDraft(); }}><MapPin size={17} /> Ubicaciones</button>
      </div>

      <div className="catalog-admin-layout">
        <section className="catalog-list-card">
          <header><div><strong>{kind === 'tools' ? 'Categorías de material' : kind === 'technicians' ? 'Especialidades de técnicos' : 'Árbol de ubicaciones'}</strong><p>{entries.length} registros · {entries.filter((entry) => entry.active).length} activos</p></div><button type="button" onClick={resetDraft}><Plus size={17} /> Nuevo</button></header>
          <div className="catalog-list">
            {sortedEntries.map((entry) => {
              const count = usage(entry);
              return (
                <article key={entry.id} className={!entry.active ? 'inactive' : ''}>
                  <button className="catalog-entry-main" type="button" onClick={() => edit(entry)}>
                    <span className="catalog-color" style={{ background: entry.color || '#0b63ce' }} />
                    <div><strong>{kind === 'locations' ? locationPath(entry as LocationEntry) : entry.name}</strong><small>{entry.code || 'Sin código'} · {count} en uso</small></div>
                    <em>{entry.active ? 'Activo' : 'Inactivo'}</em>
                  </button>
                  <button className="catalog-power" type="button" onClick={() => toggleActive(entry)} aria-label={entry.active ? `Desactivar ${entry.name}` : `Reactivar ${entry.name}`} title={entry.active ? 'Desactivar' : 'Reactivar'}>{entry.active ? <Power size={16} /> : <RotateCcw size={16} />}</button>
                </article>
              );
            })}
            {entries.length === 0 && <p className="catalog-empty">Todavía no hay registros en este catálogo.</p>}
          </div>
        </section>

        <section className="catalog-editor-card">
          <header><strong>{draft.id ? 'Editar registro' : 'Crear registro'}</strong><p>Los cambios se aplicarán a todas las fichas vinculadas mediante su identificador estable.</p></header>
          <div className="catalog-form-grid">
            <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={kind === 'locations' ? 'Ej. Almacén eléctrico' : 'Ej. Electricidad'} /></label>
            <label>Código<input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="Automático" /></label>
            <label>Color<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>
            <label>Icono o referencia<input value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} placeholder="Opcional" /></label>
            {kind === 'locations' && (
              <>
                <label>Ubicación superior<select value={draft.parentId} onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}><option value="">Nivel principal</option>{(data.locations ?? []).filter((location) => location.id !== draft.id && !excludedParents.has(location.id)).map((location) => <option key={location.id} value={location.id}>{locationPath(location)}</option>)}</select></label>
                <label className="catalog-wide">Descripción<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} placeholder="Planta, zona, acceso o indicaciones" /></label>
              </>
            )}
          </div>
          <button className="admin-primary" type="button" onClick={save}><Check size={18} /> {draft.id ? 'Guardar cambios' : 'Crear registro'}</button>
        </section>
      </div>
    </div>
  );
}
