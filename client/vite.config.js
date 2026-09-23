import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || '/api'
  if (command === 'build' && apiUrl !== '/api') {
    let url
    try { url = new URL(apiUrl) } catch { throw new Error('VITE_API_URL must be /api or an HTTPS API URL.') }
    if (url.protocol !== 'https:' || /^(localhost|127\.|\[?::1\]?)/i.test(url.hostname) || url.username || url.password) {
      throw new Error('Production VITE_API_URL must use a public HTTPS API, not localhost.')
    }
  }
  const proxy = { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:5000', changeOrigin: true } }
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})
