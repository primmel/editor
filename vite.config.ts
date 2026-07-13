import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@primmel/primmel': fileURLToPath(new URL('./node_modules/@primmel/primmel/dist/index.js', import.meta.url)),
    },
  },
});
