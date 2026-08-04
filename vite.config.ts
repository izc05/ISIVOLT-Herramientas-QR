import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeBase = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    base: normalizeBase(env.VITE_BASE_PATH || '/ISIVOLT-Herramientas-QR/'),
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
