import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  Check,
  Download,
  History,
  RotateCcw,
  Search,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import type { AppData, Movement } from '../../domain/types';
import { loadAppData } from '../../services/storage';

type TimePreset = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'range';

type MovementPresentation = {
  label: string;
  Icon: typeof History;
  tone: 'delivery' | 'return' | 'incident' | 'adjustment';
};

const movementPresentation: Record<Movement['type'], MovementPresentation> = {
  delivery: { label: 'Salida / préstamo', Icon: ArrowUpFromLine, tone: 'delivery' },
  return: { label: 'Entrada / devolución', Icon: ArrowDownToLine, tone: 'return' },
  incident: { label: 'Entrada con incidencia', Icon: AlertTriangle, tone: 'incident' },
  adjustment: { label: 'Rectificación', Icon: RotateCcw, tone: 'adjustment' },
};

const startOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
};

const presetRange = (
  preset: TimePreset,
  customStart: string,
  customEnd: string,
): { start?: Date; end?: Date } => {
  const now = new Date();
  if (preset === 'all') return {};
  if (preset === 'today') return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }
  if (preset === '7days' || preset === '30days') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - (preset === '7days' ? 6 : 29));
    return { start, end: endOfDay(now) };
  }
  if (preset === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  return {
    start: customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : undefined,
    end: customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : undefined,
  };
};

