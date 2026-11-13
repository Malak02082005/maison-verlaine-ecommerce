import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Port 5174 so it can run next to the Student Management System (5173).
// During development every /api/... request is forwarded to the backend on port 5001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:5001' },
  },
})
