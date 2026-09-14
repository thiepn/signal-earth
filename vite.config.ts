import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs keep the build deployable both at a user/org root and
  // under a repository path such as https://user.github.io/signal-earth/.
  base: './',
  plugins: [react()],
  worker: {
    // satellite.js 7.x ships a WASM worker path that uses top-level await.
    // ES module workers support that syntax; Vite's default IIFE workers do not.
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
