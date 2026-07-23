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
import './web-barcode-scanner.css';
import './fast-scan-rc33.css';
import './central-sync.css';
import './central-sync-indicator-rc37.css';
import './central-sync-center.css';
import './report-center.css';
import './tool-experience.css';
import './tool-detail-mobile.css';
import './tool-detail-compat.css';
import './stability.css';
import './components/mobile-tools-menu.css';
import './features/history/movement-history.css';
import './features/history/movement-history-rc30.css';
import './features/history/presence-audit-rc40.css';
import './features/inventory/inventory-operational.css';
import './features/inventory/tool-scan-alert.css';
import './features/management/management.css';
import './features/management/management-files.css';
import './features/management/maintenance-board.css';
import './features/navigation/native-back.css';
import './features/navigation/mobile-finish-rc29.css';
import './features/operations/operation-flow.css';
import './features/operations/operation-review.css';
import './features/operations/operation-result-rc29.css';
import './features/personalization/greeting-settings.css';
import './features/technicians/technician-create.css';
import './features/technicians/technician-barcode.css';
import './features/technicians/technician-visual-rc29.css';
import './features/nfc/nfc-management.css';
import './features/station/station-presence.css';
import './security/security.css';
import './security/role-experience.css';
import './security/rectification.css';
import './production/commissioning.css';
import './boot.css';
import './mobile-optimization.css';
import './mobile-optimization-rc4.css';
import './rc6-mobile.css';
import './qr-print-rc6.css';
import './rc34-responsive-inventory.css';
import './professional-shell-rc35.css';
import './professional-more-rc35.css';
import './professional-tool-panel-rc35.css';
import './rc36-lifecycle.css';
import './rc36-edit-filters.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se ha encontrado el contenedor principal de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
