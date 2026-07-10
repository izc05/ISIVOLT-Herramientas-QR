import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RectificationCenter from './RectificationCenter';
import './rectification.css';

const mountRectifications = () => {
  if (document.getElementById('isivolt-rectification-root')) return;
  const root = document.createElement('div');
  root.id = 'isivolt-rectification-root';
  document.body.append(root);
  createRoot(root).render(
    <StrictMode>
      <RectificationCenter />
    </StrictMode>,
  );
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountRectifications, { once: true });
} else {
  mountRectifications();
}
