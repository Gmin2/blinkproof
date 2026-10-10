import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:5200', rewrite: (p) => p.replace(/^\/api/, '') },
      '/agent': { target: 'http://127.0.0.1:5201', rewrite: (p) => p.replace(/^\/agent/, '') },
    },
  },
})
