import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the React test console in `client/`.
 *
 * `npm run dev:client` serves the client on :5173 and proxies API and health
 * checks to the Express server on :3000. `npm run build:client` writes the
 * production bundle to `client/dist`, which the Express app serves when it
 * exists.
 */
export default defineConfig({
  root: 'client',
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
