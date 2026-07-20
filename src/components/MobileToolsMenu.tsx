import { useEffect, useState } from 'react';
import {
  Barcode,
  ClipboardCheck,
  FileSpreadsheet,
  Files,
  Hammer,
  History,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TestTube2,
  Volume2,
  X,
} from 'lucide-react';

const actions = [
  { label: 'Gestión', detail: 'Herramientas y técnicos', selector: '.management-launcher', Icon: SlidersHorizontal },
  { label: 'Tarjetas', detail: 'Código de barras personal', selector: '.technician-barcode-launcher', Icon: Barcode },
  { label: 'NFC', detail: 'Tarjetas y etiquetas NFC', selector: '.nfc-management-launcher', Icon: ScanLine },
  { label: 'Informes', detail: 'Excel y copias', selector: '.report-center-launcher', Icon: FileSpreadsheet },
  { label: 'Etiquetas QR', detail: 'Imprimir códigos', selector: '.qr-label-launcher', Icon: Tags },
  { label: 'Archivos', detail: 'Informe de gestión', selector: '.management-files-launcher', Icon: Files },
  { label: 'Mantenimiento', detail: 'Actuaciones técnicas', selector: '.maintenance-board-launcher', Icon: Hammer },
  { label: 'Rectificaciones', detail: 'Corregir movimientos', selector: '.rectification-launcher', Icon: History },
  { label: 'Sonido y vibración', detail: 'Respuesta de operaciones', selector: '.experience-settings-button', Icon: Volume2 },
  { label: 'Diagnóstico', detail: 'SQLite y errores locales', selector: '.stability-badge', Icon: ShieldCheck },
  { label: 'Pruebas', detail: 'Puesta en servicio', selector: '.commissioning-launcher', Icon: TestTube2 },
] as const;

export default function MobileToolsMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    const closeOnModal = (event: Event) => {
      if ((event as CustomEvent<boolean>).detail) setOpen(false);
    };
    window.addEventListener('isivolt:security-session', close);
    window.addEventListener('isivolt:modal-state', closeOnModal);
    return () => {
      window.removeEventListener('isivolt:security-session', close);
      window.removeEventListener('isivolt:modal-state', closeOnModal);
    };
  }, []);

  const launch = (selector: string) => {
    setOpen(false);
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(selector);
      target?.click();
    }, 30);
  };

  return (
    <div className={`mobile-tools-menu ${open ? 'open' : ''}`}>
      {open && (
        <div className="mobile-tools-sheet" role="menu" aria-label="Herramientas de administración">
          <header><div><ClipboardCheck size={19} /><span><strong>Herramientas</strong><small>Accesos administrativos</small></span></div><button onClick={() => setOpen(false)} aria-label="Cerrar"><X size={19} /></button></header>
          <div>
            {actions.map(({ label, detail, selector, Icon }) => (
              <button type="button" role="menuitem" key={label} onClick={() => launch(selector)}>
                <span><Icon size={20} /></span>
                <span><strong>{label}</strong><small>{detail}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="mobile-tools-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Abrir herramientas">
        {open ? <X size={22} /> : <SlidersHorizontal size={22} />}
      </button>
    </div>
  );
}
