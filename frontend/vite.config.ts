import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '..', '');
  const backendUrl = environment.APP_URL || 'http://127.0.0.1:8010';

  return {
    base: '/assets/app/',
    envDir: '..',
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
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
  };
});
