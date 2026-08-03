import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import packageJson from '../../package.json';

const VERSION = packageJson.version;

export default function ReleaseVersionBadge() {
  const [desktopTarget, setDesktopTarget] = useState<Element | null>(null);
  const [mobileTarget, setMobileTarget] = useState<Element | null>(null);

  useEffect(() => {
    document.documentElement.dataset.appVersion = VERSION;
    const resolve = () => {
      setDesktopTarget(document.querySelector('.topbar-actions'));
      setMobileTarget(document.querySelector('.mobile-utility-panel footer'));
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.appVersion;
    };
  }, []);

  return (
    <>
      {desktopTarget && createPortal(
        <span className="release-version-chip" title="Versión cargada desde GitHub Pages">v{VERSION}</span>,
        desktopTarget,
      )}
      {mobileTarget && createPortal(
        <span className="release-version-mobile">Versión cargada: <strong>{VERSION}</strong></span>,
        mobileTarget,
      )}
    </>
  );
}
