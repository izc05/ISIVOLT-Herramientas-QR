import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CheckSquare, Printer, QrCode, Square, Tags, Users, Wrench, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
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
      subtitle: `${tool.category} · ${tool.location}`,
      payload: tool.qrCode,
    }));

const technicianLabels: LabelItem[] = hospitalTechnicians.map((technician) => ({
  id: technician.id,
  code: technician.code,
  title: technician.name,
  subtitle: technician.specialty,
  payload: `ISIVOLT:TECH:${technician.code}`,
}));

const buildPrintDocument = (items: LabelItem[], title: string) => {
  const cards = items.map((item) => renderToStaticMarkup(
    <article className="label-card">
      <div className="label-qr"><QRCodeSVG value={item.payload} size={124} level="M" marginSize={1} /></div>
      <div className="label-copy">
        <span>ISIVOLT</span>
        <strong>{item.title}</strong>
        <small>{item.subtitle}</small>
        <b>{item.code}</b>
      </div>
    </article>,
  )).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #071525; background: white; font-family: Arial, Helvetica, sans-serif; }
    h1 { margin: 0 0 4mm; font-size: 15pt; }
    .sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5mm; }
    .label-card { display: grid; grid-template-columns: 36mm minmax(0, 1fr); align-items: center; gap: 5mm; min-height: 43mm; padding: 4mm; border: .35mm solid #b7c8d7; border-radius: 4mm; break-inside: avoid; page-break-inside: avoid; }
    .label-qr { display: grid; place-items: center; }
    .label-qr svg { width: 34mm; height: 34mm; }
    .label-copy { min-width: 0; }
    .label-copy span { display: block; margin-bottom: 2mm; color: #087da1; font-size: 8pt; font-weight: 800; letter-spacing: .16em; }
    .label-copy strong { display: block; font-size: 12pt; line-height: 1.15; overflow-wrap: anywhere; }
    .label-copy small { display: block; margin-top: 2mm; color: #52677b; font-size: 9pt; overflow-wrap: anywhere; }
    .label-copy b { display: inline-block; margin-top: 3mm; padding: 1.5mm 3mm; border-radius: 2mm; color: white; background: #071d34; font-size: 9pt; letter-spacing: .08em; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <main class="sheet">${cards}</main>
</body>
</html>`;
};

const printInBrowser = (html: string) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) throw new Error('No se ha podido preparar la impresión.');
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  }, 250);
};

export default function QRCodeLabelCenter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LabelMode>('technicians');
  const [toolSnapshot, setToolSnapshot] = useState<Tool[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [printMessage, setPrintMessage] = useState('');

  const labels = useMemo(
    () => (mode === 'technicians' ? technicianLabels : buildToolLabels(toolSnapshot)),
    [mode, toolSnapshot],
  );

  const selectedLabels = useMemo(
    () => labels.filter((item) => selectedIds.has(item.id)),
    [labels, selectedIds],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(labels.map((item) => item.id)));
  }, [open, mode, labels]);

  const openCenter = () => {
    setToolSnapshot(loadAppData().tools);
    setPrintMessage('');
    setOpen(true);
  };

  const toggleLabel = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const printItems = async (items: LabelItem[]) => {
    if (items.length === 0 || printing) return;
    const title = `ISIVOLT · ${mode === 'technicians' ? 'Credenciales de técnicos' : 'Etiquetas de herramientas'}`;
    const html = buildPrintDocument(items, title);
    setPrinting(true);
    setPrintMessage('Preparando impresión…');

    try {
      if (Capacitor.isNativePlatform()) {
        const { Printer } = await import('@capgo/capacitor-printer');
        await Printer.printHtml({ name: title, html });
      } else {
        printInBrowser(html);
      }
      setPrintMessage(`${items.length} etiqueta${items.length === 1 ? '' : 's'} enviada${items.length === 1 ? '' : 's'} al sistema de impresión.`);
    } catch (cause) {
      setPrintMessage(cause instanceof Error ? cause.message : 'No se ha podido abrir el sistema de impresión.');
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
                  <p>Selecciona una, varias o todas las etiquetas y abre la impresión del sistema.</p>
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

                <div className="qr-selection-actions">
                  <button type="button" onClick={() => setSelectedIds(new Set(labels.map((item) => item.id)))}>
                    <CheckSquare size={17} /> Todas
                  </button>
                  <button type="button" onClick={() => setSelectedIds(new Set())}>
                    <Square size={17} /> Ninguna
                  </button>
                </div>

                <motion.button
                  className="qr-print-button"
                  onClick={() => printItems(selectedLabels)}
                  whileTap={{ scale: 0.95 }}
                  disabled={selectedLabels.length === 0 || printing}
                >
                  <Printer size={18} /> {printing ? 'Preparando…' : `Imprimir grupo (${selectedLabels.length})`}
                </motion.button>
              </div>

              {printMessage && <div className="qr-print-message no-print"><Check size={17} /> {printMessage}</div>}

              <div className="qr-print-heading print-only">
                <strong>ISIVOLT · {mode === 'technicians' ? 'Credenciales de técnicos' : 'Etiquetas de herramientas'}</strong>
                <span>{labels.length} códigos QR</span>
              </div>

              <div className="qr-label-sheet">
                {labels.map((item, index) => {
                  const selected = selectedIds.has(item.id);
                  return (
                    <motion.article
                      className={`qr-label-card ${selected ? 'selected' : ''}`}
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index, 14) * 0.018 }}
                    >
                      <button
                        type="button"
                        className="qr-label-select no-print"
                        onClick={() => toggleLabel(item.id)}
                        aria-label={`${selected ? 'Quitar' : 'Añadir'} ${item.title} de la selección`}
                      >
                        {selected ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                      <div className="qr-label-code">
                        <QRCodeSVG value={item.payload} size={98} level="M" marginSize={1} />
                      </div>
                      <div className="qr-label-copy">
                        <span>ISIVOLT</span>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                        <b>{item.code}</b>
                        <button type="button" className="qr-print-single no-print" onClick={() => printItems([item])} disabled={printing}>
                          <Printer size={15} /> Imprimir esta etiqueta
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
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
