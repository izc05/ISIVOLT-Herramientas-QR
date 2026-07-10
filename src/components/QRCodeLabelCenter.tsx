import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Printer, QrCode, Tags, Users, Wrench, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { hospitalTechnicians } from '../data/technicians';
import type { Tool } from '../domain/types';
import { loadAppData } from '../services/storage';

type LabelMode = 'technicians' | 'tools';

type LabelItem = {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  payload: string;
};

const buildToolLabels = (tools: Tool[]): LabelItem[] =>
  [...tools]
    .sort((a, b) => a.code.localeCompare(b.code, 'es'))
    .map((tool) => ({
      id: tool.id,
      code: tool.code,
      title: tool.name,
      subtitle: tool.location,
      payload: tool.qrCode,
    }));

const technicianLabels: LabelItem[] = hospitalTechnicians.map((technician) => ({
  id: technician.id,
  code: technician.code,
  title: technician.name,
  subtitle: technician.specialty,
  payload: `ISIVOLT:TECH:${technician.code}`,
}));

export default function QRCodeLabelCenter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LabelMode>('technicians');
  const [toolSnapshot, setToolSnapshot] = useState<Tool[]>([]);

  const labels = useMemo(
    () => (mode === 'technicians' ? technicianLabels : buildToolLabels(toolSnapshot)),
    [mode, toolSnapshot],
  );

  const openCenter = () => {
    setToolSnapshot(loadAppData().tools);
    setOpen(true);
  };

  const printLabels = () => {
    document.body.classList.add('printing-qr-labels');
    const cleanup = () => document.body.classList.remove('printing-qr-labels');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  return (
    <>
      <motion.button
        className="qr-label-launcher"
        onClick={openCenter}
        whileHover={{ y: -4, scale: 1.04 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Abrir centro de etiquetas QR"
      >
        <motion.span
          animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.8, repeat: Infinity }}
        >
          <Tags size={22} />
        </motion.span>
        <strong>Etiquetas QR</strong>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="qr-label-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.section
              className="qr-label-center"
              initial={{ opacity: 0, y: 42, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 25 }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Centro de etiquetas QR"
            >
              <header className="qr-label-header no-print">
                <div>
                  <span className="qr-label-kicker"><QrCode size={15} /> Identificación física</span>
                  <h2>Centro de etiquetas QR</h2>
                  <p>Genera códigos reales para técnicos y herramientas y prepara una hoja lista para imprimir.</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Cerrar centro de etiquetas"><X size={21} /></button>
              </header>

              <div className="qr-label-toolbar no-print">
                <div className="qr-label-tabs">
                  <button className={mode === 'technicians' ? 'active' : ''} onClick={() => setMode('technicians')}>
                    <Users size={17} /> Técnicos <span>{technicianLabels.length}</span>
                  </button>
                  <button className={mode === 'tools' ? 'active' : ''} onClick={() => setMode('tools')}>
                    <Wrench size={17} /> Herramientas <span>{toolSnapshot.length}</span>
                  </button>
                </div>
                <motion.button className="qr-print-button" onClick={printLabels} whileTap={{ scale: 0.95 }}>
                  <Printer size={18} /> Imprimir etiquetas
                </motion.button>
              </div>

              <div className="qr-print-heading print-only">
                <strong>ISIVOLT · {mode === 'technicians' ? 'Credenciales de técnicos' : 'Etiquetas de herramientas'}</strong>
                <span>{labels.length} códigos QR</span>
              </div>

              <div className="qr-label-sheet">
                {labels.map((item, index) => (
                  <motion.article
                    className="qr-label-card"
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 14) * 0.018 }}
                  >
                    <div className="qr-label-code">
                      <QRCodeSVG value={item.payload} size={98} level="M" marginSize={1} />
                    </div>
                    <div className="qr-label-copy">
                      <span>ISIVOLT</span>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                      <b>{item.code}</b>
                    </div>
                  </motion.article>
                ))}
              </div>

              {labels.length === 0 && (
                <div className="qr-label-empty">
                  <Wrench size={34} />
                  <strong>No hay herramientas registradas</strong>
                  <span>Da de alta una herramienta para generar su etiqueta.</span>
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
