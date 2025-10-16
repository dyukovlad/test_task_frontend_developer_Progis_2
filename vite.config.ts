import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/zulugis': {
        target: 'http://zs.zulugis.ru:6473',
        changeOrigin: true,
        headers: {
          Authorization: 'Basic ' + btoa('mo:mo'),
        },
      },
    },
  },
});
