import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/ISIVOLT-Herramientas-QR/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
