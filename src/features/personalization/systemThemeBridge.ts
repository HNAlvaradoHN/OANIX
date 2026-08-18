import { Capacitor, registerPlugin } from '@capacitor/core'
import type { OanixThemeMode } from './themeCatalog'

interface OanixSystemUiPlugin {
  applyTheme(options: { background: string; light: boolean }): Promise<void>
}

const OanixSystemUi = registerPlugin<OanixSystemUiPlugin>('OanixSystemUi')

export function syncOanixSystemTheme(background: string, mode: OanixThemeMode) {
  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  themeMeta?.setAttribute('content', background)

  document.documentElement.style.backgroundColor = background
  if (document.body) document.body.style.backgroundColor = background

  if (!Capacitor.isNativePlatform()) return

  void OanixSystemUi.applyTheme({
    background,
    light: mode === 'light',
  }).catch(() => {
    // System chrome is visual-only; never block OANIX if the native bridge is unavailable.
  })
}
