import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: { target: ['chrome90', 'edge90', 'firefox90', 'safari15.4'], sourcemap: false },
});
