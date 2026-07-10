import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  Check,
  Clock3,
  Copy,
  Download,
  Expand,
  Hash,
  History,
  MapPin,
  PackageCheck,
  Printer,
  QrCode,
  Share2,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { AppData, Movement, Tool, ToolStatus } from '../domain/types';
import { loadAppData } from '../services/storage';

const statusLabels: Record<ToolStatus, string> = {
  available: 'Disponible',
  loaned: 'Prestada',
  review: 'En revisión',
  damaged: 'Averiada',
  retired: 'Baja',
};

const movementLabels: Record<Movement['type'], string> = {
  delivery: 'Salida de almacén',
  return: 'Entrada en almacén',
  incident: 'Entrada con incidencia',
  adjustment: 'Ajuste de inventario',
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Sin registrar';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const formatDuration = (value?: string) => {
  if (!value) return '—';
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const days = Math.floor(elapsed / 86_400_000);
  if (days > 0) return `${days} día${days === 1 ? '' : 's'}`;
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours > 0) return `${hours} h`;
  const minutes = Math.max(1, Math.floor(elapsed / 60_000));
  return `${minutes} min`;
};

const safeFilename = (value: string) => value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('No se ha podido preparar la imagen QR.'));
  reader.onloadend = () => {
    const result = String(reader.result ?? '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.readAsDataURL(blob);
});

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

const svgToPng = async (svg: SVGSVGElement, tool: Tool): Promise<Blob> => {
  const markup = new XMLSerializer().serializeToString(svg);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.src = source;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1450;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El dispositivo no puede generar la imagen QR.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#07111f';
  context.textAlign = 'center';
  context.font = '700 68px system-ui, sans-serif';
  context.fillText('ISIVOLT HERRAMIENTAS QR', 600, 105);
  context.drawImage(image, 135, 165, 930, 930);
  context.font = '800 76px system-ui, sans-serif';
  context.fillText(tool.code, 600, 1195);
  context.font = '600 48px system-ui, sans-serif';
  context.fillText(tool.name.slice(0, 34), 600, 1275);
  context.font = '400 34px system-ui, sans-serif';
  context.fillStyle = '#445269';
  context.fillText(tool.category, 600, 1340);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se ha podido crear el PNG.')), 'image/png', 0.96);
  });
};

const movementIcon = (movement: Movement) => {
  if (movement.type === 'delivery') return ArrowUpFromLine;
  if (movement.type === 'return') return ArrowDownToLine;
  if (movement.type === 'incident') return AlertTriangle;
  return History;
};

type ToolDetailSheetProps = {
  tool: Tool;
  onClose: () => void;
};

