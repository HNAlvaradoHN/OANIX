import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/OANIX/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['oanix-icon.svg'],
      manifest: {
        name: 'OANIX',
        short_name: 'OANIX',
        description: 'Notas privadas, seguras y disponibles sin conexión.',
        theme_color: '#111827',
        background_color: '#f7f7f5',
        display: 'standalone',
        start_url: '/OANIX/',
        scope: '/OANIX/',
        icons: [
          {
            src: '/OANIX/oanix-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
