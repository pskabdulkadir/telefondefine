import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
    dedupe: ["react", "react-dom", "three"], // Three.js, React ve React-dom'un birden fazla örneğinin yüklenmesini engeller
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
});
