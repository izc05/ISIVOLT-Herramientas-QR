import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import EcosystemSwitcher from './ecosystem/EcosystemSwitcher';
import OperationalCenter from './ecosystem/OperationalCenter';
import ScanLauncher from './scan/ScanLauncher';
import ScanSession from './scan/ScanSession';
import './styles.css';
import './responsive.css';
import './print.css';
import './ecosystem/ecosystem.css';
import './ecosystem/ecosystem-responsive.css';
import './ecosystem/operational-center.css';
import './scan/scan.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el contenedor principal.');

createRoot(root).render(
  <StrictMode>
    <EcosystemSwitcher />
    <App />
    <OperationalCenter />
    <ScanLauncher />
    <ScanSession />
  </StrictMode>,
);