const formatFullDateTime = (iso: string) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}).format(new Date(iso));

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const exportAuditCsv = (data: AppData, movements: Movement[]) => {
  const header = [
    'Fecha y hora',
    'Tipo',
    'Herramienta',
    'Código herramienta',
    'Técnico',
    'Código técnico',
    'Operador',
    'Estado anterior',
    'Estado nuevo',
    'Condición',
    'Observaciones',
    'ID operación',
    'ID movimiento',
  ];

  const rows = movements.map((movement) => {
    const tool = data.tools.find((item) => item.id === movement.toolId);
    const technician = data.technicians.find((item) => item.id === movement.technicianId);
    return [
      formatFullDateTime(movement.occurredAt),
      movementPresentation[movement.type].label,
      tool?.name ?? 'Herramienta eliminada',
      tool?.code ?? '',
      technician?.name ?? 'Almacén / sin técnico',
      technician?.code ?? '',
      movement.operatorName,
      movement.previousStatus,
      movement.nextStatus,
      movement.condition ?? '',
      movement.notes ?? '',
      movement.operationId ?? '',
      movement.id,
    ];
  });

  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ISIVOLT-Auditoria-${stamp}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export default function MovementHistoryCenter() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState<TimePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exported, setExported] = useState(false);

  useEffect(() => {
    const interceptHistory = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      const label = button.textContent?.trim().toLocaleLowerCase('es-ES') ?? '';
      const opensHistory = label === 'historial'
        || label === 'movimientos'
        || (label.includes('ver todos') && Boolean(button.closest('.movements-panel')));
      if (!opensHistory) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setData(loadAppData());
      setOpen(true);
    };

    document.addEventListener('click', interceptHistory, true);
    return () => document.removeEventListener('click', interceptHistory, true);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es-ES');
    const { start, end } = presetRange(preset, customStart, customEnd);

    return [...data.movements]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .filter((movement) => {
        const date = new Date(movement.occurredAt);
        if (start && date < start) return false;
        if (end && date > end) return false;

        const tool = data.tools.find((item) => item.id === movement.toolId);
        const technician = data.technicians.find((item) => item.id === movement.technicianId);
        return !needle || [
          tool?.name ?? '',
          tool?.code ?? '',
          technician?.name ?? '',
          technician?.code ?? '',
          movement.operatorName,
          movement.notes ?? '',
          movementPresentation[movement.type].label,
          movement.operationId ?? '',
        ].some((value) => value.toLocaleLowerCase('es-ES').includes(needle));
      });
  }, [data, query, preset, customStart, customEnd]);

  const counts = useMemo(() => ({
    delivery: filtered.filter((movement) => movement.type === 'delivery').length,
    return: filtered.filter((movement) => movement.type === 'return').length,
    incident: filtered.filter((movement) => movement.type === 'incident').length,
    adjustment: filtered.filter((movement) => movement.type === 'adjustment').length,
  }), [filtered]);

  const exportFiltered = () => {
    exportAuditCsv(data, filtered);
    setExported(true);
    window.setTimeout(() => setExported(false), 2_200);
  };

  if (!open) return null;

  return (
    <div className="advanced-history-backdrop" onClick={() => setOpen(false)}>
      <section className="advanced-history-center" role="dialog" aria-modal="true" aria-label="Historial avanzado" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span><History size={25} /></span>
            <div><small>Auditoría local</small><h2>Historial de movimientos</h2><p>Fecha y hora completas, filtros y descarga.</p></div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={21} /></button>
        </header>

        <div className="advanced-history-toolbar">
          <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Herramienta, técnico, código, nota u operación…" /></label>
          <button type="button" onClick={exportFiltered} disabled={filtered.length === 0}>
            {exported ? <Check size={18} /> : <Download size={18} />}
            {exported ? 'Descargada' : 'Descargar auditoría'}
          </button>
        </div>

        <div className="advanced-history-presets">
          {([
            ['all', 'Todo'],
            ['today', 'Hoy'],
            ['yesterday', 'Ayer'],
            ['7days', '7 días'],
            ['30days', '30 días'],
            ['month', 'Este mes'],
            ['range', 'Rango'],
          ] as Array<[TimePreset, string]>).map(([value, label]) => (
            <button type="button" key={value} className={preset === value ? 'active' : ''} onClick={() => setPreset(value)}>{label}</button>
          ))}
        </div>

        {preset === 'range' && (
          <div className="advanced-history-range">
            <label><CalendarDays size={16} /> Desde<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label><CalendarDays size={16} /> Hasta<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
          </div>
        )}

        <div className="advanced-history-counters">
          <span className="tone-delivery"><ArrowUpFromLine size={15} /><strong>{counts.delivery}</strong> salidas</span>
          <span className="tone-return"><ArrowDownToLine size={15} /><strong>{counts.return}</strong> entradas</span>
          <span className="tone-incident"><AlertTriangle size={15} /><strong>{counts.incident}</strong> incidencias</span>
          <span className="tone-adjustment"><RotateCcw size={15} /><strong>{counts.adjustment}</strong> ajustes</span>
        </div>

        <div className="advanced-history-list">
          {filtered.map((movement) => {
            const tool = data.tools.find((item) => item.id === movement.toolId);
            const technician = data.technicians.find((item) => item.id === movement.technicianId);
            const presentation = movementPresentation[movement.type];
            const Icon = presentation.Icon;
            return (
              <article key={movement.id} className={`history-${presentation.tone}`}>
                <span className="advanced-history-icon"><Icon size={19} /></span>
                <div className="advanced-history-main">
                  <div><strong>{tool?.name ?? 'Herramienta eliminada'}</strong><em>{presentation.label}</em></div>
                  <small><Wrench size={13} /> {tool?.code ?? movement.toolId}</small>
                  <small><UserRound size={13} /> {technician?.name ?? 'Almacén / sin técnico'}{technician?.code ? ` · ${technician.code}` : ''}</small>
                  {movement.notes && <p>{movement.notes}</p>}
                </div>
                <div className="advanced-history-meta">
                  <time>{formatFullDateTime(movement.occurredAt)}</time>
                  <span>{movement.operatorName}</span>
                  {movement.operationId && <code title={movement.operationId}>{movement.operationId.slice(0, 18)}…</code>}
                </div>
              </article>
            );
          })}

          {filtered.length === 0 && (
            <div className="advanced-history-empty"><History size={34} /><strong>No hay movimientos en este filtro</strong><span>Cambia la fecha o la búsqueda.</span></div>
          )}
        </div>

        <footer><span>{filtered.length} registro{filtered.length === 1 ? '' : 's'} visible{filtered.length === 1 ? '' : 's'}</span><button type="button" onClick={() => setOpen(false)}>Cerrar historial</button></footer>
      </section>
    </div>
  );
}
