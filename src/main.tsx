import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ThemeMenu } from './features/personalization/ThemeMenu'
import { applyOanixTheme, readSavedOanixTheme } from './features/personalization/themeCatalog'
import { PwaImagePreviewRuntime } from './features/images/PwaImagePreviewRuntime'
import { NoteMenuScrollDismiss } from './features/notes/NoteMenuScrollDismiss'
import { NoteMenuViewportFit } from './features/notes/NoteMenuViewportFit'
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
import './features/images/pwa-image-no-name.css'

// v38.3 remains the base workspace authority. The state contract below only
// handles exclusive note-detail and covered-background states that live outside it.
import './features/notes/v383WorkspaceVisual.css'
import './features/notes/workspaceStateContract.css'
import './features/notes/workspaceRefinements.css'
import './features/notes/compactNoteContract.css'

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

const oanixWindow = window as OanixUpdateWindow
const isCapacitorBuild = import.meta.env.MODE === 'capacitor'

// The approved workspace class must exist before React's first paint. Leaving this
// to V383WorkspaceVisualRuntime.useEffect exposes the legacy card geometry for a frame.
document.documentElement.classList.add('oanix-v383-visual')
document.body.classList.add('oanix-v383-visual')

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
    <PwaImagePreviewRuntime />
    <NoteMenuScrollDismiss />
    <NoteMenuViewportFit />
  </StrictMode>,
)
