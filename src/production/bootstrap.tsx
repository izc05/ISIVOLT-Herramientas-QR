import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CommissioningCenter from './CommissioningCenter';
import './commissioning.css';

const mountCommissioning = () => {
  if (document.getElementById('isivolt-commissioning-root')) return;
  const root = document.createElement('div');
  root.id = 'isivolt-commissioning-root';
  document.body.append(root);
  createRoot(root).render(
    <StrictMode>
      <CommissioningCenter />
    </StrictMode>,
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountCommissioning, { once: true });
} else {
  mountCommissioning();
}
