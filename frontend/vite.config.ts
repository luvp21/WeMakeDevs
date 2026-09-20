import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The dev server forwards /api to a backend. By default that is the local one
// (npm run dev:backend, port 4000). To work on the frontend without running a
// backend at all, point it at the live site instead, either on the command line
//   API_PROXY_TARGET=https://<the live site> npm run dev:frontend
// or once, in frontend/.env.local (git-ignored):
//   API_PROXY_TARGET=https://<the live site>
function proxyTarget(mode: string): string {
  const fromFile = loadEnv(mode, import.meta.dirname, '').API_PROXY_TARGET
  return process.env.API_PROXY_TARGET ?? fromFile ?? 'http://localhost:4000'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // changeOrigin so a hosted API (API Gateway) sees its own host name.
      '/api': { target: proxyTarget(mode), changeOrigin: true },
    },
  },
}))
