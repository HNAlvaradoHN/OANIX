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
  '--oanix-organic-text': '#1e293b',
  '--oanix-organic-muted': '#475569',
  '--oanix-organic-border': 'rgba(255,255,255,.46)',
  '--oanix-organic-card': 'rgba(241,245,249,.86)',
  '--oanix-organic-header': 'rgba(241,245,249,.66)',
  '--oanix-organic-dock': 'linear-gradient(180deg,rgba(241,245,249,.30),rgba(226,232,240,.44))',
  '--oanix-organic-chip': 'rgba(255,255,255,.24)',
  '--oanix-organic-shadow': 'rgba(15,23,42,.09)',
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
  const targets = [document.body, document.getElementById('root')]
  root.classList.toggle('oanix-classic-day', enabled)
  targets.forEach((target) => target?.classList.toggle('oanix-classic-day', enabled))

  for (const [property, value] of Object.entries(CLASSIC_DAY_TOKENS)) {
    if (enabled) root.style.setProperty(property, value)
    else root.style.removeProperty(property)
  }
}

export function applyOanixTheme(themeId: string, persist = true): OanixThemePreset['id'] {
  const theme = getOanixTheme(themeId)
  const root = document.documentElement
  const targets = [document.body, document.getElementById('root')]
  const colorScheme = theme.mode === 'light' ? 'only light' : 'dark'

  root.dataset.oanixTheme = theme.id
  root.dataset.oanixThemeMode = theme.mode
  root.style.setProperty('color-scheme', colorScheme, 'important')

  targets.forEach((target) => {
    target?.setAttribute('data-oanix-theme', theme.id)
    target?.setAttribute('data-oanix-theme-mode', theme.mode)
    target?.style.setProperty('color-scheme', colorScheme, 'important')
  })

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
