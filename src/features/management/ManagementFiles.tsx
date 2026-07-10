import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, FileSpreadsheet, Files, X } from 'lucide-react';
import { loadAppData } from '../../services/storage';
import { exportImportTemplate, exportManagementWorkbook } from './managementExport';

export default function ManagementFiles() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'report' | 'template' | null>(null);
  const [message, setMessage] = useState('');

  const run = async (type: 'report' | 'template') => {
    setBusy(type);
    setMessage('');
    try {
      const name = type === 'report'
        ? await exportManagementWorkbook(loadAppData())
        : await exportImportTemplate();
      setMessage(`${name} preparado correctamente.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se ha podido preparar el archivo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <motion.button className="management-files-launcher" type="button" onClick={() => setOpen(true)} whileTap={{ scale: 0.9 }} aria-label="Abrir archivos de gestión">
        <Files size={20} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div className="management-files-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.section className="management-files-panel" initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 25, scale: 0.96 }} onClick={(event) => event.stopPropagation()}>
              <header><div><FileSpreadsheet size={22} /><span><small>Documentación</small><strong>Archivos de gestión</strong></span></div><button onClick={() => setOpen(false)}><X size={20} /></button></header>
              <button className="management-file-action" onClick={() => { void run('report'); }} disabled={Boolean(busy)}><Download size={22} /><span><strong>{busy === 'report' ? 'Generando informe…' : 'Informe de gestión'}</strong><small>Activos, accesorios, mantenimiento y alertas.</small></span></button>
              <button className="management-file-action" onClick={() => { void run('template'); }} disabled={Boolean(busy)}><FileSpreadsheet size={22} /><span><strong>{busy === 'template' ? 'Creando plantilla…' : 'Plantilla de importación'}</strong><small>Excel preparado con las columnas reconocidas.</small></span></button>
              {message && <p>{message}</p>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
