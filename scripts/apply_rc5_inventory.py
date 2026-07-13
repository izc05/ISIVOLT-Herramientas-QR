#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.0.0-rc.5'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f'No se encontró el bloque: {label}')
    return text.replace(old, new, 1)


app_path = ROOT / 'src/AppV2.tsx'
app = app_path.read_text(encoding='utf-8')

app = replace_once(
    app,
    "import { loadAppData, resetAppData, saveAppData } from './services/storage';",
    "import { loadAppData, resetAppData, saveAppData } from './services/storage';\nimport {\n  buildToolCategories,\n  buildToolMovementTimes,\n  filterInventoryTools,\n  formatOperationDateTime,\n  type InventoryPreset,\n} from './features/inventory/inventoryOperations';",
    'imports de inventario',
)

start = app.index('function Dashboard({')
end = app.index('\nfunction InventoryView({', start)
dashboard = app[start:end]
dashboard = dashboard.replace(
    "  onScan,\n}: {\n  data: AppData;\n  onOperation: (mode: OperationMode, toolId?: string) => void;\n  onView: (view: View) => void;\n  onScan: () => void;\n}) {",
    "  onScan,\n  onOpenInventory,\n}: {\n  data: AppData;\n  onOperation: (mode: OperationMode, toolId?: string) => void;\n  onView: (view: View) => void;\n  onScan: () => void;\n  onOpenInventory: (preset: InventoryPreset) => void;\n}) {",
)
old_stats_start = dashboard.index('      <section className="stats-grid core-stats">')
old_stats_end = dashboard.index('      </section>', old_stats_start) + len('      </section>')
new_stats = '''      <section className="stats-grid core-stats">
        {[
          { label: 'Disponibles', value: stats.available, Icon: PackageCheck, tone: 'success', action: () => onOpenInventory('available') },
          { label: 'Prestadas', value: stats.loaned, Icon: Users, tone: 'warning', action: () => onOpenInventory('loaned') },
          { label: 'Requieren atención', value: stats.attention, Icon: AlertTriangle, tone: 'danger', action: () => onOpenInventory('attention') },
          { label: 'Técnicos activos', value: stats.technicians, Icon: UserRound, tone: 'violet', action: () => onView('technicians') },
        ].map(({ label, value, Icon, tone, action }, index) => (
          <motion.button
            type="button"
            className={`stat-card stat-card-button tone-${tone} game-card`}
            key={label}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={action}
            aria-label={`Abrir ${label}: ${value}`}
          >
            <span className="card-shimmer" />
            <div className="stat-card-header"><span className="stat-icon"><Icon size={20} /></span><span className="mini-trend">VER</span></div>
            <motion.strong key={String(value)} initial={{ scale: 0.78, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{value}</motion.strong>
            <h3>{label}</h3>
            <p>{label === 'Técnicos activos' ? 'Abrir directorio' : 'Abrir listado filtrado'}</p>
          </motion.button>
        ))}
      </section>'''
dashboard = dashboard[:old_stats_start] + new_stats + dashboard[old_stats_end:]
app = app[:start] + dashboard + app[end:]

