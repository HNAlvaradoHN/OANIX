import { syncOanixSystemTheme } from './systemThemeBridge'

export type OanixThemeMode = 'dark' | 'light'

export interface OanixThemePreset {
  id: 'classic-day' | 'classic-night'
  name: string
  description: string
  mode: OanixThemeMode
  swatches: readonly [string, string, string]
}

export const OANIX_THEME_STORAGE_KEY = 'oanix.theme'
export const DEFAULT_OANIX_THEME: OanixThemePreset['id'] = 'classic-night'

const LEGACY_LIGHT_THEMES = new Set([
  'pearl-violet',
  'blush-glass',
  'lavender-mist',
  'ocean-pearl',
])

const CLASSIC_DAY_TOKENS: Record<string, string> = {
  '--theme-bg': '#ffffff',
  '--theme-bg-deep': '#f7f9fc',
  '--theme-surface': '#ffffff',
  '--theme-surface-2': '#f8fbff',
  '--theme-surface-3': '#edf4fb',
  '--theme-surface-hover': '#eef5ff',
  '--theme-text': '#101828',
  '--theme-text-soft': '#344054',
  '--theme-muted': '#667085',
  '--theme-muted-2': '#98a2b3',
  '--theme-accent': '#2563eb',
  '--theme-accent-2': '#38bdf8',
  '--theme-accent-soft': '#3b82f6',
  '--theme-border': 'rgba(52,64,84,.16)',
  '--theme-border-strong': 'rgba(37,99,235,.36)',
  '--theme-glow': 'rgba(37,99,235,.09)',
  '--theme-grid': 'rgba(71,85,105,.025)',
  '--theme-danger': '#b42318',
}

export const OANIX_THEMES: readonly OanixThemePreset[] = [
  {
    id: 'classic-day',
    name: 'Día',
    description: 'Blanco, azul y luz limpia',
    mode: 'light',
    swatches: ['#ffffff', '#f4f7fb', '#2563eb'],
  },
  {
    id: 'classic-night',
    name: 'Noche',
    description: 'Negro neutro y contraste alto',
    mode: 'dark',
    swatches: ['#05070b', '#10141c', '#dbe7ff'],
  },
] as const

export const OANIX_BASE_THEMES = OANIX_THEMES

export function isOanixThemeId(value: string | null): value is OanixThemePreset['id'] {
  return value === 'classic-day' || value === 'classic-night'
}

function normalizeThemeId(value: string | null): OanixThemePreset['id'] {
  if (isOanixThemeId(value)) return value
  if (value && LEGACY_LIGHT_THEMES.has(value)) return 'classic-day'
  return 'classic-night'
}

export function getOanixTheme(themeId: string): OanixThemePreset {
  const normalized = normalizeThemeId(themeId)
  return OANIX_THEMES.find((theme) => theme.id === normalized) ?? OANIX_THEMES[1]
}

export function readSavedOanixTheme(): OanixThemePreset['id'] {
  try {
    return normalizeThemeId(window.localStorage.getItem(OANIX_THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_OANIX_THEME
  }
}

function applyClassicDayHardening(enabled: boolean) {
  const root = document.documentElement
  root.classList.toggle('oanix-classic-day', enabled)
  document.body?.classList.toggle('oanix-classic-day', enabled)

  for (const [property, value] of Object.entries(CLASSIC_DAY_TOKENS)) {
    if (enabled) root.style.setProperty(property, value)
    else root.style.removeProperty(property)
  }
}

export function applyOanixTheme(themeId: string, persist = true): OanixThemePreset['id'] {
  const theme = getOanixTheme(themeId)
  document.documentElement.dataset.oanixTheme = theme.id
  document.documentElement.dataset.oanixThemeMode = theme.mode
  document.documentElement.style.colorScheme = theme.mode
  document.body?.setAttribute('data-oanix-theme', theme.id)
  document.body?.setAttribute('data-oanix-theme-mode', theme.mode)
  applyClassicDayHardening(theme.id === 'classic-day')
  syncOanixSystemTheme(theme.swatches[0], theme.mode)

  if (persist) {
    try {
      window.localStorage.setItem(OANIX_THEME_STORAGE_KEY, theme.id)
    } catch {
      // Theme persistence is a convenience only; never block OANIX if storage is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent('oanix:theme-change', { detail: theme.id }))
  return theme.id
}
