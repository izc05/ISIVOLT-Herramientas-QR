import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BriefcaseBusiness, Check, Copy, Hash, Mail, Phone, QrCode, UserRound, X } from 'lucide-react';
import AppV2 from './AppV2';
import { hospitalTechnicians } from './data/technicians';
import type { Technician } from './domain/types';

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('es-ES');

export default function AppV3() {
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleTechnicianClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('.technician-card');
      if (!card) return;
      const name = card.querySelector('h3')?.textContent;
      if (!name) return;
      const technician = hospitalTechnicians.find(
        (item) => normalizeName(item.name) === normalizeName(name),
      );
      if (technician) setSelectedTechnician(technician);
    };

    document.addEventListener('click', handleTechnicianClick);
    return () => document.removeEventListener('click', handleTechnicianClick);
  }, []);

  useEffect(() => {
    if (!selectedTechnician) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedTechnician(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedTechnician]);

  const qrPayload = useMemo(
    () => selectedTechnician ? `ISIVOLT:TECH:${selectedTechnician.code}` : '',
    [selectedTechnician],
  );

  const copyQrPayload = async () => {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <AppV2 />
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
              className="technician-detail-modal"
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
              <button
                className="technician-detail-close"
                onClick={() => setSelectedTechnician(null)}
                aria-label="Cerrar ficha"
              >
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

              <div className="technician-qr-preview">
                <motion.div
                  className="technician-qr-icon"
                  animate={{ rotate: [0, 1.5, -1.5, 0], scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                >
                  <QrCode size={54} />
                </motion.div>
                <div>
                  <small>Identificador QR personal</small>
                  <strong>{qrPayload}</strong>
                  <p>Preparado para identificar al técnico antes de una entrega.</p>
                </div>
                <motion.button onClick={copyQrPayload} whileTap={{ scale: 0.92 }}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </motion.button>
              </div>

              <p className="technician-detail-note">
                Los datos proceden del directorio aportado. Conviene revisar en el Excel los correos o teléfonos que estuvieran incompletos o repetidos.
              </p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
