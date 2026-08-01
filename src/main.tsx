import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import EcosystemSwitcher from './ecosystem/EcosystemSwitcher';
import './styles.css';
import './responsive.css';
import './print.css';
import './ecosystem/ecosystem.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el contenedor principal.');

createRoot(root).render(
  <StrictMode>
    <EcosystemSwitcher />
    <App />
  </StrictMode>,
);
