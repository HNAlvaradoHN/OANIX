import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import './styles/global.css'

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

const oanixWindow = window as OanixUpdateWindow

// Keep the existing prompt-based update strategy: a new service worker is discovered in the
// background, but OANIX only reloads after the user explicitly chooses to update.
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
