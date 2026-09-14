import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs keep the build deployable both at a user/org root and
  // under a repository path such as https://user.github.io/signal-earth/.
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
