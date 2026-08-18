import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ThemeMenu } from './features/personalization/ThemeMenu'
import { applyOanixTheme, readSavedOanixTheme } from './features/personalization/themeCatalog'
import './styles/global.css'
import './styles/redesign.css'
import './styles/redesign-polish.css'
import './styles/themes.css'
import './styles/base-themes.css'
import './styles/notebook-polish.css'

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

const oanixWindow = window as OanixUpdateWindow

// Theme is a non-sensitive local UI preference. Apply it before React paints to avoid a flash
// of the default palette when the user already selected another preset on this device.
applyOanixTheme(readSavedOanixTheme(), false)

if (import.meta.env.MODE !== 'capacitor') {
  // Keep the existing prompt-based update strategy on the PWA: a new service worker is discovered
  // in the background, but OANIX only reloads after the user explicitly chooses to update.
  // The native Capacitor bundle is already installed locally, so it must not register the PWA SW.
  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      oanixWindow.__oanixApplyUpdate = () => updateSW(true)
      window.dispatchEvent(new Event('oanix:update-available'))
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const checkForUpdate = () => {
        if (navigator.onLine) void registration.update()
      }

      window.addEventListener('focus', checkForUpdate)
      window.setInterval(checkForUpdate, 5 * 60 * 1000)
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ThemeMenu />
  </StrictMode>,
)
