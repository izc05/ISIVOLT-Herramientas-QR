import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminTools from './admin/AdminTools';
import CloudStatus from './cloud/CloudStatus';
import EcosystemSwitcher from './ecosystem/EcosystemSwitcher';
import OperationalCenter from './ecosystem/OperationalCenter';
import MobileFastScan from './mobile/MobileFastScan';
import PwaInstallPrompt from './pwa/PwaInstallPrompt';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import ScanLauncher from './scan/ScanLauncher';
import ScanSession, { SCAN_SESSION_EVENT } from './scan/ScanSession';
import MyMaterial from './technician/MyMaterial';
import './styles.css';
import './responsive.css';
import './print.css';
import './ecosystem/ecosystem.css';
import './ecosystem/ecosystem-responsive.css';
import './ecosystem/operational-center.css';
import './scan/scan.css';
import './mobile/mobile-fast-scan.css';
import './pwa/pwa.css';
import './admin/admin-tools.css';
import './admin/inventory-admin.css';
import './cloud/cloud.css';
import './technician/my-material.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el contenedor principal.');

createRoot(root).render(
  <StrictMode>
    <EcosystemSwitcher />
    <App />
    <OperationalCenter />
    <ScanLauncher />
    <ScanSession />
    <MobileFastScan />
    <AdminTools />
    <CloudStatus />
    <MyMaterial />
    <PwaInstallPrompt />
  </StrictMode>,
);

registerServiceWorker();

const shortcut = new URLSearchParams(window.location.search).get('action');
if (shortcut === 'scan') {
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(SCAN_SESSION_EVENT));
    window.history.replaceState({}, '', window.location.pathname);
  }, 250);
}
