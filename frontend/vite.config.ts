import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  // Absolute, not relative ('./') — the app is always served from the
  // Spring Boot backend's root ('/'). A relative base resolves asset
  // paths against the CURRENT url, so on a route forwarded to
  // index.html at, say, /pool/xyz, "./assets/x.js" resolves to
  // /pool/assets/x.js (404) instead of /assets/x.js, and the app
  // never loads — a blank page with no visible error.
  base: '/',
  build: {
    outDir: '../backend/src/main/resources/static',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/proxy': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