inventory_start = app.index('function InventoryView({')
inventory_end = app.index('\nfunction TechniciansView(', inventory_start)
new_inventory = '''function InventoryView({
  data,
  query,
  onAdd,
  onOperation,
  initialPreset,
}: {
  data: AppData;
  query: string;
  onAdd: () => void;
  onOperation: (mode: OperationMode, toolId?: string) => void;
  initialPreset: InventoryPreset;
}) {
  const [category, setCategory] = useState('Todas');
  const [preset, setPreset] = useState<InventoryPreset>(initialPreset);
  const [compact, setCompact] = useState(true);

  useEffect(() => setPreset(initialPreset), [initialPreset]);

  const categories = useMemo(() => buildToolCategories(data.tools), [data.tools]);
  const filtered = useMemo(
    () => filterInventoryTools(data.tools, query, category, preset),
    [data.tools, query, category, preset],
  );
  const technicianById = useMemo(
    () => new Map(data.technicians.map((technician) => [technician.id, technician])),
    [data.technicians],
  );

  const presetLabel: Record<InventoryPreset, string> = {
    all: 'Todas',
    available: 'Disponibles',
    loaned: 'Prestadas',
    attention: 'Requieren atención',
  };

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><Boxes size={14} /> Control de activos</span>
          <h1>Inventario</h1>
          <p>{filtered.length} herramientas visibles · {data.tools.length} registradas</p>
          {(preset !== 'all' || category !== 'Todas') && <span className="inventory-active-filter">Filtro: {presetLabel[preset]} · {category}</span>}
        </div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> Nueva herramienta</button>
      </div>

      <div className="inventory-toolbar">
        <div className="inventory-filter-group">
          <label>
            Categoría
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Estado
            <select value={preset} onChange={(event) => setPreset(event.target.value as InventoryPreset)}>
              <option value="all">Todas</option>
              <option value="available">Disponibles</option>
              <option value="loaned">Prestadas</option>
              <option value="attention">Requieren atención</option>
            </select>
          </label>
        </div>
        <div className="inventory-view-toggle" aria-label="Cambiar vista">
          <button className={compact ? 'active' : ''} onClick={() => setCompact(true)} aria-label="Vista compacta">≡</button>
          <button className={!compact ? 'active' : ''} onClick={() => setCompact(false)} aria-label="Vista detallada">▦</button>
        </div>
      </div>

      <div className={`tool-grid ${compact ? 'compact-mode' : ''}`}>
        {filtered.map((tool, index) => {
          const holder = technicianById.get(tool.holderTechnicianId ?? '');
          const times = buildToolMovementTimes(data, tool.id);
          const image = tool.thumbnailUri || tool.photoUri || tool.imageDataUrl;
          return (
            <motion.article
              className={`tool-card game-card ${compact ? 'tool-card-compact' : ''}`}
              key={tool.id}
              initial={{ opacity: 0, y: compact ? 8 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.02 }}
            >
              <span className="card-shimmer" />
              {compact && <div className="tool-card-media">{image ? <img src={image} alt="" /> : <Wrench size={25} />}</div>}
              <div className="tool-card-top"><span className="tool-avatar large-avatar"><Wrench size={24} /></span><StatusBadge status={tool.status} /></div>
              <div className="tool-card-body"><span className="tool-code">{tool.code}</span><h3>{tool.name}</h3><p>{tool.category} · {tool.brand ? `${tool.brand}${tool.model ? ` ${tool.model}` : ''}` : tool.location}</p></div>
              <dl className="tool-details">
                <div><dt>{tool.status === 'loaned' ? 'Responsable' : 'Ubicación'}</dt><dd>{tool.status === 'loaned' ? holder?.name ?? 'Sin responsable' : tool.location}</dd></div>
                <div><dt>Categoría</dt><dd>{tool.category}</dd></div>
                {!compact && <div><dt>QR</dt><dd>{tool.qrCode}</dd></div>}
                {tool.loanedAt && <div><dt>Tiempo fuera</dt><dd>{hoursSince(tool.loanedAt)} h</dd></div>}
                <div className="tool-operation-times">
                  <span>Última salida<strong>{formatOperationDateTime(times.checkout?.occurredAt)}</strong></span>
                  <span>Última entrada<strong>{formatOperationDateTime(times.checkin?.occurredAt)}</strong></span>
                </div>
              </dl>
              <div className="tool-card-actions">
                {tool.status === 'available' && <button onClick={() => onOperation('delivery', tool.id)}><ArrowUpFromLine size={16} /> Entregar</button>}
                {tool.status === 'loaned' && <button onClick={() => onOperation('return', tool.id)}><ArrowDownToLine size={16} /> Devolver</button>}
                {(tool.status === 'review' || tool.status === 'damaged') && <span className="blocked-label"><AlertTriangle size={15} /> Entrega bloqueada</span>}
              </div>
            </motion.article>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="empty-state"><Search size={34} /><strong>No hay resultados</strong><span>Cambia la categoría, el estado o la búsqueda.</span></div>}
    </section>
  );
}
'''
app = app[:inventory_start] + new_inventory + app[inventory_end:]

