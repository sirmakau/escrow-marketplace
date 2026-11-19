import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Client dev server on :5173, proxying API and health checks to the Express
 * server on :3000. `npm run build` writes the bundle to client/dist, which the
 * server serves when it exists.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
