import { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AnimatePresence, motion } from 'motion/react';
import { CheckSquare, Printer, QrCode, Square, Tags, Users, Wrench, X } from 'lucide-react';
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

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const printableDocument = (title: string, cards: string[]) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#071526;background:#fff}
h1{font-size:18px;margin:0 0 12px}.sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8mm}
.qr-label-card{display:grid;grid-template-columns:112px minmax(0,1fr);align-items:center;gap:14px;min-height:138px;padding:14px;border:1px solid #b8c9d5;border-radius:14px;break-inside:avoid;background:#fff}
.qr-label-code svg{display:block;width:108px;height:108px}.qr-label-copy{display:grid;gap:6px}.qr-label-copy span{color:#087aa1;font-size:12px;font-weight:800;letter-spacing:.12em}.qr-label-copy strong{font-size:18px;line-height:1.15}.qr-label-copy small{color:#526574;font-size:13px}.qr-label-copy b{justify-self:start;padding:6px 10px;border-radius:8px;color:#fff;background:#071f38;letter-spacing:.08em}
.qr-label-card-select,.qr-label-card-actions{display:none!important}@media(max-width:650px){.sheet{grid-template-columns:1fr}}
</style></head><body><h1>${escapeHtml(title)}</h1><main class="sheet">${cards.join('')}</main></body></html>`;

export default function QRCodeLabelCenter() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LabelMode>('technicians');
  const [toolSnapshot, setToolSnapshot] = useState<Tool[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printStatus, setPrintStatus] = useState('');
  const [printing, setPrinting] = useState(false);

  const labels = useMemo(
    () => (mode === 'technicians' ? technicianLabels : buildToolLabels(toolSnapshot)),
    [mode, toolSnapshot],
  );

  const openCenter = () => {
    setToolSnapshot(loadAppData().tools);
    setSelectedIds([]);
    setPrintStatus('');
    setOpen(true);
  };

  const changeMode = (nextMode: LabelMode) => {
    setMode(nextMode);
    setSelectedIds([]);
    setPrintStatus('');
  };

  const toggleLabel = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const collectCards = (ids: string[]) => ids
    .map((id) => document.querySelector<HTMLElement>(`.qr-label-card[data-label-id="${CSS.escape(id)}"]`))
    .filter((card): card is HTMLElement => Boolean(card))
    .map((card) => {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.qr-label-card-select,.qr-label-card-actions').forEach((node) => node.remove());
      return clone.outerHTML;
    });

  const printLabels = async (requestedIds?: string[]) => {
    const ids = requestedIds?.length ? requestedIds : selectedIds.length ? selectedIds : labels.map((item) => item.id);
    if (!ids.length || printing) return;
    setPrinting(true);
    setPrintStatus('Preparando etiquetas…');

    try {
      const title = `ISIVOLT · ${mode === 'technicians' ? 'Técnicos' : 'Herramientas'} · ${ids.length} etiqueta${ids.length === 1 ? '' : 's'}`;
      const cards = collectCards(ids);
      if (!cards.length) throw new Error('No se han podido preparar las etiquetas seleccionadas.');

      if (Capacitor.isNativePlatform()) {
        const fileName = `ISIVOLT-etiquetas-${mode}-${Date.now()}.html`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: printableDocument(title, cards),
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({
          title,
          text: 'Abre este archivo con el navegador o una aplicación de impresión para imprimir las etiquetas QR.',
          files: [result.uri],
          dialogTitle: 'Imprimir o compartir etiquetas QR',
        });
        setPrintStatus(`${ids.length} etiqueta${ids.length === 1 ? '' : 's'} preparada${ids.length === 1 ? '' : 's'}.`);
      } else {
        const hidden: HTMLElement[] = [];
        document.querySelectorAll<HTMLElement>('.qr-label-card').forEach((card) => {
          if (!ids.includes(card.dataset.labelId ?? '')) {
            card.style.display = 'none';
            hidden.push(card);
          }
        });
        document.body.classList.add('printing-qr-labels');
        const cleanup = () => {
          document.body.classList.remove('printing-qr-labels');
          hidden.forEach((card) => card.style.removeProperty('display'));
        };
        window.addEventListener('afterprint', cleanup, { once: true });
        window.print();
        window.setTimeout(cleanup, 1800);
        setPrintStatus(`${ids.length} etiqueta${ids.length === 1 ? '' : 's'} enviada${ids.length === 1 ? '' : 's'} a impresión.`);
      }
    } catch (cause) {
      setPrintStatus(cause instanceof Error ? cause.message : 'No se ha podido abrir la impresión.');
    } finally {
      setPrinting(false);
    }
  };

  const allSelected = labels.length > 0 && selectedIds.length === labels.length;

  return (
    <>
      <motion.button className="qr-label-launcher" onClick={openCenter} whileHover={{ y: -4, scale: 1.04 }} whileTap={{ scale: 0.92 }} aria-label="Abrir centro de etiquetas QR">
        <motion.span animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.08, 1] }} transition={{ duration: 2.8, repeat: Infinity }}><Tags size={22} /></motion.span>
        <strong>Etiquetas QR</strong>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="qr-label-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.section className="qr-label-center" initial={{ opacity: 0, y: 42, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }} transition={{ type: 'spring', stiffness: 260, damping: 25 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Centro de etiquetas QR">
              <header className="qr-label-header no-print">
                <div><span className="qr-label-kicker"><QrCode size={15} /> Identificación física</span><h2>Centro de etiquetas QR</h2><p>Selecciona una, varias o todas las etiquetas y abre la impresión del móvil.</p></div>
                <button onClick={() => setOpen(false)} aria-label="Cerrar centro de etiquetas"><X size={21} /></button>
              </header>

              <div className="qr-label-toolbar no-print">
                <div className="qr-label-tabs">
                  <button className={mode === 'technicians' ? 'active' : ''} onClick={() => changeMode('technicians')}><Users size={17} /> Técnicos <span>{technicianLabels.length}</span></button>
                  <button className={mode === 'tools' ? 'active' : ''} onClick={() => changeMode('tools')}><Wrench size={17} /> Herramientas <span>{toolSnapshot.length}</span></button>
                </div>
                <div className="qr-label-selection-bar">
                  <span className="qr-print-status">{selectedIds.length ? `${selectedIds.length} seleccionada${selectedIds.length === 1 ? '' : 's'}` : printStatus || 'Sin selección: imprimirá todas'}</span>
                  <button type="button" onClick={() => setSelectedIds(allSelected ? [] : labels.map((item) => item.id))}>{allSelected ? <CheckSquare size={17} /> : <Square size={17} />} {allSelected ? 'Quitar todas' : 'Seleccionar todas'}</button>
                  <button className="qr-print-button" type="button" disabled={printing || labels.length === 0} onClick={() => printLabels()}><Printer size={18} /> {printing ? 'Preparando…' : selectedIds.length ? 'Imprimir selección' : 'Imprimir todas'}</button>
                </div>
              </div>

              <div className="qr-print-heading print-only"><strong>ISIVOLT · {mode === 'technicians' ? 'Credenciales de técnicos' : 'Etiquetas de herramientas'}</strong><span>{labels.length} códigos QR</span></div>

              <div className="qr-label-sheet">
                {labels.map((item, index) => (
                  <motion.article className="qr-label-card" data-label-id={item.id} key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 14) * 0.018 }}>
                    <input className="qr-label-card-select no-print" type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleLabel(item.id)} aria-label={`Seleccionar ${item.title}`} />
                    <div className="qr-label-code"><QRCodeSVG value={item.payload} size={98} level="M" marginSize={1} /></div>
                    <div className="qr-label-copy"><span>ISIVOLT</span><strong>{item.title}</strong><small>{item.subtitle}</small><b>{item.code}</b></div>
                    <div className="qr-label-card-actions no-print"><button type="button" onClick={() => printLabels([item.id])}><Printer size={14} /> Individual</button></div>
                  </motion.article>
                ))}
              </div>

              {labels.length === 0 && <div className="qr-label-empty"><Wrench size={34} /><strong>No hay herramientas registradas</strong><span>Da de alta una herramienta para generar su etiqueta.</span></div>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
