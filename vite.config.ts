import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/*.sqlite*', '**/*.db*', ...(process.env.DATABASE_PATH ? [resolve(process.env.DATABASE_PATH), `${resolve(process.env.DATABASE_PATH)}-*`] : [])],
    },
  },
});
