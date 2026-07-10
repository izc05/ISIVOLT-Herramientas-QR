import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArchiveRestore,
  Check,
  CloudUpload,
  DatabaseBackup,
  FileSpreadsheet,
  History,
  LoaderCircle,
  PackageCheck,
  Share2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { loadAppData } from '../services/storage';
import { exportBackup, exportOperationalExcel, restoreBackup } from '../services/reports';

type ReportCenterProps = {
  onRestore: () => void;
};

type Notice = {
  title: string;
  detail: string;
  tone: 'success' | 'error';
} | null;

export default function ReportCenter({ onRestore }: ReportCenterProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'excel' | 'backup' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [revision, setRevision] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useMemo(() => loadAppData(), [open, revision]);

  const stats = useMemo(() => ({
    tools: data.tools.length,
    loaned: data.tools.filter((tool) => tool.status === 'loaned').length,
    technicians: data.technicians.filter((technician) => technician.active).length,
    movements: data.movements.length,
  }), [data]);

  const showNotice = (nextNotice: Notice) => {
    setNotice(nextNotice);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const runExcelExport = async () => {
    setBusy('excel');
    try {
      const filename = await exportOperationalExcel(loadAppData());
      showNotice({
        title: 'Informe preparado',
        detail: `${filename} contiene seis hojas de control operativo.`,
        tone: 'success',
      });
    } catch (error) {
      showNotice({
        title: 'No se pudo generar el Excel',
        detail: error instanceof Error ? error.message : 'Se ha producido un error inesperado.',
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const runBackupExport = async () => {
    setBusy('backup');
    try {
      const filename = await exportBackup(loadAppData());
      showNotice({
        title: 'Copia completa preparada',
        detail: `${filename} puede guardarse en Drive, correo o almacenamiento externo.`,
        tone: 'success',
      });
    } catch (error) {
      showNotice({
        title: 'No se pudo crear la copia',
        detail: error instanceof Error ? error.message : 'Se ha producido un error inesperado.',
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreFile = async (file?: File) => {
    if (!file) return;
    const confirmed = window.confirm(
      'La restauración sustituirá el inventario, los técnicos y todos los movimientos actuales. ¿Continuar?',
    );
    if (!confirmed) {
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setBusy('restore');
    try {
      const text = await file.text();
      const backup = restoreBackup(text);
      setRevision((value) => value + 1);
      onRestore();
      showNotice({
        title: 'Copia restaurada',
        detail: `Datos recuperados desde la copia del ${new Intl.DateTimeFormat('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(backup.createdAt))}.`,
        tone: 'success',
      });
    } catch (error) {
      showNotice({
        title: 'La copia no es válida',
        detail: error instanceof Error ? error.message : 'No se ha podido leer el archivo.',
        tone: 'error',
      });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <motion.button
        className="report-center-launcher"
        onClick={() => setOpen(true)}
        whileHover={{ y: -4, scale: 1.04 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Abrir informes y copias de seguridad"
      >
        <span><FileSpreadsheet size={23} /></span>
        <strong>Informes</strong>
      </motion.button>

      <input
        ref={inputRef}
        className="report-hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void handleRestoreFile(event.target.files?.[0])}
      />

      <AnimatePresence>
        {open && (
          <motion.div
            className="report-center-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && setOpen(false)}
          >
            <motion.section
              className="report-center-modal"
              initial={{ opacity: 0, y: 48, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 270, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Centro de informes y copias"
            >
              <span className="report-center-sweep" aria-hidden="true" />
              <button className="report-center-close" onClick={() => setOpen(false)} disabled={Boolean(busy)}>
                <X size={20} />
              </button>

              <header className="report-center-header">
                <motion.span
                  animate={{ rotate: [0, 4, -4, 0], boxShadow: ['0 0 20px rgba(49,235,255,.18)', '0 0 42px rgba(159,98,255,.34)', '0 0 20px rgba(49,235,255,.18)'] }}
                  transition={{ duration: 3.2, repeat: Infinity }}
                >
                  <FileSpreadsheet size={31} />
                </motion.span>
                <div>
                  <small><ShieldCheck size={14} /> Centro de datos local</small>
                  <h2>Informes y seguridad</h2>
                  <p>Exporta la trazabilidad o protege todo el trabajo realizado en el dispositivo.</p>
                </div>
              </header>

              <div className="report-stats-grid">
                <article><PackageCheck size={18} /><strong>{stats.tools}</strong><span>Herramientas</span></article>
                <article><Share2 size={18} /><strong>{stats.loaned}</strong><span>Prestadas</span></article>
                <article><Users size={18} /><strong>{stats.technicians}</strong><span>Técnicos</span></article>
                <article><History size={18} /><strong>{stats.movements}</strong><span>Movimientos</span></article>
              </div>

              <div className="report-action-grid">
                <motion.button onClick={() => void runExcelExport()} disabled={Boolean(busy)} whileTap={{ scale: 0.97 }}>
                  <span className="report-action-icon excel"><FileSpreadsheet size={27} /></span>
                  <span><strong>Informe Excel profesional</strong><small>Resumen, movimientos, prestadas, inventario, técnicos e incidencias.</small></span>
                  {busy === 'excel' ? <LoaderCircle className="report-spinner" /> : <CloudUpload size={20} />}
                </motion.button>

                <motion.button onClick={() => void runBackupExport()} disabled={Boolean(busy)} whileTap={{ scale: 0.97 }}>
                  <span className="report-action-icon backup"><DatabaseBackup size={27} /></span>
                  <span><strong>Crear copia de seguridad</strong><small>Archivo JSON completo, portable y restaurable.</small></span>
                  {busy === 'backup' ? <LoaderCircle className="report-spinner" /> : <CloudUpload size={20} />}
                </motion.button>

                <motion.button onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} whileTap={{ scale: 0.97 }}>
                  <span className="report-action-icon restore"><ArchiveRestore size={27} /></span>
                  <span><strong>Restaurar una copia</strong><small>Recupera inventario, técnicos, préstamos e historial.</small></span>
                  {busy === 'restore' ? <LoaderCircle className="report-spinner" /> : <ArchiveRestore size={20} />}
                </motion.button>
              </div>

              <footer className="report-center-footer">
                <ShieldCheck size={17} />
                <span>La copia se valida antes de sustituir los datos y se guarda también en SQLite dentro de la APK.</span>
              </footer>
            </motion.section>
          </motion.div>
        )}

        {notice && (
          <motion.div
            className={`report-notice report-notice-${notice.tone}`}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
          >
            {notice.tone === 'success' ? <Check size={20} /> : <X size={20} />}
            <span><strong>{notice.title}</strong><small>{notice.detail}</small></span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
