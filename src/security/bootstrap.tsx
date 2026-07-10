import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SecurityController from './SecurityController';
import './security.css';

const mountSecurity = () => {
  if (document.getElementById('isivolt-security-root')) return;
  const root = document.createElement('div');
  root.id = 'isivolt-security-root';
  document.body.append(root);
  createRoot(root).render(
    <StrictMode>
      <SecurityController />
    </StrictMode>,
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSecurity, { once: true });
} else {
  mountSecurity();
}
