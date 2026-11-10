import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The preview proxy serves the app from https://<port>-<sandbox>.e2b.app
    allowedHosts: true,
    cors: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  worker: { format: 'es' },
});
