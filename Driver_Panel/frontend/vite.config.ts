import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";


export default defineConfig({
  base: '/',
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 3001,
    open: true,
    proxy: {
      
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      
      "/health": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      
      "/socket.io": {
        target: "http://localhost:5001",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2015",
    outDir: "dist",
    assetsDir: "assets",
  },
});
