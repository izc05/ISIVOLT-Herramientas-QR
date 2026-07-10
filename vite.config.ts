import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Las rutas relativas funcionan tanto dentro del WebView de Capacitor
  // como bajo el subdirectorio de GitHub Pages.
  base: './',
  plugins: [react()],
  server: {
    host: true,
  },
});
