import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '.preview-build',
    emptyOutDir: true,
    lib: { entry: resolve('src/main.tsx'), name: 'VdvoemPreview', formats: ['iife'], fileName: () => 'preview.js' },
    cssCodeSplit: false,
    minify: true,
  },
});