app = replace_once(
    app,
    "  const [technicianFormOpen, setTechnicianFormOpen] = useState(false);",
    "  const [technicianFormOpen, setTechnicianFormOpen] = useState(false);\n  const [inventoryPreset, setInventoryPreset] = useState<InventoryPreset>('all');",
    'estado de filtro de inventario',
)

app = replace_once(
    app,
    "  const openOperation = (mode: OperationMode, toolId?: string) => setOperation({ mode, toolId });",
    "  const openOperation = (mode: OperationMode, toolId?: string) => setOperation({ mode, toolId });\n  const openInventoryPreset = (preset: InventoryPreset) => {\n    setInventoryPreset(preset);\n    setQuery('');\n    setView('inventory');\n  };",
    'apertura de panel filtrado',
)

app = replace_once(
    app,
    "      onClick={() => { setView(id); setQuery(''); }}",
    "      onClick={() => { setView(id); setQuery(''); if (id === 'inventory') setInventoryPreset('all'); }}",
    'navegación inventario',
)

app = replace_once(
    app,
    "{view === 'dashboard' && <Dashboard data={data} onOperation={openOperation} onView={setView} onScan={() => setScannerOpen(true)} />}",
    "{view === 'dashboard' && <Dashboard data={data} onOperation={openOperation} onView={setView} onScan={() => setScannerOpen(true)} onOpenInventory={openInventoryPreset} />}",
    'dashboard interactivo',
)
app = replace_once(
    app,
    "{view === 'inventory' && <InventoryView data={data} query={query} onAdd={() => setToolFormOpen(true)} onOperation={openOperation} />}",
    "{view === 'inventory' && <InventoryView data={data} query={query} onAdd={() => setToolFormOpen(true)} onOperation={openOperation} initialPreset={inventoryPreset} />}",
    'inventario filtrado',
)

# Requiere observación cuando una devolución no vuelve correcta.
app = app.replace(
    "  const canConfirm = selectedToolIds.length > 0 && (mode === 'return' || Boolean(technicianId));",
    "  const canConfirm = selectedToolIds.length > 0\n    && (mode === 'return' || Boolean(technicianId))\n    && (mode !== 'return' || condition === 'ok' || notes.trim().length > 0);",
    1,
)
app = app.replace(
    '        Observaciones opcionales',
    "        {mode === 'return' && condition !== 'ok' ? 'Observaciones obligatorias' : 'Observaciones opcionales'}",
    1,
)

app_path.write_text(app, encoding='utf-8')

main_path = ROOT / 'src/main.tsx'
main = main_path.read_text(encoding='utf-8')
if "import './inventory-rc5.css';" not in main:
    main = main.replace("import './mobile-optimization-rc4.css';", "import './mobile-optimization-rc4.css';\nimport './inventory-rc5.css';")
main_path.write_text(main, encoding='utf-8')

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
package['version'] = VERSION
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
if lock_path.exists():
    lock = json.loads(lock_path.read_text(encoding='utf-8'))
    lock['version'] = VERSION
    if isinstance(lock.get('packages', {}).get(''), dict):
        lock['packages']['']['version'] = VERSION
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

config_path = ROOT / 'src/config/app.ts'
config = config_path.read_text(encoding='utf-8')
config = re.sub(r"APP_VERSION = '[^']+'", f"APP_VERSION = '{VERSION}'", config)
config_path.write_text(config, encoding='utf-8')

workflow_path = ROOT / '.github/workflows/production-readiness.yml'
workflow = workflow_path.read_text(encoding='utf-8')
workflow = workflow.replace('ISIVOLT-Herramientas-QR-v1.0.0-rc.4-debug', 'ISIVOLT-Herramientas-QR-v1.0.0-rc.5-debug')
workflow = workflow.replace('ISIVOLT-v1.0.0-rc.4-metadata', 'ISIVOLT-v1.0.0-rc.5-metadata')
if 'feature/rc5-inventory-operations' not in workflow:
    workflow = workflow.replace('      - fix/mobile-ui-technician-selector-1.0.0-rc.4', '      - fix/mobile-ui-technician-selector-1.0.0-rc.4\n      - feature/rc5-inventory-operations')
workflow_path.write_text(workflow, encoding='utf-8')

print('Integración rc.5 aplicada correctamente.')
