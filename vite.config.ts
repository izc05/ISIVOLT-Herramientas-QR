import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ISIVOLT-Herramientas-QR/',
  plugins: [react()],
  server: {
    host: true,
  },
});