export default function ToolDetailSheet({ tool, onClose }: ToolDetailSheetProps) {
  const [revision, setRevision] = useState(0);
  const [currentTool, setCurrentTool] = useState(tool);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [notice, setNotice] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const data = (event as CustomEvent<AppData>).detail ?? loadAppData();
      const updated = data.tools.find((item) => item.id === currentTool.id);
      if (updated) setCurrentTool(updated);
      setRevision((value) => value + 1);
    };
    window.addEventListener('isivolt:data-updated', handleUpdate);
    return () => window.removeEventListener('isivolt:data-updated', handleUpdate);
  }, [currentTool.id]);

  const data = useMemo(() => loadAppData(), [revision, currentTool.updatedAt]);
  const holder = data.technicians.find((item) => item.id === currentTool.holderTechnicianId);
  const movements = useMemo(
    () => data.movements
      .filter((movement) => movement.toolId === currentTool.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [data.movements, currentTool.id],
  );

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(currentTool.qrCode);
      setCopied(true);
      showNotice('Código QR copiado');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showNotice('No se pudo copiar el código');
    }
  };

  const createPng = async () => {
    const svg = qrContainerRef.current?.querySelector('svg');
    if (!svg) throw new Error('No se ha encontrado el QR del artículo.');
    return svgToPng(svg, currentTool);
  };

  const shareQr = async () => {
    setBusy('share');
    try {
      const blob = await createPng();
      const filename = `QR_${safeFilename(currentTool.code)}.png`;
      if (Capacitor.isNativePlatform()) {
        const base64 = await blobToBase64(blob);
        const result = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({
          title: `QR de ${currentTool.name}`,
          text: `${currentTool.code} · ${currentTool.name}`,
          files: [result.uri],
          dialogTitle: 'Compartir o guardar QR',
        });
      } else {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ title: `QR de ${currentTool.name}`, text: currentTool.code, files: [file] });
        } else {
          downloadBlob(filename, blob);
        }
      }
      showNotice('QR preparado para compartir');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'No se pudo compartir el QR');
    } finally {
      setBusy(null);
    }
  };

  const saveQr = async () => {
    setBusy('save');
    try {
      const blob = await createPng();
      const filename = `QR_${safeFilename(currentTool.code)}.png`;
      if (Capacitor.isNativePlatform()) {
        const base64 = await blobToBase64(blob);
        const result = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({
          title: 'Guardar etiqueta QR',
          text: 'Selecciona Archivos, Drive o la aplicación donde quieras conservar la etiqueta.',
          files: [result.uri],
          dialogTitle: 'Guardar etiqueta QR',
        });
      } else {
        downloadBlob(filename, blob);
      }
      showNotice('Imagen QR generada');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'No se pudo guardar el QR');
    } finally {
      setBusy(null);
    }
  };

  const printLabel = () => {
    document.body.classList.add('printing-single-qr');
    const cleanup = () => document.body.classList.remove('printing-single-qr');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  const startQrOperation = () => {
    onClose();
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('.nav-scan-button, .scan-main-button')?.click();
    }, 120);
  };

  return (
    <motion.div
      className="tool-sheet-backdrop technician-detail-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="tool-sheet tool-qr-modal printable-single-qr"
        initial={{ opacity: 0, y: 70, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 290, damping: 28 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${currentTool.name}`}
      >
        <span className="tool-sheet-glow" aria-hidden="true" />
        <button className="tool-sheet-close no-print" onClick={onClose} aria-label="Cerrar ficha"><X size={22} /></button>

        <div className="tool-sheet-scroll">
          <header className="tool-sheet-hero technician-detail-header">
            <div className="tool-sheet-image">
              {currentTool.imageDataUrl
                ? <img src={currentTool.imageDataUrl} alt={`Imagen de ${currentTool.name}`} />
                : <div><Wrench size={54} /><span>{currentTool.category}</span></div>}
              <button
                className="tool-sheet-photo-action no-print"
                data-tool-photo-action="open"
                data-tool-code={currentTool.code}
              >
                <Camera size={18} /> {currentTool.imageDataUrl ? 'Cambiar foto' : 'Añadir foto'}
              </button>
            </div>
            <div className="tool-sheet-title">
              <span className={`tool-status-chip status-${currentTool.status}`}><PackageCheck size={15} /> {statusLabels[currentTool.status]}</span>
              <h2>{currentTool.name}</h2>
              <p>{currentTool.code} · {currentTool.category}</p>
              {holder && <strong className="tool-holder-line"><UserRound size={17} /> {holder.name}</strong>}
            </div>
          </header>

          <div className="technician-detail-grid tool-sheet-facts">
            <article><MapPin size={19} /><span><small>Ubicación base</small><strong>{currentTool.location}</strong></span></article>
            <article><Wrench size={19} /><span><small>Marca y modelo</small><strong>{currentTool.brand ?? 'Sin marca'} {currentTool.model ?? ''}</strong></span></article>
            <article><Hash size={19} /><span><small>Número de serie</small><strong>{currentTool.serialNumber ?? 'No registrado'}</strong></span></article>
            <article><Clock3 size={19} /><span><small>{currentTool.status === 'loaned' ? 'Tiempo fuera' : 'Última actualización'}</small><strong>{currentTool.status === 'loaned' ? formatDuration(currentTool.loanedAt) : formatDateTime(currentTool.updatedAt)}</strong></span></article>
          </div>

          <section className="tool-qr-card">
            <div className="tool-qr-card-heading">
              <span><QrCode size={18} /> Identificación oficial</span>
              <small>Toca el QR para ampliarlo</small>
            </div>
            <motion.button className="tool-qr-touch" onClick={() => setQrExpanded(true)} whileTap={{ scale: 0.97 }}>
              <div ref={qrContainerRef} className="tool-qr-canvas">
                <QRCodeSVG value={currentTool.qrCode} size={236} level="M" marginSize={2} />
              </div>
              <span className="tool-qr-expand"><Expand size={17} /> Ampliar</span>
            </motion.button>
            <code>{currentTool.qrCode}</code>

            <div className="tool-qr-actions no-print">
              <button onClick={() => void copyPayload()}>{copied ? <Check size={19} /> : <Copy size={19} />}<span>{copied ? 'Copiado' : 'Copiar'}</span></button>
              <button onClick={() => void shareQr()} disabled={Boolean(busy)}><Share2 size={19} /><span>{busy === 'share' ? 'Preparando…' : 'Compartir'}</span></button>
              <button onClick={() => void saveQr()} disabled={Boolean(busy)}><Download size={19} /><span>{busy === 'save' ? 'Generando…' : 'Guardar PNG'}</span></button>
              <button onClick={printLabel}><Printer size={19} /><span>Imprimir</span></button>
            </div>
          </section>

          <section className="tool-history-section">
            <header><span><History size={19} /> Historial del artículo</span><strong>{movements.length} movimiento{movements.length === 1 ? '' : 's'}</strong></header>
            {movements.length === 0 ? (
              <div className="tool-history-empty"><History size={28} /><span>Todavía no hay movimientos registrados.</span></div>
            ) : (
              <div className="tool-history-timeline">
                {movements.slice(0, 16).map((movement) => {
                  const Icon = movementIcon(movement);
                  const technician = data.technicians.find((item) => item.id === movement.technicianId);
                  return (
                    <article key={movement.id} className={`movement-${movement.type}`}>
                      <span className="tool-history-icon"><Icon size={18} /></span>
                      <div>
                        <strong>{movementLabels[movement.type]}</strong>
                        <small>{formatDateTime(movement.occurredAt)}</small>
                        <p>{technician?.name ?? 'Almacén'} · {statusLabels[movement.nextStatus]}</p>
                        {movement.notes && <em>{movement.notes}</em>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <footer className="tool-sheet-footer no-print">
          <button
            data-tool-photo-action="open"
            data-tool-code={currentTool.code}
          ><Camera size={20} /><span>Foto</span></button>
          <motion.button className="primary" onClick={startQrOperation} whileTap={{ scale: 0.97 }}>
            <QrCode size={21} /><span>Operar con QR</span>
          </motion.button>
        </footer>

        <AnimatePresence>
          {notice && <motion.div className="tool-sheet-notice no-print" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>{notice}</motion.div>}
          {qrExpanded && (
            <motion.div className="tool-qr-focus no-print" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQrExpanded(false)}>
              <motion.div initial={{ scale: 0.75, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.86 }} onClick={(event) => event.stopPropagation()}>
                <button onClick={() => setQrExpanded(false)} aria-label="Cerrar QR ampliado"><X size={22} /></button>
                <QRCodeSVG value={currentTool.qrCode} size={310} level="H" marginSize={3} />
                <strong>{currentTool.code}</strong>
                <span>{currentTool.name}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
