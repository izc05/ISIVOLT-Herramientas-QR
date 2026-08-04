import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Filter,
  History,
  Home,
  Menu,
  MoreVertical,
  Nfc,
  PackagePlus,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  commitBatchOperation,
  createTechnicianRecord,
  createToolRecord,
  linkToolNfc,
  technicianCanReceiveTools,
} from './data/workspaceOperations';
import { clearData, loadData, WORKSPACE_DATA_EVENT } from './storage';
import type { AppData, Movement, ToolStatus, ViewId } from './types';

const categories = [
  'Herramienta general',
  'Electricidad',
  'Climatización',
  'Fontanería',
  'Medida y comprobación',
  'PCI',
  'EPI',
  'Maletín',
];

const technicianCategories = [
  'Mantenimiento',
  'Electricidad',
  'Climatización',
  'Fontanería',
  'Mecánica',
  'PCI',
  'Almacén',
  'Centro de control',
];

const prefixes: Record<string, string> = {
  'Herramienta general': 'HER',
  Electricidad: 'ELE',
  Climatización: 'CLI',
  Fontanería: 'FON',
  'Medida y comprobación': 'MED',
  PCI: 'PCI',
  EPI: 'EPI',
  Maletín: 'MAL',
};

const statusLabels: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'En préstamo',
  review: 'En revisión',
  retired: 'Baja',
};

const movementLabels: Record<Movement['type'], string> = {
  loan: 'Préstamo',
  return: 'Devolución',
  tool_created: 'Alta de herramienta',
  technician_created: 'Alta de técnico',
  nfc_linked: 'NFC vinculado',
};

const formatDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

type ModalName = 'tool' | 'technician' | 'loan' | 'return' | 'qr' | 'nfc' | 'reset' | null;

type ModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

