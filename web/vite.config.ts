import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/traces': 'http://localhost:3000',
      '/events': 'http://localhost:3000',
    },
  },
})
