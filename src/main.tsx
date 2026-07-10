import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './AppV2';
import './styles.css';
import './core.css';
import './game-ui.css';
import './vivid-theme.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se ha encontrado el contenedor principal de la aplicación.');
}

createRoot(root).render(
  <StrictMode>
    <AppV2 />
  </StrictMode>,
);