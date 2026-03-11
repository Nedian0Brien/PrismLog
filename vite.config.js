import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-chartjs-2') || id.includes('chart.js')) return 'charts-vendor'
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
        }
      }
    }
  }
})
