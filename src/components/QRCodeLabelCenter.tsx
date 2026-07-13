import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Printer, QrCode, Square, Tags, Users, Wrench, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Technician, Tool } from '../domain/types';
import { printOrShareQrLabels } from '../services/qrLabelPrint';
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
      subtitle: `${tool.category} · ${tool.location}`,
      payload: tool.qrCode,
    }));

const buildTechnicianLabels = (technicians: Technician[]): LabelItem[] =>
  [...technicians]
    .sort((a, b) => a.code.localeCompare(b.code, 'es'))
    .map((technician) => ({
      id: technician.id,
      code: technician.code,
      title: technician.name,
      subtitle: technician.specialty,
      payload: `ISIVOLT:TECH:${technician.code}`,
    }));

export default function QRCodeLabelCenter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LabelMode>('technicians');
  const [technicianSnapshot, setTechnicianSnapshot] = useState<Technician[]>([]);
  const [toolSnapshot, setToolSnapshot] = useState<Tool[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const [status, setStatus] = useState('');

  const technicianLabels = useMemo(() => buildTechnicianLabels(technicianSnapshot), [technicianSnapshot]);
  const toolLabels = useMemo(() => buildToolLabels(toolSnapshot), [toolSnapshot]);
  const labels = mode === 'technicians' ? technicianLabels : toolLabels;

  const openCenter = () => {
    const data = loadAppData();
    setTechnicianSnapshot(data.technicians);
    setToolSnapshot(data.tools);
    setMode('technicians');
    setSelectedIds(data.technicians.map((technician) => technician.id));
    setStatus('');
    setOpen(true);
  };

  const changeMode = (nextMode: LabelMode) => {
    setMode(nextMode);
    setSelectedIds((nextMode === 'technicians' ? technicianLabels : toolLabels).map((item) => item.id));
    setStatus('');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectAll = () => {
    setSelectedIds((current) => current.length === labels.length ? [] : labels.map((item) => item.id));
  };

  const printSelection = async (ids: string[]) => {
    if (ids.length === 0 || printing) return;
    setPrinting(true);
    setStatus('Preparando etiquetas…');
    try {
      const wanted = new Set(ids);
      const cardsHtml = [...document.querySelectorAll<HTMLElement>('.qr-label-card[data-label-id]')]
        .filter((card) => wanted.has(card.dataset.labelId ?? ''))
        .map((card) => card.outerHTML);
      const title = `ISIVOLT · ${mode === 'technicians' ? 'Credenciales de técnicos' : 'Etiquetas de herramientas'}`;
      const result = await printOrShareQrLabels(
        title,
        cardsHtml,
        `ISIVOLT_${mode === 'technicians' ? 'tecnicos' : 'herramientas'}_${ids.length}_etiquetas.html`,
      );
      setStatus(result === 'shared'
        ? 'Archivo preparado. Ábrelo con el navegador o servicio de impresión.'
        : result === 'printed'
          ? 'Ventana de impresión abierta.'
          : 'Archivo de impresión descargado.');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'No se ha podido preparar la impresión.');
    } finally {
      setPrinting(false);
    }
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
        <motion.span animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.08, 1] }} transition={{ duration: 2.8, repeat: Infinity }}>
          <Tags size={22} />
        </motion.span>
        <strong>Etiquetas QR</strong>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="qr-label-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
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
                  <p>Selecciona todas, varias o una sola etiqueta y prepara el archivo de impresión.</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Cerrar centro de etiquetas"><X size={21} /></button>
              </header>

              <div className="qr-label-toolbar no-print">
                <div className="qr-label-tabs">
                  <button className={mode === 'technicians' ? 'active' : ''} onClick={() => changeMode('technicians')}>
                    <Users size={17} /> Técnicos <span>{technicianLabels.length}</span>
                  </button>
                  <button className={mode === 'tools' ? 'active' : ''} onClick={() => changeMode('tools')}>
                    <Wrench size={17} /> Herramientas <span>{toolLabels.length}</span>
                  </button>
                </div>
                <div className="qr-label-print-controls">
                  <button className="qr-select-all" type="button" onClick={selectAll}>
                    {selectedIds.length === labels.length && labels.length > 0 ? <Check size={17} /> : <Square size={17} />}
                    {selectedIds.length === labels.length && labels.length > 0 ? 'Quitar selección' : 'Seleccionar todas'}
                  </button>
                  <motion.button className="qr-print-button" onClick={() => printSelection(selectedIds)} disabled={printing || selectedIds.length === 0} whileTap={{ scale: 0.95 }}>
                    <Printer size={18} /> {printing ? 'Preparando…' : `Imprimir grupo (${selectedIds.length})`}
                  </motion.button>
                </div>
                {status && <p className="qr-print-status">{status}</p>}
              </div>

              <div className="qr-print-heading print-only">
                <strong>ISIVOLT · {mode === 'technicians' ? 'Credenciales de técnicos' : 'Etiquetas de herramientas'}</strong>
                <span>{selectedIds.length} códigos QR</span>
              </div>

              <div className="qr-label-sheet">
                {labels.map((item, index) => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <motion.article
                      className={`qr-label-card ${selected ? 'selected' : ''}`}
                      data-label-id={item.id}
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index, 14) * 0.018 }}
                    >
                      <button className="qr-label-select no-print" type="button" onClick={() => toggleSelected(item.id)} aria-label={`${selected ? 'Quitar' : 'Añadir'} ${item.title}`}>
                        {selected ? <Check size={17} /> : <Square size={17} />}
                      </button>
                      <div className="qr-label-code"><QRCodeSVG value={item.payload} size={98} level="M" marginSize={1} /></div>
                      <div className="qr-label-copy">
                        <span>ISIVOLT</span>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                        <b>{item.code}</b>
                      </div>
                      <button className="qr-label-print-one no-print" type="button" onClick={() => printSelection([item.id])} disabled={printing}>
                        <Printer size={15} /> Imprimir esta
                      </button>
                    </motion.article>
                  );
                })}
              </div>

              {labels.length === 0 && (
                <div className="qr-label-empty"><Wrench size={34} /><strong>No hay elementos registrados</strong><span>Da de alta un elemento para generar su etiqueta.</span></div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
