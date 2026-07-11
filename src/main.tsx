import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from './AppRoot';
import './styles.css';
import './core.css';
import './game-ui.css';
import './vivid-theme.css';
import './technician-detail.css';
import './qr-print.css';
import './native-scanner.css';
import './report-center.css';
import './tool-experience.css';
import './tool-detail-mobile.css';
import './tool-detail-compat.css';
import './stability.css';
import './components/mobile-tools-menu.css';
import './features/management/management.css';
import './features/management/management-files.css';
import './features/management/maintenance-board.css';
import './features/technicians/technician-create.css';
import './security/security.css';
import './security/rectification.css';
import './production/commissioning.css';
import './boot.css';
import './mobile-optimization.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se ha encontrado el contenedor principal de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
