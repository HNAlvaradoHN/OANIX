import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { applyOanixTheme, readSavedOanixTheme } from './features/personalization/themeCatalog'
import './styles/global.css'
import './app/VaultVisualStyles'

// The rebuild owns the unlocked presentation. Legacy workspace runtimes and CSS are not loaded here.

// PWA uses the selected OANIX brand image.
// Capacitor keeps the approved native identity until Android launcher assets are regenerated separately.
const brandMarkAsset = isCapacitorBuild ? 'oanix-icon.svg' : 'oanix-logo.webp'
document.documentElement.classList.add('oanix-brand-final')
if (!isCapacitorBuild) document.documentElement.classList.add('oanix-brand-pwa-preview')
document.documentElement.style.setProperty(
  '--oanix-brand-logo-url',
  `url("${import.meta.env.BASE_URL}${brandMarkAsset}")`,
)

// Theme is a non-sensitive local UI preference. Paper style is now chosen per note.
applyOanixTheme(readSavedOanixTheme(), false)

if (!isCapacitorBuild) {
  // A fresh worker activates and claims clients immediately, but OANIX never reloads
  // the visible app automatically. When the controller changes, the normal update
  // banner becomes the explicit reload gate after pending saves are checked in App.
  let hasPwaController = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hasPwaController) {
        hasPwaController = true
        return
      }

      oanixWindow.__oanixApplyUpdate = async () => {
        window.location.reload()
      }
      window.dispatchEvent(new Event('oanix:update-available'))
    })
  }

  // Keep the user-facing prompt contract. onNeedRefresh remains as a compatibility
  // path for browsers that surface a waiting worker before immediate activation.
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
  </StrictMode>,
)
