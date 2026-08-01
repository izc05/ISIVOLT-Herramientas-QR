import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ScanLine } from 'lucide-react';
import { SCAN_SESSION_EVENT } from './ScanSession';

export default function ScanLauncher() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const resolveTarget = () => setTarget(document.querySelector('.topbar-actions'));
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <button
      className="scan-launcher"
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT))}
    >
      <ScanLine size={18} />
      <span>Operación QR/NFC</span>
    </button>,
    target,
  );
}
