import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split heavy, page-specific libraries into their own cacheable chunks
    // instead of one large bundle — keeps the first paint (login screen) fast.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) return 'leaflet';
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) return 'vendor';
          }
        },
      },
    },
  },
})
