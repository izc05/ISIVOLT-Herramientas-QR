import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BriefcaseBusiness,
  Check,
  Copy,
  Hash,
  Mail,
  Pencil,
  Phone,
  Printer,
  Save,
  ShieldCheck,
  UserCog,
  UserRound,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import AppV2 from './AppV2';
import QRCodeLabelCenter from './components/QRCodeLabelCenter';
import ToolDetailSheet from './components/ToolDetailSheet';
import type { Technician, Tool } from './domain/types';
import { getCurrentSecurityUser } from './security/session';
import { loadAppData, saveAppData } from './services/storage';

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('es-ES');
const normalizeCode = (value: string) => value.trim().toLocaleUpperCase('es-ES');
const normalizePhone = (value: string) => value.trim().replace(/[()\s.-]/g, '');

const withPrintMode = (className: string) => {
  document.body.classList.add(className);
  const cleanup = () => document.body.classList.remove(className);
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1500);
};

export default function AppV3() {
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [copied, setCopied] = useState(false);
  const [editError, setEditError] = useState('');
  const canEditTechnicians = getCurrentSecurityUser()?.role === 'admin';

  useEffect(() => {
    const handleCardClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const technicianCard = target.closest<HTMLElement>('.technician-card');
      if (technicianCard) {
        const code = technicianCard.querySelector<HTMLElement>('[data-technician-code], .technician-code')?.textContent?.trim();
        const name = technicianCard.querySelector('h3')?.textContent;
        const technicians = loadAppData().technicians;
        const technician = code
          ? technicians.find((item) => normalizeCode(item.code) === normalizeCode(code))
          : technicians.find((item) => name && normalizeName(item.name) === normalizeName(name));
        if (technician) {
          setSelectedTool(null);
          setSelectedTechnician(technician);
        }
        return;
      }

      const toolCard = target.closest<HTMLElement>('.tool-card');
      if (!toolCard || target.closest('.tool-card-actions button, .tool-media-trigger')) return;
      const code = toolCard.querySelector('.tool-code')?.textContent?.trim();
      if (!code) return;
      const tool = loadAppData().tools.find((item) => item.code === code);
      if (tool) {
        setSelectedTechnician(null);
        setEditingTechnician(null);
        setSelectedTool(tool);
      }
    };

    document.addEventListener('click', handleCardClick);
    return () => document.removeEventListener('click', handleCardClick);
  }, []);

  useEffect(() => {
    const refreshSelected = () => {
      if (!selectedTechnician) return;
      const refreshed = loadAppData().technicians.find((item) => item.id === selectedTechnician.id);
      if (refreshed) setSelectedTechnician(refreshed);
    };
    window.addEventListener('isivolt:data-updated', refreshSelected);
    window.addEventListener('isivolt:management-refresh', refreshSelected);
    return () => {
      window.removeEventListener('isivolt:data-updated', refreshSelected);
      window.removeEventListener('isivolt:management-refresh', refreshSelected);
    };
  }, [selectedTechnician?.id]);

  useEffect(() => {
    if (!selectedTechnician && !selectedTool && !editingTechnician) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingTechnician) setEditingTechnician(null);
        else {
          setSelectedTechnician(null);
          setSelectedTool(null);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedTechnician, selectedTool, editingTechnician]);

  const technicianQrPayload = useMemo(
    () => selectedTechnician ? `ISIVOLT:TECH:${selectedTechnician.code}` : '',
    [selectedTechnician],
  );

  const copyQrPayload = async () => {
    if (!technicianQrPayload) return;
    try {
      await navigator.clipboard.writeText(technicianQrPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const updateEditField = <Key extends keyof Technician>(field: Key, value: Technician[Key]) => {
    setEditingTechnician((current) => current ? { ...current, [field]: value } : current);
  };

  const saveTechnician = () => {
    if (!editingTechnician) return;
    setEditError('');
    const data = loadAppData();
    const name = editingTechnician.name.trim();
    const code = normalizeCode(editingTechnician.code);
    const phone = normalizePhone(editingTechnician.phone ?? '');
    const email = editingTechnician.email?.trim().toLowerCase() ?? '';

    if (name.length < 3) {
      setEditError('Escribe el nombre y los apellidos del técnico.');
      return;
    }
    if (code.length < 2) {
      setEditError('El código interno es obligatorio.');
      return;
    }
    if (data.technicians.some((item) => item.id !== editingTechnician.id && normalizeCode(item.code) === code)) {
      setEditError('Ya existe otro técnico con ese código interno.');
      return;
    }
    if (email && data.technicians.some((item) => item.id !== editingTechnician.id && item.email?.trim().toLowerCase() === email)) {
      setEditError('Ese correo ya pertenece a otro técnico.');
      return;
    }
    if (phone && data.technicians.some((item) => item.id !== editingTechnician.id && normalizePhone(item.phone ?? '') === phone)) {
      setEditError('Ese teléfono ya pertenece a otro técnico.');
      return;
    }

    const timestamp = new Date().toISOString();
    const updated: Technician = {
      ...editingTechnician,
      name,
      code,
      specialty: editingTechnician.specialty.trim() || 'Mantenimiento',
      role: editingTechnician.role?.trim() || 'Técnico de mantenimiento',
      phone: phone || undefined,
      extension: editingTechnician.extension?.trim() || undefined,
      email: email || undefined,
      updatedAt: timestamp,
    };
    const next = {
      ...data,
      technicians: data.technicians.map((item) => item.id === updated.id ? updated : item),
    };
    saveAppData(next);
    setSelectedTechnician(updated);
    setEditingTechnician(null);
    window.dispatchEvent(new CustomEvent('isivolt:management-refresh'));
    window.dispatchEvent(new CustomEvent('isivolt:app-refresh'));
  };

  return (
    <>
      <AppV2 />
      <QRCodeLabelCenter />

      <AnimatePresence>
        {selectedTechnician && (
          <motion.div
            className="technician-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTechnician(null)}
          >
            <motion.section
              className="technician-detail-modal printable-single-qr"
              data-technician-id={selectedTechnician.id}
              initial={{ opacity: 0, y: 44, scale: 0.9, rotateX: 8 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Ficha de ${selectedTechnician.name}`}
            >
              <span className="technician-detail-glow" aria-hidden="true" />
              <button className="technician-detail-close no-print" onClick={() => setSelectedTechnician(null)} aria-label="Cerrar ficha">
                <X size={20} />
              </button>

              <header className="technician-detail-header">
                <motion.div
                  className="technician-detail-avatar"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(33,230,255,.2)',
                      '0 0 42px rgba(168,85,247,.36)',
                      '0 0 20px rgba(33,230,255,.2)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {selectedTechnician.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </motion.div>
                <div>
                  <span className="technician-detail-kicker"><UserRound size={14} /> Perfil operativo</span>
                  <h2>{selectedTechnician.name}</h2>
                  <p>{selectedTechnician.specialty}</p>
                </div>
              </header>

              <div className="technician-detail-grid">
                <div className="technician-detail-item">
                  <BriefcaseBusiness size={18} />
                  <span><small>Cargo</small><strong>{selectedTechnician.role ?? 'Técnico de mantenimiento'}</strong></span>
                </div>
                <div className="technician-detail-item">
                  <Hash size={18} />
                  <span><small>Código interno</small><strong>{selectedTechnician.code}</strong></span>
                </div>
                <div className="technician-detail-item">
                  <Phone size={18} />
                  <span><small>Teléfono</small><strong>{selectedTechnician.phone ?? 'No disponible'}</strong></span>
                </div>
                <div className="technician-detail-item">
                  <Phone size={18} />
                  <span><small>Extensión interna</small><strong>{selectedTechnician.extension ?? 'No disponible'}</strong></span>
                </div>
              </div>

              {selectedTechnician.email && (
                <a className="technician-detail-email" href={`mailto:${selectedTechnician.email}`}>
                  <Mail size={18} />
                  <span><small>Correo corporativo</small><strong>{selectedTechnician.email}</strong></span>
                </a>
              )}

              <div className="technician-qr-preview real-qr-preview">
                <motion.div className="real-qr-code" whileHover={{ scale: 1.03 }}>
                  <QRCodeSVG value={technicianQrPayload} size={176} level="M" marginSize={2} />
                </motion.div>
                <div>
                  <small>QR personal escaneable</small>
                  <strong>{technicianQrPayload}</strong>
                  <p>Identifica al técnico cuando una operación la registra administración o almacén.</p>
                  <div className="qr-detail-actions no-print">
                    <motion.button onClick={copyQrPayload} whileTap={{ scale: 0.92 }}>
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? 'Copiado' : 'Copiar código'}
                    </motion.button>
                    <motion.button onClick={() => withPrintMode('printing-single-qr')} whileTap={{ scale: 0.92 }}>
                      <Printer size={18} /> Imprimir ficha
                    </motion.button>
                  </div>
                </div>
              </div>

              {canEditTechnicians && (
                <div className="technician-admin-actions no-print">
                  <button type="button" onClick={() => { setEditError(''); setEditingTechnician({ ...selectedTechnician }); }}><Pencil size={18} /> Editar técnico</button>
                  <button type="button" onClick={() => document.querySelector<HTMLButtonElement>('.technician-account-manager-launcher')?.click()}><UserCog size={18} /> Gestionar acceso</button>
                </div>
              )}

              <p className="technician-detail-note no-print">
                Estado: {selectedTechnician.active ? 'activo' : 'inactivo'} · Los cambios quedan incluidos en la sincronización y en las copias de seguridad.
              </p>
            </motion.section>
          </motion.div>
        )}

        {editingTechnician && (
          <motion.div className="technician-edit-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingTechnician(null)}>
            <motion.section className="technician-edit-modal" initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .97 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Editar técnico">
              <header><div><span><Pencil size={22} /></span><div><small>Administración</small><h2>Editar técnico</h2><p>Actualiza su ficha sin cambiar el historial ni sus asignaciones.</p></div></div><button type="button" onClick={() => setEditingTechnician(null)} aria-label="Cerrar"><X size={20} /></button></header>
              <div className="technician-edit-grid">
                <label className="wide"><span>Nombre y apellidos</span><input value={editingTechnician.name} onChange={(event) => updateEditField('name', event.target.value)} /></label>
                <label><span>Código interno</span><input value={editingTechnician.code} onChange={(event) => updateEditField('code', event.target.value.toUpperCase())} /></label>
                <label><span>Especialidad</span><input value={editingTechnician.specialty} onChange={(event) => updateEditField('specialty', event.target.value)} /></label>
                <label className="wide"><span>Cargo</span><input value={editingTechnician.role ?? ''} onChange={(event) => updateEditField('role', event.target.value)} /></label>
                <label><span>Teléfono</span><input type="tel" inputMode="tel" value={editingTechnician.phone ?? ''} onChange={(event) => updateEditField('phone', event.target.value)} /></label>
                <label><span>Extensión</span><input inputMode="numeric" value={editingTechnician.extension ?? ''} onChange={(event) => updateEditField('extension', event.target.value)} /></label>
                <label className="wide"><span>Correo corporativo</span><input type="email" value={editingTechnician.email ?? ''} onChange={(event) => updateEditField('email', event.target.value)} /></label>
                <label className="technician-active-toggle wide"><input type="checkbox" checked={editingTechnician.active} onChange={(event) => updateEditField('active', event.target.checked)} /><span><ShieldCheck size={18} /><strong>Técnico activo</strong><small>Puede recibir herramientas y mantener una cuenta vinculada.</small></span></label>
              </div>
              {editError && <p className="technician-edit-error">{editError}</p>}
              <footer><button type="button" onClick={() => setEditingTechnician(null)}>Cancelar</button><button type="button" className="primary" onClick={saveTechnician}><Save size={18} /> Guardar cambios</button></footer>
            </motion.section>
          </motion.div>
        )}

        {selectedTool && <ToolDetailSheet tool={selectedTool} onClose={() => setSelectedTool(null)} />}
      </AnimatePresence>
    </>
  );
}
