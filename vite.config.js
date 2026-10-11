import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    host: true
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'jszip']
  }
});
