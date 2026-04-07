import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild',
  },
  server: {
    // Dev: browser calls same-origin /api/*; Vite forwards to the Express API.
    // Matches .env.production VITE_API_URL=/api and avoids cross-port localhost issues.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      // Super Admin API (superAdminApiService) uses /super-admin/api — must reach Express, not the SPA.
      '/super-admin': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  //  base: '/react/template/', // 👈 This ensures correct asset loading path
})
