import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Security-sensitive logging (auth token claims, review submission
// payloads) is gated in source via `if (import.meta.env.DEV)` so it is
// dead-code-eliminated from production bundles. We deliberately do NOT
// configure a build-wide `esbuild.drop` here because Vite 8's rolldown
// backend doesn't ship an esbuild peer; chasing that integration is not
// worth the build complexity for the few remaining benign console.error
// calls in catch blocks.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
