import { useEffect, useState } from 'react';
import { QrCode, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { loadData, WORKSPACE_DATA_EVENT } from '../storage';
import type { AppData } from '../types';
import QRPrintDesigner from './QRPrintDesigner';

export default function QRPrintLauncher() {
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AppData>(() => loadData());
  const [message, setMessage] = useState('');

  useEffect(() => {
    const resolve = () => setTarget(document.querySelector('.admin-tools-panel nav'));
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleData = (event: Event) => setData((event as CustomEvent<AppData>).detail ?? loadData());
    window.addEventListener(WORKSPACE_DATA_EVENT, handleData);
    return () => window.removeEventListener(WORKSPACE_DATA_EVENT, handleData);
  }, []);

  const launcher = target ? createPortal(
    <button className="qr-print-nav-launcher" type="button" onClick={() => { setData(loadData()); setMessage(''); setOpen(true); }}>
      <QrCode size={18} /> Etiquetas QR
    </button>,
    target,
  ) : null;

  return (
    <>
      {launcher}
      {open && createPortal(
        <div className="qr-print-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="qr-print-modal" role="dialog" aria-modal="true" aria-label="Diseñador de etiquetas QR">
            <header className="qr-print-modal-header">
              <div><small>ISIVOLTPRO HERRAMIENTAS</small><h2>Diseñador de etiquetas QR</h2><p>Herramientas, material y credenciales de técnicos.</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>
            <main><QRPrintDesigner data={data} onMessage={setMessage} />{message && <p className="qr-print-message" role="status">{message}</p>}</main>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
