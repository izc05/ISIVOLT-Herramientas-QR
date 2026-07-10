import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV4 from './AppV4';
import { hydrateAppDataFromNative } from './services/storage';
import './styles.css';
import './core.css';
import './game-ui.css';
import './vivid-theme.css';
import './technician-detail.css';
import './qr-print.css';
import './native-scanner.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se ha encontrado el contenedor principal de la aplicación.');
}

const bootstrap = async () => {
  await hydrateAppDataFromNative();
  createRoot(root).render(
    <StrictMode>
      <AppV4 />
    </StrictMode>,
  );
};

void bootstrap();
