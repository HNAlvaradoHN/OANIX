import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ThemeMenu } from './features/personalization/ThemeMenu'
import { applyOanixTheme, readSavedOanixTheme } from './features/personalization/themeCatalog'
import { PwaImagePreviewRuntime } from './features/images/PwaImagePreviewRuntime'
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

// v38.3 remains the base workspace authority. The state contract below only
// handles exclusive note-detail and covered-background states that live outside it.
import './features/notes/v383WorkspaceVisual.css'
import './features/notes/workspaceStateContract.css'
import './features/notes/workspaceRefinements.css'
import './features/notes/compactNoteContract.css'
import './features/notes/responsiveCompactNoteContract.css'
import './features/notes/organicWorkspaceTouchMotion.css'

type OanixUpdateWindow = Window & {
  __oanixApplyUpdate?: () => Promise<void>
}

const oanixWindow = window as OanixUpdateWindow
const isCapacitorBuild = import.meta.env.MODE === 'capacitor'
const STYLESHEET_RECOVERY_KEY = 'oanix:stylesheet-recovery-attempt'

function oanixStylesheetLinks(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/OANIX/assets/"]'))
}

function stylesheetLooksLoaded(link: HTMLLinkElement): boolean {
  try {
    return link.sheet !== null
  } catch {
    return false
  }
}

async function clearOanixPrecacheAndReload(): Promise<void> {
  if (!navigator.onLine || sessionStorage.getItem(STYLESHEET_RECOVERY_KEY) === 'reloading') return
  sessionStorage.setItem(STYLESHEET_RECOVERY_KEY, 'reloading')

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations
        .filter((registration) => registration.scope.includes('/OANIX/'))
        .map((registration) => registration.unregister()),
    )
  }

  if ('caches' in window) {
    const cacheKeys = await caches.keys()
    await Promise.all(
      cacheKeys
        .filter((cacheKey) => cacheKey.startsWith('workbox-precache'))
        .map((cacheKey) => caches.delete(cacheKey)),
    )
  }

  window.location.reload()
}

async function recoverMissingPwaStylesheet(): Promise<void> {
  if (!navigator.onLine) return

  const stylesheets = oanixStylesheetLinks()
  if (stylesheets.length === 0 || stylesheets.every(stylesheetLooksLoaded)) {
    sessionStorage.removeItem(STYLESHEET_RECOVERY_KEY)
    return
  }

  if (sessionStorage.getItem(STYLESHEET_RECOVERY_KEY)) return
  sessionStorage.setItem(STYLESHEET_RECOVERY_KEY, 'retrying')

  const failedStylesheets = stylesheets.filter((link) => !stylesheetLooksLoaded(link))
  for (const failedLink of failedStylesheets) {
    const retryUrl = new URL(failedLink.href)
    retryUrl.searchParams.set('__oanix_retry', Date.now().toString())
    const replacement = failedLink.cloneNode() as HTMLLinkElement
    replacement.href = retryUrl.toString()
    replacement.addEventListener('load', () => sessionStorage.removeItem(STYLESHEET_RECOVERY_KEY), { once: true })
    failedLink.replaceWith(replacement)
  }

  window.setTimeout(() => {
    if (oanixStylesheetLinks().some((link) => !stylesheetLooksLoaded(link))) {
      void clearOanixPrecacheAndReload()
    }
  }, 2500)
}

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

  window.addEventListener('load', () => void recoverMissingPwaStylesheet(), { once: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ThemeMenu />
    <PwaImagePreviewRuntime />
  </StrictMode>,
)
