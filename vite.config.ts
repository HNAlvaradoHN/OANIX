import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor'
  const isVercel = process.env.VERCEL === '1'
  const configuredBase = process.env.OANIX_PUBLIC_BASE?.trim()
  const publicBase = configuredBase || (isCapacitor ? './' : isVercel ? '/' : '/OANIX/')
  const isPrimaryPagesScope = publicBase === '/OANIX/'

  return {
    base: publicBase,
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
          // The production worker must never capture the isolated preview PWA. The preview
          // worker itself gets its own /OANIX/preview/ scope and therefore keeps fallback enabled.
          navigateFallbackDenylist: isPrimaryPagesScope ? [/^\/OANIX\/preview(?:\/|$)/] : [],
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
          start_url: publicBase,
          scope: publicBase,
          icons: [
            {
              // User-selected OANIX PWA logo, stored as a real square raster asset.
              src: `${publicBase}oanix-logo.webp`,
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
