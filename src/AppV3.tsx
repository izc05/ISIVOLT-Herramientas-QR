import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BriefcaseBusiness,
  Check,
  Copy,
  Hash,
  Mail,
  Phone,
  Printer,
  UserRound,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import AppV2 from './AppV2';
import QRCodeLabelCenter from './components/QRCodeLabelCenter';
import ToolDetailSheet from './components/ToolDetailSheet';
import { hospitalTechnicians } from './data/technicians';
import type { Technician, Tool } from './domain/types';
import { loadAppData } from './services/storage';

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('es-ES');

const withPrintMode = (className: string) => {
  document.body.classList.add(className);
  const cleanup = () => document.body.classList.remove(className);
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1500);
};

export default function AppV3() {
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleCardClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const technicianCard = target.closest<HTMLElement>('.technician-card');
      if (technicianCard) {
        const name = technicianCard.querySelector('h3')?.textContent;
        if (!name) return;
        const technician = hospitalTechnicians.find(
          (item) => normalizeName(item.name) === normalizeName(name),
        );
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
        setSelectedTool(tool);
      }
    };

    document.addEventListener('click', handleCardClick);
    return () => document.removeEventListener('click', handleCardClick);
  }, []);

  useEffect(() => {
    if (!selectedTechnician && !selectedTool) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTechnician(null);
        setSelectedTool(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedTechnician, selectedTool]);

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
                  <p>Identifica al técnico antes de registrar una entrega.</p>
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

              <p className="technician-detail-note no-print">
                Los datos proceden del directorio aportado. Conviene revisar en el Excel los correos o teléfonos incompletos o repetidos.
              </p>
            </motion.section>
          </motion.div>
        )}

        {selectedTool && <ToolDetailSheet tool={selectedTool} onClose={() => setSelectedTool(null)} />}
      </AnimatePresence>
    </>
  );
}
