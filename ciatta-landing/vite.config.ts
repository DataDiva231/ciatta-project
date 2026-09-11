import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// One entry per page, not a router. Each is its own HTML document, so it answers
// 200 on its own rather than through a catch-all rewrite, and a path that
// really is missing still answers 404.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        briefs: resolve(__dirname, 'briefs/index.html'),
        member: resolve(__dirname, 'member/index.html'),
      },
    },
  },
});
