import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV3 from './AppV3';
import './styles.css';
import './core.css';
import './game-ui.css';
import './vivid-theme.css';
import './technician-detail.css';
import './qr-print.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se ha encontrado el contenedor principal de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <AppV3 />
  </StrictMode>,
);
