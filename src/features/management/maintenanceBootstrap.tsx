import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MaintenanceBoard from './MaintenanceBoard';
import './maintenance-board.css';

const mountMaintenanceBoard = () => {
  if (document.getElementById('isivolt-maintenance-board-root')) return;
  const root = document.createElement('div');
  root.id = 'isivolt-maintenance-board-root';
  document.body.append(root);
  createRoot(root).render(
    <StrictMode>
      <MaintenanceBoard onSaved={() => window.dispatchEvent(new CustomEvent('isivolt:management-refresh'))} />
    </StrictMode>,
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountMaintenanceBoard, { once: true });
} else {
  mountMaintenanceBoard();
}
