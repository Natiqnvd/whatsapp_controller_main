// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const BACKEND_PORT = 5690 ; // Change this to your backend port
const FRONTEND_PORT = 3434; // Change this to your frontend port

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader(
            'Content-Security-Policy',
            `default-src 'self'; ` +
            `script-src 'self' 'unsafe-inline' 'unsafe-eval'; ` +
            `style-src 'self' 'unsafe-inline'; ` +
            `connect-src 'self' http://localhost:${BACKEND_PORT} http://127.0.0.1:${BACKEND_PORT} ws://localhost:${FRONTEND_PORT}; ` +
            `img-src 'self' blob: data: http://localhost:${BACKEND_PORT} http://127.0.0.1:${BACKEND_PORT}; ` +
            `media-src 'self' blob: data: http://localhost:${BACKEND_PORT} http://127.0.0.1:${BACKEND_PORT};`
          );
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: FRONTEND_PORT,
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      },
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'icons': ['lucide-react']
        }
      }
    }
  },
  base: './'
});