function Modal({ title, description, onClose, children, footer }: ModalProps) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span><Icon size={34} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<ViewId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ToolStatus>('all');
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedToolId, setSelectedToolId] = useState('');
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const [toolDraft, setToolDraft] = useState({
    name: '', category: categories[0], location: 'Almacén principal', brand: '', model: '', serialNumber: '',
  });
  const [technicianDraft, setTechnicianDraft] = useState({
    name: '', category: technicianCategories[0], phone: '', email: '',
  });
  const [nfcTag, setNfcTag] = useState('');

  useEffect(() => {
    const handleDataChange = (event: Event) => {
      setData((event as CustomEvent<AppData>).detail ?? loadData());
    };
    window.addEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
    return () => window.removeEventListener(WORKSPACE_DATA_EVENT, handleDataChange);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const metrics = useMemo(() => ({
    tools: data.tools.filter((tool) => tool.status !== 'retired').length,
    available: data.tools.filter((tool) => tool.status === 'available').length,
    loaned: data.tools.filter((tool) => tool.status === 'loaned').length,
    technicians: data.technicians.filter((technician) => technician.active).length,
  }), [data]);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-ES');
    return data.tools.filter((tool) => {
      const matchesQuery = !normalized || [tool.code, tool.name, tool.category, tool.location, tool.brand ?? '', tool.model ?? '']
        .some((value) => value.toLocaleLowerCase('es-ES').includes(normalized));
      const matchesStatus = statusFilter === 'all' || tool.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data.tools, query, statusFilter]);

  const activeTechnicians = data.technicians.filter(technicianCanReceiveTools);
  const availableTools = data.tools.filter((tool) => tool.status === 'available');
  const loanedTools = data.tools.filter((tool) => tool.status === 'loaned');
  const selectedTool = data.tools.find((tool) => tool.id === selectedToolId);

  const closeModal = () => {
    setModal(null);
    setSelectedToolId('');
    setSelectedTechnicianId('');
    setNfcTag('');
  };

  const openModal = (name: Exclude<ModalName, null>, toolId = '') => {
    setSelectedToolId(toolId);
    setModal(name);
  };

  const createTool = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createToolRecord({
      name: toolDraft.name,
      category: toolDraft.category,
      location: toolDraft.location,
      brand: toolDraft.brand,
      model: toolDraft.model,
      serialNumber: toolDraft.serialNumber,
      prefix: prefixes[toolDraft.category] ?? 'HER',
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setToolDraft({ name: '', category: categories[0], location: 'Almacén principal', brand: '', model: '', serialNumber: '' });
    closeModal();
    setNotice(`${result.value.code} · ${result.value.name} creada correctamente.`);
  };

  const createTechnician = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createTechnicianRecord({
      name: technicianDraft.name,
      category: technicianDraft.category,
      phone: technicianDraft.phone,
      email: technicianDraft.email,
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setTechnicianDraft({ name: '', category: technicianCategories[0], phone: '', email: '' });
    closeModal();
    setNotice(`${result.value.code} · ${result.value.name} creado correctamente.`);
  };

  const registerLoan = async () => {
    if (!selectedToolId || !selectedTechnicianId) return;
    const result = await commitBatchOperation({
      operation: 'loan',
      technicianId: selectedTechnicianId,
      toolIds: [selectedToolId],
      operatorMode: 'administrator',
      identificationMethod: 'manual',
      scanMethod: 'manual',
      startedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    setNotice('Préstamo registrado y auditado en un lote.');
  };

  const registerReturn = async () => {
    if (!selectedToolId) return;
    const currentTool = loadData().tools.find((item) => item.id === selectedToolId);
    if (!currentTool?.technicianId) {
      setNotice('La herramienta ya no tiene un responsable válido.');
      return;
    }
    const result = await commitBatchOperation({
      operation: 'return',
      technicianId: currentTool.technicianId,
      toolIds: [selectedToolId],
      operatorMode: 'administrator',
      identificationMethod: 'manual',
      scanMethod: 'manual',
      startedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    setNotice('Devolución registrada y auditada en un lote.');
  };

  const saveNfc = async (writeToTag: boolean) => {
    if (!selectedTool || !nfcTag.trim()) return;
    const result = await linkToolNfc(selectedTool.id, nfcTag);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    let writeWarning = '';
    if (writeToTag) {
      const Reader = (window as unknown as { NDEFReader?: new () => { write(data: unknown): Promise<void> } }).NDEFReader;
      if (!Reader) {
        writeWarning = 'Web NFC no está disponible;';
      } else {
        try {
          const reader = new Reader();
          await reader.write({ records: [{ recordType: 'text', data: result.value.qrPayload }] });
        } catch {
          writeWarning = 'No se pudo grabar físicamente la etiqueta;';
        }
      }
    }

    closeModal();
    setNotice(writeWarning
      ? `${writeWarning} la referencia ya está vinculada sin duplicados.`
      : 'NFC vinculado a la herramienta.');
  };

  const resetWorkspace = () => {
    setData(clearData());
    closeModal();
    setNotice('Espacio de trabajo vaciado.');
  };

  const navItems: Array<{ id: ViewId; label: string; Icon: LucideIcon }> = [
    { id: 'dashboard', label: 'Inicio', Icon: Home },
    { id: 'tools', label: 'Herramientas', Icon: BriefcaseBusiness },
    { id: 'technicians', label: 'Técnicos', Icon: Users },
    { id: 'movements', label: 'Movimientos', Icon: History },
  ];

  const renderToolTable = () => (
    <section className="surface tools-table-card">
      <div className="section-toolbar">
        <div>
          <span className="section-icon"><ClipboardList size={18} /></span>
          <div><h2>Listado de herramientas</h2><p>{filteredTools.length} resultados</p></div>
        </div>
        <div className="table-controls">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar herramienta..." /></label>
          <label className="filter-box"><Filter size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ToolStatus)}><option value="all">Todos los estados</option><option value="available">Disponibles</option><option value="loaned">En préstamo</option><option value="review">En revisión</option><option value="retired">Baja</option></select></label>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Estado</th><th>Ubicación / responsable</th><th>QR/NFC</th><th aria-label="Acciones" /></tr></thead>
          <tbody>
            {filteredTools.map((tool) => {
              const technician = data.technicians.find((item) => item.id === tool.technicianId);
              return (
                <tr key={tool.id}>
                  <td><strong className="code-chip">{tool.code}</strong></td>
                  <td><strong>{tool.name}</strong><small>{[tool.brand, tool.model].filter(Boolean).join(' · ') || 'Sin marca/modelo'}</small></td>
                  <td>{tool.category}</td>
                  <td><span className={`status status-${tool.status}`}>{statusLabels[tool.status]}</span></td>
                  <td>{tool.status === 'loaned' ? technician?.name ?? 'Sin responsable' : tool.location}</td>
                  <td><div className="tag-stack"><span><QrCode size={14} /> QR</span>{tool.nfcTag && <span><Nfc size={14} /> NFC</span>}</div></td>
                  <td><div className="row-actions"><button type="button" onClick={() => openModal('qr', tool.id)} title="Ver QR"><QrCode size={17} /></button><button type="button" onClick={() => openModal('nfc', tool.id)} title="Vincular NFC"><Nfc size={17} /></button>{tool.status === 'available' ? <button type="button" onClick={() => openModal('loan', tool.id)} title="Prestar"><ArrowUpFromLine size={17} /></button> : tool.status === 'loaned' ? <button type="button" onClick={() => openModal('return', tool.id)} title="Devolver"><ArrowDownToLine size={17} /></button> : <button type="button" disabled><MoreVertical size={17} /></button>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredTools.length === 0 && <EmptyState icon={BriefcaseBusiness} title="Aún no hay herramientas registradas" text="Comienza agregando una herramienta para gestionar préstamos, QR y NFC." action={<button className="primary-button" type="button" onClick={() => openModal('tool')}><Plus size={18} /> Añadir herramienta</button>} />}
    </section>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="sidebar-close" type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        <div className="brand"><span className="brand-mark">ϟ</span><strong>IsiVolt<span>Pro</span></strong></div>
        <nav>
          {navItems.map(({ id, label, Icon }) => <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => { setView(id); setSidebarOpen(false); }}><Icon size={20} /><span>{label}</span><ChevronRight size={16} /></button>)}
          <button type="button" className="module-active"><QrCode size={20} /><span>QR/NFC</span><ChevronRight size={16} /></button>
          <button type="button" onClick={() => openModal('reset')}><Settings size={20} /><span>Configuración</span><ChevronRight size={16} /></button>
        </nav>
        <div className="sidebar-footer"><ShieldCheck size={20} /><div><strong>Espacio local</strong><small>Sin datos de demostración</small></div></div>
      </aside>
      {sidebarOpen && <button className="sidebar-overlay" type="button" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" />}

      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
          <div className="breadcrumbs"><span>IsiVoltPro</span><i>/</i><span>Herramientas</span><i>/</i><strong>QR/NFC</strong><b>V2 · ALPHA</b></div>
          <div className="topbar-actions"><button type="button" aria-label="Notificaciones"><Bell size={19} /></button><button type="button" aria-label="Ayuda"><CircleHelp size={19} /></button><span className="avatar">IZ</span></div>
        </header>

        <main>
          <section className="page-heading">
            <div><span className="title-icon"><QrCode size={25} /></span><div><p>ECOSISTEMA ISIVOLTPRO</p><h1>{view === 'dashboard' ? 'Herramientas · QR/NFC' : view === 'tools' ? 'Herramientas' : view === 'technicians' ? 'Técnicos' : 'Movimientos'}</h1><small>{view === 'dashboard' ? 'Gestiona herramientas, responsables, préstamos y tecnologías de etiquetado.' : view === 'tools' ? 'Inventario operativo con trazabilidad QR y NFC.' : view === 'technicians' ? 'Directorio creado manualmente para asignar material.' : 'Historial local de las operaciones realizadas.'}</small></div></div>
            <button className="primary-button" type="button" onClick={() => openModal(view === 'technicians' ? 'technician' : 'tool')}>{view === 'technicians' ? <UserPlus size={18} /> : <PackagePlus size={18} />}{view === 'technicians' ? 'Crear técnico' : 'Añadir herramienta'}</button>
          </section>

          {(view === 'dashboard' || view === 'tools') && (
            <>
              <section className="metric-grid">
                {[{ label: 'Herramientas', value: metrics.tools, Icon: BriefcaseBusiness }, { label: 'Disponibles', value: metrics.available, Icon: CheckCircle2 }, { label: 'En préstamo', value: metrics.loaned, Icon: ArrowUpFromLine }, { label: 'Técnicos', value: metrics.technicians, Icon: Users }].map(({ label, value, Icon }) => <article className="metric-card" key={label}><span><Icon size={23} /></span><div><small>{label}</small><strong>{value}</strong><i /></div></article>)}
              </section>
              <section className="dashboard-grid">
                <div>{renderToolTable()}</div>
                <aside className="right-column">
                  <section className="surface quick-panel"><h2><Wrench size={19} /> Acciones rápidas</h2><button className="quick-primary" type="button" onClick={() => openModal('tool')}><Plus size={19} /><span><strong>Añadir herramienta</strong><small>Alta con código automático</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => openModal('technician')}><UserPlus size={19} /><span><strong>Crear técnico</strong><small>Directorio manual</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => openModal('loan')}><ArrowUpFromLine size={19} /><span><strong>Registrar préstamo</strong><small>Asignar a responsable</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => openModal('return')}><ArrowDownToLine size={19} /><span><strong>Registrar devolución</strong><small>Entrada al almacén</small></span><ChevronRight size={17} /></button></section>
                  <section className="surface workspace-status"><span><Boxes size={34} /></span><h2>Espacio limpio</h2><p>La versión nueva comienza sin técnicos, herramientas ni datos de demostración.</p><i /></section>
                </aside>
              </section>
            </>
          )}

          {view === 'technicians' && <section className="surface list-card"><div className="section-toolbar"><div><span className="section-icon"><Users size={18} /></span><div><h2>Directorio técnico</h2><p>{data.technicians.length} técnicos registrados</p></div></div><button className="secondary-button" type="button" onClick={() => openModal('technician')}><Plus size={17} /> Nuevo técnico</button></div>{data.technicians.length === 0 ? <EmptyState icon={Users} title="No hay técnicos registrados" text="Crea el primer técnico para poder asignar herramientas." action={<button className="primary-button" type="button" onClick={() => openModal('technician')}><UserPlus size={18} /> Crear técnico</button>} /> : <div className="technician-grid">{data.technicians.map((technician) => { const assigned = data.tools.filter((tool) => tool.technicianId === technician.id && tool.status === 'loaned').length; return <article className="technician-card" key={technician.id}><span className="initials">{technician.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><small>{technician.code}</small><h3>{technician.name}</h3><p>{technician.category}</p></div><strong>{assigned}<small>asignadas</small></strong></article>; })}</div>}</section>}

          {view === 'movements' && <section className="surface list-card"><div className="section-toolbar"><div><span className="section-icon"><History size={18} /></span><div><h2>Historial de movimientos</h2><p>{data.movements.length} registros</p></div></div></div>{data.movements.length === 0 ? <EmptyState icon={History} title="Sin movimientos registrados" text="Las altas, préstamos, devoluciones y vinculaciones NFC aparecerán aquí." /> : <div className="movement-list">{data.movements.map((movement) => <article key={movement.id}><span><History size={17} /></span><div><strong>{movementLabels[movement.type]}</strong><p>{movement.detail}</p></div><time>{formatDate(movement.occurredAt)}</time></article>)}</div>}</section>}
        </main>
      </div>

      {notice && <div className="toast"><CheckCircle2 size={19} /> {notice}</div>}

      {modal === 'tool' && <Modal title="Nueva herramienta" description="El código y el contenido QR se generan automáticamente." onClose={closeModal}><form id="tool-form" className="form-grid" onSubmit={createTool}><label className="full">Nombre<input required value={toolDraft.name} onChange={(event) => setToolDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Ej. Multímetro Fluke 289" /></label><label>Categoría<select value={toolDraft.category} onChange={(event) => setToolDraft((draft) => ({ ...draft, category: event.target.value }))}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Ubicación<input value={toolDraft.location} onChange={(event) => setToolDraft((draft) => ({ ...draft, location: event.target.value }))} /></label><label>Marca<input value={toolDraft.brand} onChange={(event) => setToolDraft((draft) => ({ ...draft, brand: event.target.value }))} /></label><label>Modelo<input value={toolDraft.model} onChange={(event) => setToolDraft((draft) => ({ ...draft, model: event.target.value }))} /></label><label className="full">Número de serie<input value={toolDraft.serialNumber} onChange={(event) => setToolDraft((draft) => ({ ...draft, serialNumber: event.target.value }))} /></label></form><div className="inline-footer"><button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button><button className="primary-button" type="submit" form="tool-form"><Plus size={18} /> Crear herramienta</button></div></Modal>}

      {modal === 'technician' && <Modal title="Nuevo técnico" description="La aplicación comienza vacía; añade solo los técnicos necesarios." onClose={closeModal}><form id="technician-form" className="form-grid" onSubmit={createTechnician}><label className="full">Nombre y apellidos<input required value={technicianDraft.name} onChange={(event) => setTechnicianDraft((draft) => ({ ...draft, name: event.target.value }))} /></label><label>Categoría<select value={technicianDraft.category} onChange={(event) => setTechnicianDraft((draft) => ({ ...draft, category: event.target.value }))}>{technicianCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Teléfono<input value={technicianDraft.phone} onChange={(event) => setTechnicianDraft((draft) => ({ ...draft, phone: event.target.value }))} /></label><label className="full">Correo electrónico<input type="email" value={technicianDraft.email} onChange={(event) => setTechnicianDraft((draft) => ({ ...draft, email: event.target.value }))} /></label></form><div className="inline-footer"><button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button><button className="primary-button" type="submit" form="technician-form"><UserPlus size={18} /> Crear técnico</button></div></Modal>}

      {modal === 'loan' && <Modal title="Registrar préstamo" description="Selecciona una herramienta disponible y el técnico responsable." onClose={closeModal}><div className="form-grid"><label className="full">Herramienta<select value={selectedToolId} onChange={(event) => setSelectedToolId(event.target.value)}><option value="">Selecciona una herramienta</option>{availableTools.map((tool) => <option value={tool.id} key={tool.id}>{tool.code} · {tool.name}</option>)}</select></label><label className="full">Técnico<select value={selectedTechnicianId} onChange={(event) => setSelectedTechnicianId(event.target.value)}><option value="">Selecciona un técnico</option>{activeTechnicians.map((technician) => <option value={technician.id} key={technician.id}>{technician.code} · {technician.name}</option>)}</select></label></div>{activeTechnicians.length === 0 && <p className="form-warning">Debes crear al menos un técnico antes de registrar un préstamo.</p>}<div className="inline-footer"><button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button><button className="primary-button" type="button" disabled={!selectedToolId || !selectedTechnicianId} onClick={registerLoan}><ArrowUpFromLine size={18} /> Registrar préstamo</button></div></Modal>}

      {modal === 'return' && <Modal title="Registrar devolución" description="Selecciona la herramienta que vuelve al almacén." onClose={closeModal}><div className="form-grid"><label className="full">Herramienta prestada<select value={selectedToolId} onChange={(event) => setSelectedToolId(event.target.value)}><option value="">Selecciona una herramienta</option>{loanedTools.map((tool) => <option value={tool.id} key={tool.id}>{tool.code} · {tool.name}</option>)}</select></label></div><div className="inline-footer"><button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button><button className="primary-button" type="button" disabled={!selectedToolId} onClick={registerReturn}><ArrowDownToLine size={18} /> Registrar devolución</button></div></Modal>}

      {modal === 'qr' && selectedTool && <Modal title={`QR · ${selectedTool.name}`} description={selectedTool.qrPayload} onClose={closeModal}><div className="qr-preview"><QRCodeSVG value={selectedTool.qrPayload} size={220} level="H" includeMargin /><strong>{selectedTool.code}</strong><p>{selectedTool.name}</p><button className="secondary-button" type="button" onClick={() => window.print()}><QrCode size={17} /> Imprimir QR</button></div></Modal>}

      {modal === 'nfc' && selectedTool && <Modal title={`NFC · ${selectedTool.name}`} description="Guarda un identificador manual o intenta grabar el contenido QR mediante Web NFC." onClose={closeModal}><div className="form-grid"><label className="full">Identificador de etiqueta NFC<input value={nfcTag} onChange={(event) => setNfcTag(event.target.value)} placeholder="Ej. NTAG-0001" /></label><div className="nfc-payload full"><Nfc size={22} /><div><small>Contenido que se grabará</small><strong>{selectedTool.qrPayload}</strong></div></div></div><div className="inline-footer"><button className="secondary-button" type="button" disabled={!nfcTag.trim()} onClick={() => void saveNfc(false)}>Guardar referencia</button><button className="primary-button" type="button" disabled={!nfcTag.trim()} onClick={() => void saveNfc(true)}><Nfc size={18} /> Grabar NFC</button></div></Modal>}

      {modal === 'reset' && <Modal title="Vaciar espacio de trabajo" description="Esta acción elimina herramientas, técnicos y movimientos de esta versión nueva." onClose={closeModal}><div className="reset-warning"><RotateCcw size={30} /><p>La aplicación volverá al estado inicial vacío. No afecta a la aplicación antigua ni a sus datos.</p></div><div className="inline-footer"><button className="secondary-button" type="button" onClick={closeModal}>Cancelar</button><button className="danger-button" type="button" onClick={resetWorkspace}><RotateCcw size={18} /> Vaciar datos</button></div></Modal>}
    </div>
  );
}
