import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      // socket.io 也走同源，由 dev 代理转发到后端（含 websocket 升级）
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
