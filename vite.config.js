import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
    host: true
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'jszip']
  }
});
