import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev proxy target: VITE_PROXY_TARGET wins; else read PORT from server/.env so Vite stays in sync
 * when the API uses a non-default port (avoids proxy ECONNREFUSED → browser HTTP 500 on /api and /super-admin/api).
 */
function resolveApiProxyTarget(mode: string, cwd: string): string {
  const env = loadEnv(mode, cwd, '')
  const explicit = (env.VITE_PROXY_TARGET || '').trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const serverEnvCandidates = [
    path.resolve(cwd, '../server/.env'),
    path.resolve(cwd, 'server/.env'),
  ]
  for (const serverEnvPath of serverEnvCandidates) {
    try {
      const raw = fs.readFileSync(serverEnvPath, 'utf8')
      const portLine = raw.split(/\r?\n/).find((line) => /^PORT\s*=/i.test(line.trim()))
      if (portLine) {
        const port = parseInt(String(portLine.split('=')[1] || '').trim(), 10)
        if (Number.isFinite(port) && port > 0 && port < 65536) {
          return `http://127.0.0.1:${port}`
        }
      }
      break
    } catch {
      /* try next candidate */
    }
  }
  return 'http://127.0.0.1:5001'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const cwd = process.cwd()
  const proxyTarget = resolveApiProxyTarget(mode, cwd)

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
