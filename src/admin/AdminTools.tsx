import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Boxes,
  Check,
  Clipboard,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  Printer,
  Settings2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CLOUD_PROFILE_EVENT,
  getCloudProfile,
  type CloudProfile,
} from '../cloud/config';
import { loadData, normalizeAppData, saveData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData, Technician } from '../types';
import AccountAdmin from './AccountAdmin';
import InventoryAdmin from './InventoryAdmin';

type TabId = 'credential' | 'inventory' | 'users' | 'data';

const technicianPayload = (technician: Technician) => technician.qrPayload ?? `ISIVOLTPRO:TECH:${technician.code}`;
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function validateBackup(value: unknown): AppData | null {
  return normalizeAppData(value);
}

export default function AdminTools() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('credential');
  const [data, setData] = useState<AppData>(() => loadData());
  const [cloudProfile, setCloudProfile] = useState<CloudProfile | null>(() => getCloudProfile());
  const [technicianId, setTechnicianId] = useState('');
  const [draft, setDraft] = useState<Technician | null>(null);
  const [message, setMessage] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleData = (event: Event) => setData((event as CustomEvent<AppData>).detail ?? loadData());
    const handleProfile = (event: Event) => {
      const next = (event as CustomEvent<CloudProfile | null>).detail ?? getCloudProfile();
      setCloudProfile(next);
      if (next?.role !== 'admin') setTab((current) => current === 'users' ? 'credential' : current);
    };
    window.addEventListener(WORKSPACE_DATA_EVENT, handleData);
    window.addEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    return () => {
      window.removeEventListener(WORKSPACE_DATA_EVENT, handleData);
      window.removeEventListener(CLOUD_PROFILE_EVENT, handleProfile);
    };
  }, []);

  useEffect(() => {
    const selected = data.technicians.find((technician) => technician.id === technicianId) ?? null;
    setDraft(selected ? { ...selected } : null);
  }, [data.technicians, technicianId]);

  const selected = useMemo(
    () => data.technicians.find((technician) => technician.id === technicianId) ?? null,
    [data.technicians, technicianId],
  );

  const saveTechnician = () => {
    if (!draft) return;
    const updatedAt = new Date().toISOString();
    const next = {
      ...data,
      technicians: data.technicians.map((technician) => technician.id === draft.id
        ? { ...draft, name: draft.name.trim(), category: draft.category.trim(), updatedAt }
        : technician),
    };
    saveData(next);
    setData(next);
    setMessage('Ficha del técnico actualizada.');
  };

  const toggleTechnician = () => {
    if (!draft) return;
    setDraft({ ...draft, active: !draft.active });
  };

  const copyPayload = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(technicianPayload(selected));
    setMessage('Identificador QR copiado.');
  };

  const exportBackup = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`isivoltpro-copia-${date}.json`, JSON.stringify(data, null, 2), 'application/json');
    setMessage('Copia de seguridad descargada.');
  };

  const exportTools = () => {
    const rows = [
      ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Marca', 'Modelo', 'Serie', 'Estado', 'Técnico'],
      ...data.tools.map((tool) => [
        tool.code,
        tool.name,
        tool.category,
        tool.location,
        tool.brand ?? '',
        tool.model ?? '',
        tool.serialNumber ?? '',
        tool.status,
        data.technicians.find((technician) => technician.id === tool.technicianId)?.name ?? '',
      ]),
    ];
    downloadFile('isivoltpro-inventario.csv', rows.map((row) => row.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8');
    setMessage('Inventario CSV descargado.');
  };

  const exportMovements = () => {
    const rows = [
      ['Fecha', 'Tipo', 'Herramienta', 'Técnico', 'Lote', 'Detalle'],
      ...data.movements.map((movement) => [
        movement.occurredAt,
        movement.type,
        data.tools.find((tool) => tool.id === movement.toolId)?.code ?? '',
        data.technicians.find((technician) => technician.id === movement.technicianId)?.name ?? '',
        movement.batchId ?? '',
        movement.detail,
      ]),
    ];
    downloadFile('isivoltpro-movimientos.csv', rows.map((row) => row.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8');
    setMessage('Historial CSV descargado.');
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = validateBackup(JSON.parse(await file.text()));
      if (!parsed) throw new Error('Formato no válido');
      saveData(parsed);
      setData(parsed);
      setTechnicianId('');
      setMessage(`Copia restaurada: ${parsed.tools.length} artículos y ${parsed.technicians.length} técnicos.`);
    } catch {
      setMessage('No se ha podido importar: el archivo no es una copia válida de IsiVoltPro.');
    }
  };

  const launcher = target ? createPortal(
    <button className="admin-tools-launcher" type="button" onClick={() => setOpen(true)} title="Administración, inventario, usuarios y credenciales">
      <Settings2 size={18} />
      <span>Gestionar</span>
    </button>,
    target,
  ) : null;

  return (
    <>
      {launcher}
      {open && createPortal(
        <div className="admin-tools-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="admin-tools-panel" role="dialog" aria-modal="true" aria-label="Administración IsiVoltPro">
            <header>
              <div><small>ISIVOLTPRO HERRAMIENTAS</small><h2>Administración</h2><p>Inventario, técnicos, usuarios y copias de seguridad.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <nav>
              <button className={tab === 'credential' ? 'active' : ''} type="button" onClick={() => setTab('credential')}><UserRound size={18} /> Técnicos</button>
              <button className={tab === 'inventory' ? 'active' : ''} type="button" onClick={() => setTab('inventory')}><Boxes size={18} /> Inventario</button>
              {cloudProfile?.role === 'admin' && <button className={tab === 'users' ? 'active' : ''} type="button" onClick={() => setTab('users')}><UsersRound size={18} /> Usuarios</button>}
              <button className={tab === 'data' ? 'active' : ''} type="button" onClick={() => setTab('data')}><DatabaseBackup size={18} /> Datos</button>
            </nav>

            <main>
              {tab === 'credential' && (
                <div className="admin-credential-layout">
                  <div className="admin-form-card">
                    <label>Técnico
                      <select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
                        <option value="">Selecciona un técnico</option>
                        {data.technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.code} · {technician.name}</option>)}
                      </select>
                    </label>

                    {draft ? (
                      <>
                        <div className="admin-form-grid">
                          <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                          <label>Categoría<input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
                          <label>Teléfono<input value={draft.phone ?? ''} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
                          <label>Correo<input type="email" value={draft.email ?? ''} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
                        </div>
                        <label className="admin-toggle"><input type="checkbox" checked={draft.active} onChange={toggleTechnician} /><span /> Técnico activo</label>
                        <button className="admin-primary" type="button" onClick={saveTechnician}><Check size={18} /> Guardar cambios</button>
                      </>
                    ) : <p className="admin-empty">Selecciona un técnico para editar su ficha y generar la credencial.</p>}
                  </div>

                  <div className="admin-credential-card" id="isivoltpro-technician-card">
                    {selected ? (
                      <>
                        <div className="credential-brand"><span>ϟ</span><div><strong>IsiVoltPro</strong><small>Identificación de técnico</small></div></div>
                        <QRCodeSVG value={technicianPayload(selected)} size={190} level="H" includeMargin />
                        <h3>{selected.name}</h3>
                        <p>{selected.code} · {selected.category}</p>
                        <code>{technicianPayload(selected)}</code>
                        <div className="credential-actions">
                          <button type="button" onClick={copyPayload}><Clipboard size={17} /> Copiar</button>
                          <button type="button" onClick={() => window.print()}><Printer size={17} /> Imprimir</button>
                        </div>
                      </>
                    ) : <div className="credential-placeholder"><UserRound size={42} /><strong>Credencial personal</strong><p>Selecciona un técnico para mostrar su QR.</p></div>}
                  </div>
                </div>
              )}

              {tab === 'inventory' && (
                <InventoryAdmin data={data} onDataChange={setData} onMessage={setMessage} />
              )}

              {tab === 'users' && cloudProfile?.role === 'admin' && (
                <AccountAdmin data={data} onMessage={setMessage} />
              )}

              {tab === 'data' && (
                <div className="admin-data-grid">
                  <article><DatabaseBackup size={24} /><div><strong>Copia completa</strong><p>Técnicos, inventario, lotes y movimientos.</p></div><button type="button" onClick={exportBackup}><Download size={17} /> Descargar JSON</button></article>
                  <article><FileSpreadsheet size={24} /><div><strong>Inventario</strong><p>{data.tools.length} artículos registrados.</p></div><button type="button" onClick={exportTools}><Download size={17} /> Exportar CSV</button></article>
                  <article><FileSpreadsheet size={24} /><div><strong>Historial</strong><p>{data.movements.length} movimientos registrados.</p></div><button type="button" onClick={exportMovements}><Download size={17} /> Exportar CSV</button></article>
                  <article><Upload size={24} /><div><strong>Restaurar copia</strong><p>Sustituye los datos locales por una copia JSON validada.</p></div><button type="button" onClick={() => importRef.current?.click()}><Upload size={17} /> Seleccionar archivo</button><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} /></article>
                </div>
              )}

              {message && <p className="admin-message" role="status">{message}</p>}
            </main>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
