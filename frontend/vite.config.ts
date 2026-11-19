import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/assets/app/',
    server: {
      port: 5173,
      host: '127.0.0.1',
    },
    plugins: [react()],
    build: {
      outDir: '../public/assets/app',
      emptyOutDir: true,
      manifest: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});
