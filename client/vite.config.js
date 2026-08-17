import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      'Permissions-Policy': 'camera=*, microphone=*',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001', ws: true }
    }
  },
  build: {
    // Warn on chunks > 800 KB instead of the default 500 KB
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tensorflow') || id.includes('tfjs'))           return 'vendor-tf'
            if (id.includes('@mediapipe') || id.includes('mediapipe'))       return 'vendor-mediapipe'
            if (id.includes('face-api'))                                     return 'vendor-faceapi'
            if (id.includes('framer-motion') || id.includes('react-rnd') ||
                id.includes('lucide-react') || id.includes('zustand') ||
                id.includes('immer'))                                        return 'vendor-ui'
            if (id.includes('react-dom') || id.includes('react/'))          return 'vendor-react'
            if (id.includes('axios'))                                        return 'vendor-axios'
          }
        }
      }
    }
  }
})
