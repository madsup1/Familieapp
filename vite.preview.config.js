import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const mock = path.resolve(__dirname, 'preview/mockSupabase.js');

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_PREVIEW': JSON.stringify('1') },
  plugins: [
    react(),
    {
      name: 'mock-supabase',
      enforce: 'pre',
      resolveId(source) {
        if (source === './supabase.js') return mock;
        return null;
      },
    },
  ],
  build: {
    outDir: 'preview-dist',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'preview.html') },
  },
});
