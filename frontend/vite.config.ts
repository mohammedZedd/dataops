import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // nécessaire pour être accessible hors du container
    port: 5173,
    watch: {
      usePolling: true, // hot reload fiable dans Docker (filesystem events non propagés)
    },
  },
})
