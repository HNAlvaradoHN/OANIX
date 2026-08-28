import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ThemeMenu } from './features/personalization/ThemeMenu'
import { applyOanixTheme, readSavedOanixTheme } from './features/personalization/themeCatalog'
import { PwaImagePreviewRuntime } from './features/images/PwaImagePreviewRuntime'
import { WORKSPACE_V2_ENABLED } from './app/workspaceExperience'
import './features/folders/folderNavigationState.css'
import './styles/global.css'
import './styles/midnight-violet.css'
import './styles/theme-surfaces.css'
import './styles/classic-theme-contract.css'
// Notebook rules remain below the shared theme tokens. Classic theme surfaces are
// consolidated in one authority before the v38.3 workspace contract takes over.
import './styles/notebook-contract.css'
import './styles/classic-theme-surfaces.css'
import './styles/privacy-status-polish.css'
import './styles/note-menu-viewport-fit.css'
import './styles/web-brand-logo.css'
import './styles/vault-touch-motion-guard.css'
import './styles/vaultCloudProgress.css'
import './features/images/pwa-image-no-name.css'

// Workspace V2 is the default authority. Legacy v38.3-only presentation
// is code-split with LegacyWorkspaceRuntimeGate so it does not enter the V2 CSS path.

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

const oanixWindow = window as OanixUpdateWindow
const isCapacitorBuild = import.meta.env.MODE === 'capacitor'

// Apply exactly one pre-paint workspace visual authority. V2 deliberately does
// not inherit the legacy v38.3 !important geometry, while the current workspace
// keeps its existing no-flash contract until the migration switch is enabled.
if (WORKSPACE_V2_ENABLED) {
  document.documentElement.classList.add('oanix-workspace-v2-active')
  document.body.classList.add('oanix-workspace-v2-active')
} else {
  document.documentElement.classList.add('oanix-v383-visual')
  document.body.classList.add('oanix-v383-visual')
}

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
    <ThemeMenu />
    <PwaImagePreviewRuntime />
  </StrictMode>,
)
