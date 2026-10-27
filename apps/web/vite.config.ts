import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react()],
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },

  },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  build: { outDir: '../../dist/web', emptyOutDir: true, target: 'es2022' },
  optimizeDeps: { exclude: ['@mujoco/mujoco'] }
});
