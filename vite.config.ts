import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor'
  const isVercel = Boolean(process.env.VERCEL)
  const webBase = isVercel ? '/' : '/OANIX/'
  const base = isCapacitor ? './' : webBase
  const webRoot = isVercel ? '/' : '/OANIX/'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['oanix-icon.svg', 'oanix-logo.webp'],
        workbox: {
          // Keep the complete executable app shell local after the first successful load.
          // `wasm` is included explicitly so cryptographic/runtime dependencies remain offline-safe
          // if Vite emits one as a separate asset in a future build.
          globPatterns: ['**/*.{js,css,html,wasm}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [
            isVercel ? /^\/preview(?:\/|$)/ : /^\/OANIX\/preview(?:\/|$)/,
          ],
          cleanupOutdatedCaches: true,
          // Activate the newly installed shell immediately so an older controller cannot
          // keep serving HTML that references asset hashes removed by a later Pages deploy.
          // The application still decides when to reload; clientsClaim/skipWaiting only
          // replace the controller and never reload an editing session by themselves.
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: 'OANIX',
          short_name: 'OANIX',
          description: 'Notas privadas, seguras y disponibles sin conexión.',
          theme_color: '#111827',
          background_color: '#f7f7f5',
          display: 'standalone',
          start_url: webRoot,
          scope: webRoot,
          icons: [
            {
              // User-selected OANIX PWA logo, stored as a real square raster asset.
              src: `${webRoot}oanix-logo.webp`,
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'any'
            }
          ]
        }
      })
    ]
  }
})
