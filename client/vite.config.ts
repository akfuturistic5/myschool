import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  // Keep dev proxy aligned with server default port to avoid auth/login connection failures.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:5001';

  return {
    plugins: [react()],
    build: {
      minify: 'esbuild',
    },
    server: {
      // Dev: browser calls same-origin /api/*; Vite forwards to the Express API.
      // Matches .env.production VITE_API_URL=/api and avoids cross-port localhost issues.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        // Only /super-admin/api goes to Express. /super-admin/login etc. are React Router (SPA).
        '/super-admin/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    //  base: '/react/template/', // 👈 This ensures correct asset loading path
  };
})
